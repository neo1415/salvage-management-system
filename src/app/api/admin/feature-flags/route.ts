/**
 * Feature Flags API Route
 * Manages deposit system feature flag
 * 
 * Requirements:
 * - Requirement 22: Deposit System Feature Flag
 * 
 * SECURITY: Role-based access control (System Admin only)
 * AUDIT: Records all toggle events
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { systemConfig, configChangeHistory } from '@/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import { patchLegacyAuctionConfigPolicy } from '@/features/business-policy/legacy-auction-config-bridge';

/**
 * GET /api/admin/feature-flags
 * Get feature flag status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is System Admin
    const authorizedRoles = ['system_admin', 'salvage_manager'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - System Admin role required' 
        },
        { status: 403 }
      );
    }

    const policy = await businessPolicyService.getEffectivePolicy();

    return NextResponse.json({
      success: true,
      depositSystemEnabled: policy.escrow.depositSystemEnabled,
      source: 'business_policy',
    });
  } catch (error) {
    console.error('Get feature flags error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve feature flags. Please try again.'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/feature-flags
 * Toggle deposit system feature flag
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is System Admin
    const authorizedRoles = ['system_admin', 'salvage_manager'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - System Admin role required' 
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { enabled, reason } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'enabled must be a boolean value' },
        { status: 400 }
      );
    }

    const basePolicy = await businessPolicyService.getEffectivePolicy();
    const patch = patchLegacyAuctionConfigPolicy(basePolicy, 'deposit_system_enabled', enabled);
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const draft = await businessPolicyService.saveDraftPolicy({
      policy: patch.policy,
      actorId: session.user.id,
      notes: reason || `Deposit system ${enabled ? 'enabled' : 'disabled'} from Auction Config`,
      ipAddress,
      userAgent,
    });

    if (!draft.success || !draft.record) {
      return NextResponse.json(
        {
          success: false,
          error: draft.error || 'Feature flag could not be saved.',
          validation: draft.validation,
        },
        { status: 400 }
      );
    }

    const published = await businessPolicyService.publishPolicy({
      id: draft.record.id,
      actorId: session.user.id,
      ipAddress,
      userAgent,
    });

    if (!published.success || !published.record) {
      return NextResponse.json(
        {
          success: false,
          error: published.error || 'Feature flag could not be published.',
          validation: published.validation,
        },
        { status: 400 }
      );
    }

    // Mirror into legacy feature-flag storage so existing history and any older
    // readers remain compatible while Enterprise Setup becomes the source of truth.
    await db.transaction(async (tx) => {
      // Get current value
      const [currentFlag] = await tx
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.parameter, 'deposit_system_enabled'))
        .limit(1);

      const oldValue = currentFlag?.value || 'true';
      const newValue = String(enabled);

      // Update or insert feature flag
      if (currentFlag) {
        await tx
          .update(systemConfig)
          .set({
            value: newValue,
            updatedAt: new Date(),
            updatedBy: session.user.id,
          })
          .where(eq(systemConfig.parameter, 'deposit_system_enabled'));
      } else {
        await tx.insert(systemConfig).values({
          parameter: 'deposit_system_enabled',
          value: newValue,
          dataType: 'boolean',
          description: 'Enable or disable the deposit-based bidding system',
          updatedBy: session.user.id,
        });
      }

      // Record toggle event in audit trail
      await tx.insert(configChangeHistory).values({
        parameter: 'deposit_system_enabled',
        oldValue,
        newValue,
        changedBy: session.user.id,
        reason: reason || `Feature flag ${enabled ? 'enabled' : 'disabled'}`,
      });
    });

    revalidatePath('/');
    revalidatePath('/login');
    revalidatePath('/register');
    revalidatePath('/admin/enterprise-setup');
    revalidatePath('/admin/auction-config');

    return NextResponse.json({
      success: true,
      depositSystemEnabled: enabled,
      source: 'business_policy',
      message: `Deposit system ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    console.error('Toggle feature flag error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to toggle feature flag. Please try again.'
      },
      { status: 500 }
    );
  }
}
