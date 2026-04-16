/**
 * Load Tests for Intelligence API Endpoints
 * 
 * Requirements:
 * - Handle 100 concurrent users
 * - Maintain response times under load
 * - No errors under normal load
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { auctions, cases, vehicles, vendors, users } from '@/lib/db/schema';

describe('Intelligence API Load Tests', () => {
  let testAuctionId: string;
  let testVendorId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create test data
    const testCase = await db.insert(cases).values({
      claimantName: 'Load Test User',
      claimantPhone: '+2341234567890',
      claimantEmail: 'load@test.com',
      status: 'approved',
      assetType: 'vehicle',
    }).returning();

    await db.insert(vehicles).values({
      caseId: testCase[0].id,
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      color: 'Silver',
      mileage: 45000,
      condition: 'good',
    });

    const testAuction = await db.insert(auctions).values({
      caseId: testCase[0].id,
      startingPrice: 5000000,
      reservePrice: 8000000,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
    }).returning();

    testAuctionId = testAuction[0].id;

    const testUser = await db.insert(users).values({
      email: 'load-vendor@test.com',
      name: 'Load Test Vendor',
      role: 'vendor',
      hashedPassword: 'test',
    }).returning();

    const testVendor = await db.insert(vendors).values({
      userId: testUser[0].id,
      businessName: 'Load Test Business',
      businessAddress: 'Test Address',
      businessPhone: '+2341234567890',
      kycStatus: 'approved',
    }).returning();

    testVendorId = testVendor[0].id;

    // Mock auth token
    authToken = 'test-token';
  });

  afterAll(async () => {
    // Cleanup test data
    // (Implementation depends on your cleanup strategy)
  });

  describe('Prediction API Load Tests', () => {
    it('should handle 50 concurrent prediction requests', async () => {
      const concurrentUsers = 50;
      const promises: Promise<Response>[] = [];
      const responseTimes: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          (async () => {
            const startTime = performance.now();
            try {
              const response = await fetch(`http://localhost:3000/api/auctions/${testAuctionId}/prediction`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              
              if (!response.ok) {
                errors.push(response.status);
              }
              
              return response;
            } catch (error) {
              errors.push(500);
              throw error;
            }
          })()
        );
      }

      await Promise.allSettled(promises);

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const errorRate = (errors.length / concurrentUsers) * 100;

      expect(errorRate).toBeLessThan(5); // Less than 5% error rate
      expect(p95).toBeLessThan(500); // 95th percentile under 500ms

      console.log(`Prediction API (n=${concurrentUsers}):`);
      console.log(`  Avg response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
    });

    it('should handle 100 concurrent prediction requests', async () => {
      const concurrentUsers = 100;
      const promises: Promise<Response>[] = [];
      const responseTimes: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          (async () => {
            const startTime = performance.now();
            try {
              const response = await fetch(`http://localhost:3000/api/auctions/${testAuctionId}/prediction`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              
              if (!response.ok) {
                errors.push(response.status);
              }
              
              return response;
            } catch (error) {
              errors.push(500);
              throw error;
            }
          })()
        );
      }

      await Promise.allSettled(promises);

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const errorRate = (errors.length / concurrentUsers) * 100;

      expect(errorRate).toBeLessThan(10); // Less than 10% error rate under heavy load
      expect(p95).toBeLessThan(1000); // 95th percentile under 1s

      console.log(`Prediction API Heavy Load (n=${concurrentUsers}):`);
      console.log(`  Avg response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`  99th percentile: ${p99.toFixed(2)}ms`);
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
    });
  });

  describe('Recommendation API Load Tests', () => {
    it('should handle 50 concurrent recommendation requests', async () => {
      const concurrentUsers = 50;
      const promises: Promise<Response>[] = [];
      const responseTimes: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          (async () => {
            const startTime = performance.now();
            try {
              const response = await fetch(`http://localhost:3000/api/vendors/${testVendorId}/recommendations`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              
              if (!response.ok) {
                errors.push(response.status);
              }
              
              return response;
            } catch (error) {
              errors.push(500);
              throw error;
            }
          })()
        );
      }

      await Promise.allSettled(promises);

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const errorRate = (errors.length / concurrentUsers) * 100;

      expect(errorRate).toBeLessThan(5);
      expect(p95).toBeLessThan(500);

      console.log(`Recommendation API (n=${concurrentUsers}):`);
      console.log(`  Avg response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
    });

    it('should handle 100 concurrent recommendation requests', async () => {
      const concurrentUsers = 100;
      const promises: Promise<Response>[] = [];
      const responseTimes: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          (async () => {
            const startTime = performance.now();
            try {
              const response = await fetch(`http://localhost:3000/api/vendors/${testVendorId}/recommendations`, {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              
              if (!response.ok) {
                errors.push(response.status);
              }
              
              return response;
            } catch (error) {
              errors.push(500);
              throw error;
            }
          })()
        );
      }

      await Promise.allSettled(promises);

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const errorRate = (errors.length / concurrentUsers) * 100;

      expect(errorRate).toBeLessThan(10);
      expect(p95).toBeLessThan(1000);

      console.log(`Recommendation API Heavy Load (n=${concurrentUsers}):`);
      console.log(`  Avg response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`  99th percentile: ${p99.toFixed(2)}ms`);
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
    });
  });

  describe('Analytics API Load Tests', () => {
    it('should handle 50 concurrent analytics requests', async () => {
      const concurrentUsers = 50;
      const promises: Promise<Response>[] = [];
      const responseTimes: number[] = [];
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          (async () => {
            const startTime = performance.now();
            try {
              const response = await fetch('http://localhost:3000/api/intelligence/analytics/asset-performance', {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              const endTime = performance.now();
              responseTimes.push(endTime - startTime);
              
              if (!response.ok) {
                errors.push(response.status);
              }
              
              return response;
            } catch (error) {
              errors.push(500);
              throw error;
            }
          })()
        );
      }

      await Promise.allSettled(promises);

      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const sorted = responseTimes.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const errorRate = (errors.length / concurrentUsers) * 100;

      expect(errorRate).toBeLessThan(5);
      expect(p95).toBeLessThan(1500); // Analytics can be slightly slower

      console.log(`Analytics API (n=${concurrentUsers}):`);
      console.log(`  Avg response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
      console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
    });
  });

  describe('Mixed Load Tests', () => {
    it('should handle mixed API requests from 100 concurrent users', async () => {
      const concurrentUsers = 100;
      const promises: Promise<Response>[] = [];
      const responseTimes: { [key: string]: number[] } = {
        prediction: [],
        recommendation: [],
        analytics: [],
      };
      const errors: number[] = [];

      for (let i = 0; i < concurrentUsers; i++) {
        // Distribute requests across different endpoints
        const endpoint = i % 3;
        
        if (endpoint === 0) {
          // Prediction request
          promises.push(
            (async () => {
              const startTime = performance.now();
              try {
                const response = await fetch(`http://localhost:3000/api/auctions/${testAuctionId}/prediction`, {
                  headers: { 'Authorization': `Bearer ${authToken}` },
                });
                const endTime = performance.now();
                responseTimes.prediction.push(endTime - startTime);
                if (!response.ok) errors.push(response.status);
                return response;
              } catch (error) {
                errors.push(500);
                throw error;
              }
            })()
          );
        } else if (endpoint === 1) {
          // Recommendation request
          promises.push(
            (async () => {
              const startTime = performance.now();
              try {
                const response = await fetch(`http://localhost:3000/api/vendors/${testVendorId}/recommendations`, {
                  headers: { 'Authorization': `Bearer ${authToken}` },
                });
                const endTime = performance.now();
                responseTimes.recommendation.push(endTime - startTime);
                if (!response.ok) errors.push(response.status);
                return response;
              } catch (error) {
                errors.push(500);
                throw error;
              }
            })()
          );
        } else {
          // Analytics request
          promises.push(
            (async () => {
              const startTime = performance.now();
              try {
                const response = await fetch('http://localhost:3000/api/intelligence/analytics/asset-performance', {
                  headers: { 'Authorization': `Bearer ${authToken}` },
                });
                const endTime = performance.now();
                responseTimes.analytics.push(endTime - startTime);
                if (!response.ok) errors.push(response.status);
                return response;
              } catch (error) {
                errors.push(500);
                throw error;
              }
            })()
          );
        }
      }

      await Promise.allSettled(promises);

      const errorRate = (errors.length / concurrentUsers) * 100;
      expect(errorRate).toBeLessThan(10);

      console.log(`Mixed Load Test (n=${concurrentUsers}):`);
      
      Object.entries(responseTimes).forEach(([endpoint, times]) => {
        if (times.length > 0) {
          const avg = times.reduce((a, b) => a + b, 0) / times.length;
          const sorted = times.sort((a, b) => a - b);
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          
          console.log(`  ${endpoint}:`);
          console.log(`    Requests: ${times.length}`);
          console.log(`    Avg: ${avg.toFixed(2)}ms`);
          console.log(`    95th percentile: ${p95.toFixed(2)}ms`);
        }
      });
      
      console.log(`  Overall error rate: ${errorRate.toFixed(2)}%`);
    });
  });
});
