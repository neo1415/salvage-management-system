import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron Job: Weekly Leaderboard Update
 * 
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions)
 * every Monday at midnight to refresh the vendor leaderboard.
 * 
 * Schedule: 0 0 * * 1 (Every Monday at 00:00 UTC)
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/leaderboard-update",
 *       "schedule": "0 0 * * 1"
 *     }
 *   ]
 * }
 * 
 * Requirements: 23, Enterprise Standards Section 6
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call the leaderboard refresh endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/api/vendors/leaderboard/refresh`;

    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh leaderboard: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json(
      {
        success: true,
        message: 'Leaderboard updated successfully',
        timestamp: new Date().toISOString(),
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in leaderboard cron job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
