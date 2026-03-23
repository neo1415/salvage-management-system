/**
 * POST /api/admin/cache/refresh
 * Clears autocomplete cache and forces fresh data
 */

import { NextRequest, NextResponse } from 'next/server';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';

export async function POST(request: NextRequest) {
  try {
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