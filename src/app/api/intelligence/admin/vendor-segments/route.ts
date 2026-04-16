/**
 * Vendor Segments API
 * 
 * GET /api/intelligence/admin/vendor-segments
 * Returns vendor segment distribution
 * Task: 15.2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDashboardService } from '@/features/intelligence/services/admin-dashboard.service';
import { auth } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const data = await adminDashboardService.getVendorSegmentDistribution();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching vendor segments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vendor segments' },
      { status: 500 }
    );
  }
}
