/**
 * Cron Endpoint: Process Scraping Jobs
 * 
 * This endpoint processes pending background scraping jobs.
 * It should be called periodically by Vercel Cron (e.g., every 5 minutes).
 * 
 * Requirements: 2.5, 9.6
 * 
 * Vercel Cron Configuration (vercel.json):
 * Add this to your vercel.json file:
 * "crons": [{ "path": "/api/cron/process-scraping-jobs", "schedule": "0/5 * * * *" }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { backgroundJobs } from '@/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import { processScrapingJob } from '@/features/market-data/services/background-job.service';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max

/**
 * GET /api/cron/process-scraping-jobs
 * 
 * Processes pending background scraping jobs
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

    console.log('[CRON] Processing scraping jobs...');

    // Get pending jobs (limit to 10 per run to avoid timeout)
    const pendingJobs = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, 'pending'))
      .limit(10);

    console.log('[CRON] Found', pendingJobs.length, 'pending jobs');

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each job
    for (const job of pendingJobs) {
      try {
        console.log('[CRON] Processing job', job.id);
        
        await processScrapingJob(job.id);
        
        results.processed++;
        results.succeeded++;
        
        console.log('[CRON] Job', job.id, 'completed successfully');
      } catch (error) {
        results.processed++;
        results.failed++;
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Job ${job.id}: ${errorMessage}`);
        
        console.error('[CRON] Job', job.id, 'failed:', errorMessage);
      }
    }

    console.log('[CRON] Job processing complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Error processing scraping jobs:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process scraping jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
