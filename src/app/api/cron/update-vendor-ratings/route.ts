import { NextRequest, NextResponse } from 'next/server';
import { updateAllVendorRatings } from '@/features/vendors/services/auto-rating.service';

/**
 * Cron Job: Update Vendor Ratings
 * 
 * This endpoint should be called daily to recalculate all vendor ratings
 * based on their performance metrics.
 * 
 * Schedule: Daily at 2:00 AM
 * 
 * Vercel Cron Configuration (vercel.json):
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-vendor-ratings",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * ```
 * 
 * Local Testing:
 * ```bash
 * curl http://localhost:3000/api/cron/update-vendor-ratings
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify cron secret (REQUIRED)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('[Security] CRON_SECRET not configured - cron endpoints are vulnerable!');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Security] Unauthorized cron attempt', {
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting vendor rating update...');
    
    const result = await updateAllVendorRatings();
    
    console.log(`✅ Vendor rating update complete: ${result.updated} updated, ${result.errors} errors`);
    
    return NextResponse.json({
      success: true,
      updated: result.updated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in vendor rating cron job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
