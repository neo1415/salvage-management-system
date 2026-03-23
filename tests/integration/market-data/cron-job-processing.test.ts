/**
 * Integration Test: Cron Job Processing
 * 
 * Tests the cron endpoint for processing background scraping jobs
 * 
 * Requirements: 2.5, 9.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { backgroundJobs, marketDataCache } from '@/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import type { PropertyIdentifier } from '@/features/market-data/types';

// Mock scraper service
vi.mock('@/features/market-data/services/scraper.service', () => ({
  scrapeAllSources: vi.fn(async () => [
    {
      success: true,
      source: 'jiji',
      prices: [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Test Vehicle',
          scrapedAt: new Date(),
        },
      ],
      duration: 1000,
    },
  ]),
}));

// Mock rate limiter
vi.mock('@/features/market-data/services/rate-limiter.service', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  recordRequest: vi.fn(async () => {}),
}));

describe('Integration Test: Cron Job Processing', () => {
  const testProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await db.delete(backgroundJobs);
      await db.delete(marketDataCache);
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Job processing', () => {
    it('should process pending jobs', async () => {
      // Create a pending job
      const [job] = await db
        .insert(backgroundJobs)
        .values({
          jobType: 'scrape_market_data',
          propertyHash: 'test-hash-1',
          propertyDetails: testProperty,
          status: 'pending',
        })
        .returning();

      // Simulate cron endpoint call
      const response = await fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBeGreaterThan(0);

      // Verify job status updated
      const [updatedJob] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, job.id));

      expect(updatedJob.status).toBe('completed');
    });

    it('should handle job failures gracefully', async () => {
      // Mock scraper to fail
      const { scrapeAllSources } = await import('@/features/market-data/services/scraper.service');
      vi.mocked(scrapeAllSources).mockRejectedValueOnce(new Error('Scraping failed'));

      // Create a pending job
      const [job] = await db
        .insert(backgroundJobs)
        .values({
          jobType: 'scrape_market_data',
          propertyHash: 'test-hash-2',
          propertyDetails: testProperty,
          status: 'pending',
        })
        .returning();

      // Simulate cron endpoint call
      const response = await fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.failed).toBeGreaterThan(0);

      // Verify job status updated to failed
      const [updatedJob] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, job.id));

      expect(updatedJob.status).toBe('failed');
      expect(updatedJob.errorMessage).toBeTruthy();
    });

    it('should process multiple jobs in batch', async () => {
      // Create multiple pending jobs
      const jobs = await db
        .insert(backgroundJobs)
        .values([
          {
            jobType: 'scrape_market_data',
            propertyHash: 'test-hash-3',
            propertyDetails: testProperty,
            status: 'pending',
          },
          {
            jobType: 'scrape_market_data',
            propertyHash: 'test-hash-4',
            propertyDetails: { ...testProperty, model: 'Corolla' },
            status: 'pending',
          },
          {
            jobType: 'scrape_market_data',
            propertyHash: 'test-hash-5',
            propertyDetails: { ...testProperty, model: 'RAV4' },
            status: 'pending',
          },
        ])
        .returning();

      // Simulate cron endpoint call
      const response = await fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(3);

      // Verify all jobs completed
      for (const job of jobs) {
        const [updatedJob] = await db
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.id, job.id));

        expect(updatedJob.status).toBe('completed');
      }
    });

    it('should require authorization', async () => {
      // Call without authorization header
      const response = await fetch('http://localhost:3000/api/cron/process-scraping-jobs');

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should limit batch size to avoid timeout', async () => {
      // Create more than 10 jobs (batch limit)
      const jobs = Array.from({ length: 15 }, (_, i) => ({
        jobType: 'scrape_market_data' as const,
        propertyHash: `test-hash-${i}`,
        propertyDetails: testProperty,
        status: 'pending' as const,
      }));

      await db.insert(backgroundJobs).values(jobs);

      // Simulate cron endpoint call
      const response = await fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Should process max 10 jobs per run
      expect(data.processed).toBeLessThanOrEqual(10);

      // Verify some jobs still pending
      const pendingJobs = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, 'pending'));

      expect(pendingJobs.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent job handling', () => {
    it('should not process the same job twice', async () => {
      // Create a pending job
      const [job] = await db
        .insert(backgroundJobs)
        .values({
          jobType: 'scrape_market_data',
          propertyHash: 'test-hash-6',
          propertyDetails: testProperty,
          status: 'pending',
        })
        .returning();

      // Simulate two concurrent cron calls
      const [response1, response2] = await Promise.all([
        fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          },
        }),
        fetch('http://localhost:3000/api/cron/process-scraping-jobs', {
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
          },
        }),
      ]);

      expect(response1.ok).toBe(true);
      expect(response2.ok).toBe(true);

      // Verify job processed only once
      const [updatedJob] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, job.id));

      expect(updatedJob.status).toBe('completed');
      
      // Should have only one completed_at timestamp
      expect(updatedJob.completedAt).toBeTruthy();
    });
  });
});

