/**
 * Performance Tests for Recommendation Service
 * 
 * Requirements:
 * - Response time <200ms (95th percentile)
 * - Handle 100 concurrent requests
 * - Maintain quality under load
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecommendationService } from '@/features/intelligence/services/recommendation.service';
import { db } from '@/lib/db';
import { vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Recommendation Service Performance Tests', () => {
  let recommendationService: RecommendationService;
  let testVendorId: string;
  let responseTimes: number[] = [];

  beforeAll(async () => {
    recommendationService = new RecommendationService();

    // Create test user and vendor
    const testUser = await db.insert(users).values({
      email: 'perf-vendor@test.com',
      name: 'Performance Test Vendor',
      role: 'vendor',
      hashedPassword: 'test',
    }).returning();

    const testVendor = await db.insert(vendors).values({
      userId: testUser[0].id,
      businessName: 'Performance Test Business',
      businessAddress: 'Test Address',
      businessPhone: '+2341234567890',
      kycStatus: 'approved',
    }).returning();

    testVendorId = testVendor[0].id;
  });

  afterAll(async () => {
    // Cleanup
    if (testVendorId) {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, testVendorId),
      });

      if (vendor) {
        await db.delete(vendors).where(eq(vendors.id, testVendorId));
        await db.delete(users).where(eq(users.id, vendor.userId));
      }
    }
  });

  it('should respond within 200ms for single recommendation request', async () => {
    const startTime = performance.now();
    
    const recommendations = await recommendationService.generateRecommendations(testVendorId);
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    expect(recommendations).toBeDefined();
    expect(Array.isArray(recommendations)).toBe(true);
    expect(responseTime).toBeLessThan(200);
    
    console.log(`Single request response time: ${responseTime.toFixed(2)}ms`);
    console.log(`Recommendations returned: ${recommendations.length}`);
  });

  it('should maintain <200ms response time for 10 sequential requests', async () => {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      await recommendationService.generateRecommendations(testVendorId);
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
          await recommendationService.generateRecommendations(testVendorId);
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
          await recommendationService.generateRecommendations(testVendorId);
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
    await recommendationService.generateRecommendations(testVendorId);
    const endTime1 = performance.now();
    const uncachedTime = endTime1 - startTime1;

    // Second request (cache hit)
    const startTime2 = performance.now();
    await recommendationService.generateRecommendations(testVendorId);
    const endTime2 = performance.now();
    const cachedTime = endTime2 - startTime2;

    // Cached request should be significantly faster
    expect(cachedTime).toBeLessThan(uncachedTime * 0.5);

    console.log(`Cache performance:`);
    console.log(`  Uncached: ${uncachedTime.toFixed(2)}ms`);
    console.log(`  Cached: ${cachedTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${(uncachedTime / cachedTime).toFixed(2)}x`);
  });

  it('should maintain recommendation quality under load', async () => {
    const concurrentRequests = 20;
    const results: any[][] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        (async () => {
          const recommendations = await recommendationService.generateRecommendations(testVendorId);
          results.push(recommendations);
        })()
      );
    }

    await Promise.all(promises);

    // All requests should return consistent results
    const firstResultCount = results[0].length;
    const allConsistent = results.every(r => r.length === firstResultCount);

    expect(allConsistent).toBe(true);

    // All recommendations should have valid match scores
    results.forEach(recommendations => {
      recommendations.forEach(rec => {
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(100);
      });
    });

    console.log(`Quality check: ${results.length} requests returned consistent results`);
  });
});
