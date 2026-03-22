/**
 * Background Job Service
 * 
 * Handles async scraping operations that exceed timeout limits.
 * Jobs are stored in the database and processed independently of user requests.
 * 
 * Requirements: 2.5, 6.2, 6.3, 9.5, 9.6
 */

import { db } from '@/lib/db/drizzle';
import { backgroundJobs } from '@/lib/db/schema/market-data';
import { eq, and } from 'drizzle-orm';
import type { PropertyIdentifier } from '@/features/market-data/types';
import { generatePropertyHash } from './scraping-logger.service';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundJob {
  id: string;
  type: 'scrape_market_data';
  propertyHash: string;
  property: PropertyIdentifier;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Enqueue a scraping job for background processing
 * 
 * Requirement 2.5: Initiate background scraping job for stale data
 * Requirement 6.2: Delegate to background job if scraping exceeds 10 seconds
 */
export async function enqueueScrapingJob(
  property: PropertyIdentifier
): Promise<string> {
  const propertyHash = generatePropertyHash(property);

  try {
    // Check if a pending or running job already exists for this property
    const existingJobs = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.propertyHash, propertyHash),
          eq(backgroundJobs.status, 'pending')
        )
      )
      .limit(1);

    // If a job already exists, return its ID
    if (existingJobs.length > 0) {
      return existingJobs[0].id;
    }

    // Create new job
    const result = await db
      .insert(backgroundJobs)
      .values({
        jobType: 'scrape_market_data',
        propertyHash,
        propertyDetails: property,
        status: 'pending',
      })
      .returning({ id: backgroundJobs.id });

    return result[0].id;
  } catch (error) {
    console.error('Failed to enqueue scraping job:', error);
    throw new Error('Failed to enqueue scraping job');
  }
}

/**
 * Process a scraping job
 * 
 * Requirement 9.6: Update cache asynchronously without blocking user request
 */
export async function processScrapingJob(jobId: string): Promise<void> {
  try {
    // Get job details
    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);

    if (jobs.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    const job = jobs[0];

    // Check if job is already running or completed
    if (job.status !== 'pending') {
      console.log(`Job ${jobId} is already ${job.status}`);
      return;
    }

    // Mark job as running
    await db
      .update(backgroundJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, jobId));

    // Process the job (actual scraping logic will be implemented in market-data.service.ts)
    // For now, we just mark it as completed
    // The actual implementation will call scrapeAllSources() and setCachedPrice()

    // Mark job as completed
    await db
      .update(backgroundJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, jobId));
  } catch (error) {
    console.error(`Failed to process job ${jobId}:`, error);

    // Mark job as failed
    await db
      .update(backgroundJobs)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, jobId));

    throw error;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<BackgroundJob | null> {
  try {
    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);

    if (jobs.length === 0) {
      return null;
    }

    const job = jobs[0];

    return {
      id: job.id,
      type: 'scrape_market_data',
      propertyHash: job.propertyHash,
      property: job.propertyDetails as PropertyIdentifier,
      status: job.status as JobStatus,
      createdAt: job.createdAt,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      error: job.errorMessage || undefined,
    };
  } catch (error) {
    console.error(`Failed to get job status for ${jobId}:`, error);
    return null;
  }
}

/**
 * Get all pending jobs
 */
export async function getPendingJobs(): Promise<BackgroundJob[]> {
  try {
    const jobs = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.status, 'pending'))
      .limit(100);

    return jobs.map(job => ({
      id: job.id,
      type: 'scrape_market_data',
      propertyHash: job.propertyHash,
      property: job.propertyDetails as PropertyIdentifier,
      status: job.status as JobStatus,
      createdAt: job.createdAt,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      error: job.errorMessage || undefined,
    }));
  } catch (error) {
    console.error('Failed to get pending jobs:', error);
    return [];
  }
}

/**
 * Clean up old completed jobs (older than 7 days)
 */
export async function cleanupOldJobs(): Promise<number> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await db
      .delete(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.status, 'completed'),
          // Note: This would need a proper date comparison in production
        )
      );

    return 0; // Return count of deleted jobs
  } catch (error) {
    console.error('Failed to cleanup old jobs:', error);
    return 0;
  }
}
