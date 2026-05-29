/**
 * System Admin Configuration API Route
 * Manages auction deposit system configuration
 * 
 * Requirements:
 * - Requirement 18: System Admin Configuration Interface
 * - Requirement 19: Configuration Change Validation and Persistence
 * 
 * SECURITY: Role-based access control (System Admin only)
 * AUDIT: Complete audit trail for all configuration changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/next-auth.config';
import { configService } from '@/features/auction-deposit/services/config.service';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import {
  patchLegacyAuctionConfigPolicy,
  policyToLegacyAuctionConfig,
} from '@/features/business-policy/legacy-auction-config-bridge';

/**
 * GET /api/admin/config
 * Get current system configuration
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

    // RBAC: Verify user is System Admin or Manager
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

    // Auction Config is a friendly view over the effective business policy.
    // This prevents it from drifting away from Enterprise Setup.
    const policy = await businessPolicyService.getEffectivePolicy();
    const config = policyToLegacyAuctionConfig(policy);

    return NextResponse.json({
      success: true,
      config,
      source: 'business_policy',
    });
  } catch (error) {
    console.error('Get config error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve configuration. Please try again.'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/config
 * Update configuration parameter
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

    // RBAC: Verify user is System Admin or Manager
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
    const { parameter, value, reason } = body;

    // Validate input
    if (!parameter || value === undefined || value === null) {
      return NextResponse.json(
        { success: false, error: 'Parameter and value are required' },
        { status: 400 }
      );
    }

    const basePolicy = await businessPolicyService.getEffectivePolicy();
    const patch = patchLegacyAuctionConfigPolicy(basePolicy, parameter, Number(value));

    const notes = `Auction Config updated ${patch.canonicalParameter}${reason ? `: ${reason}` : ''}`;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const draft = await businessPolicyService.saveDraftPolicy({
      policy: patch.policy,
      actorId: session.user.id,
      notes,
      ipAddress,
      userAgent,
    });

    if (!draft.success || !draft.record) {
      return NextResponse.json(
        {
          success: false,
          error: draft.error || 'This configuration could not be saved.',
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
          error: published.error || 'This configuration could not be published.',
          validation: published.validation,
        },
        { status: 400 }
      );
    }

    // Keep the legacy system_config table and existing history tab in sync while
    // older runtime paths finish moving to the business policy service.
    try {
      await configService.updateConfig(
        patch.canonicalParameter,
        value,
        session.user.id,
        reason || 'Updated from Auction Config'
      );
    } catch (legacyMirrorError) {
      console.warn('[AuctionConfig] Policy published, but legacy config mirror failed', {
        parameter: patch.canonicalParameter,
        error: legacyMirrorError instanceof Error ? legacyMirrorError.message : 'Unknown error',
      });
    }

    revalidatePath('/');
    revalidatePath('/login');
    revalidatePath('/register');
    revalidatePath('/admin/enterprise-setup');
    revalidatePath('/admin/auction-config');

    const config = policyToLegacyAuctionConfig(published.record.policy);

    return NextResponse.json({
      success: true,
      config,
      source: 'business_policy',
      message: `Configuration parameter '${patch.canonicalParameter}' updated successfully`,
    });
  } catch (error) {
    console.error('Update config error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update configuration. Please try again.';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      },
      { status: 400 }
    );
  }
}
