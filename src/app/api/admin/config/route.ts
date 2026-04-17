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
import { auth } from '@/lib/auth/next-auth.config';
import { configService } from '@/features/auction-deposit/services/config.service';

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

    // Get current configuration
    const config = await configService.getConfig();

    return NextResponse.json({
      success: true,
      config,
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

    // Update configuration
    await configService.updateConfig(
      parameter,
      value,
      session.user.id,
      reason
    );

    // Get updated configuration
    const config = await configService.getConfig();

    return NextResponse.json({
      success: true,
      config,
      message: `Configuration parameter '${parameter}' updated successfully`,
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
