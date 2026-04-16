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
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { systemConfig, configChangeHistory } from '@/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';

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
    const authorizedRoles = ['admin', 'manager'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - System Admin role required' 
        },
        { status: 403 }
      );
    }

    // Get deposit system feature flag
    const [featureFlag] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.parameter, 'deposit_system_enabled'))
      .limit(1);

    const enabled = featureFlag ? featureFlag.value === 'true' : true; // Default: enabled

    return NextResponse.json({
      success: true,
      depositSystemEnabled: enabled,
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
    const authorizedRoles = ['admin', 'manager'];
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

    // Use database transaction
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

    return NextResponse.json({
      success: true,
      depositSystemEnabled: enabled,
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
