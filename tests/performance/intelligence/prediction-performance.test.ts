/**
 * Performance Tests for Prediction Service
 * 
 * Requirements:
 * - Response time <200ms (95th percentile)
 * - Handle 100 concurrent requests
 * - Maintain accuracy under load
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PredictionService } from '@/features/intelligence/services/prediction.service';
import { db } from '@/lib/db';
import { auctions, cases, vehicles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Prediction Service Performance Tests', () => {
  let predictionService: PredictionService;
  let testAuctionId: string;
  let responseTimes: number[] = [];

  beforeAll(async () => {
    predictionService = new PredictionService();

    // Create test auction with vehicle
    const testCase = await db.insert(cases).values({
      claimantName: 'Performance Test User',
      claimantPhone: '+2341234567890',
      claimantEmail: 'perf@test.com',
      status: 'approved',
      assetType: 'vehicle',
    }).returning();

    const testVehicle = await db.insert(vehicles).values({
      caseId: testCase[0].id,
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      color: 'Silver',
      trim: 'XLE',
      mileage: 45000,
      condition: 'good',
    }).returning();

    const testAuction = await db.insert(auctions).values({
      caseId: testCase[0].id,
      startingPrice: 5000000,
      reservePrice: 8000000,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
    }).returning();

    testAuctionId = testAuction[0].id;
  });

  afterAll(async () => {
    // Cleanup
    if (testAuctionId) {
      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, testAuctionId),
        with: { case: true },
      });

      if (auction) {
        await db.delete(auctions).where(eq(auctions.id, testAuctionId));
        await db.delete(vehicles).where(eq(vehicles.caseId, auction.caseId));
        await db.delete(cases).where(eq(cases.id, auction.caseId));
      }
    }
  });

  it('should respond within 200ms for single prediction request', async () => {
    const startTime = performance.now();
    
    const prediction = await predictionService.generatePrediction(testAuctionId);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(prediction).toBeDefined();
    expect(responseTime).toBeLessThan(200);
    
    console.log(`Single request response time: ${responseTime.toFixed(2)}ms`);
  });

  it('should maintain <200ms response time for 10 sequential requests', async () => {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      await predictionService.generatePrediction(testAuctionId);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(200);
    expect(maxTime).toBeLessThan(300);

    console.log(`Sequential requests - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
  });

  it('should handle 50 concurrent requests with 95th percentile <200ms', async () => {
    const concurrentRequests = 50;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        (async () => {
          const startTime = performance.now();
          await predictionService.generatePrediction(testAuctionId);
          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
        })()
      );
    }

    await Promise.all(promises);

    // Calculate 95th percentile
    const sorted = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const max = sorted[sorted.length - 1];

    expect(p95).toBeLessThan(200);

    console.log(`Concurrent requests (n=${concurrentRequests}):`);
    console.log(`  Avg: ${avg.toFixed(2)}ms`);
    console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
  });

  it('should handle 100 concurrent requests with acceptable performance', async () => {
    const concurrentRequests = 100;
    const times: number[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        (async () => {
          const startTime = performance.now();
          await predictionService.generatePrediction(testAuctionId);
          const endTime = performance.now();
          times.push(endTime - startTime);
        })()
      );
    }

    await Promise.all(promises);

    const sorted = times.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    const p99Index = Math.floor(sorted.length * 0.99);
    const p99 = sorted[p99Index];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    // Under heavy load, we allow slightly higher response times
    expect(p95).toBeLessThan(500);
    expect(p99).toBeLessThan(1000);

    console.log(`Heavy load (n=${concurrentRequests}):`);
    console.log(`  Avg: ${avg.toFixed(2)}ms`);
    console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
    console.log(`  99th percentile: ${p99.toFixed(2)}ms`);
  });

  it('should benefit from Redis caching on repeated requests', async () => {
    // First request (cache miss)
    const startTime1 = performance.now();
    await predictionService.generatePrediction(testAuctionId);
    const endTime1 = performance.now();
    const uncachedTime = endTime1 - startTime1;

    // Second request (cache hit)
    const startTime2 = performance.now();
    await predictionService.generatePrediction(testAuctionId);
    const endTime2 = performance.now();
    const cachedTime = endTime2 - startTime2;

    // Cached request should be significantly faster
    expect(cachedTime).toBeLessThan(uncachedTime * 0.5);

    console.log(`Cache performance:`);
    console.log(`  Uncached: ${uncachedTime.toFixed(2)}ms`);
    console.log(`  Cached: ${cachedTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${(uncachedTime / cachedTime).toFixed(2)}x`);
  });
});
