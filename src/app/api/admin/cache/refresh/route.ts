/**
 * POST /api/admin/cache/refresh
 * Clears autocomplete cache and forces fresh data
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'system_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Clear all autocomplete caches
    await autocompleteCache.clearAll();
    
    return NextResponse.json({
      success: true,
      message: 'Autocomplete cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cache Refresh] Error clearing cache:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
