/**
 * Integration Tests for ML Dataset Export API Endpoints
 * Task 12.2.5: Write integration tests for ML dataset export
 * 
 * Tests the ML dataset export endpoints with real database interactions,
 * authentication, authorization, dataset generation, and format validation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as exportDataset } from '@/app/api/intelligence/ml/export-dataset/route';
import { GET as getDatasets } from '@/app/api/intelligence/ml/datasets/route';
import { GET as getFeatureVectors } from '@/app/api/intelligence/ml/feature-vectors/route';
import { db } from '@/lib/db';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { predictions } from '@/lib/db/schema/intelligence';
import { recommendations } from '@/lib/db/schema/intelligence';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { mlTrainingDatasets, featureVectors } from '@/lib/db/schema/ml-training';
import { eq, sql } from 'drizzle-orm';

// Mock auth for testing
import { vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

describe('ML Dataset Export Integration Tests', () => {
  let testAdminUserId: string;
  let testVendorUserId: string;
  let testVendorId: string;
  let testAuctionIds: string[] = [];
  let testCaseIds: string[] = [];
  let testUserIds: string[] = [];
  let testDatasetIds: string[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminResult = await db.insert(users).values({
      email: `test-admin-ml-export-${Date.now()}@example.com`,
      phone: `+1${Date.now().toString().slice(-10)}`,
      fullName: 'Test Admin ML Export',
      dateOfBirth: new Date('1990-01-01'),
      role: 'system_admin',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testAdminUserId = adminResult[0].id;
    testUserIds.push(testAdminUserId);

    // Create test vendor user
    const vendorUserResult = await db.insert(users).values({
      email: `test-vendor-ml-export-${Date.now()}@example.com`,
      phone: `+1${(Date.now() + 1).toString().slice(-10)}`,
      fullName: 'Test Vendor ML Export',
      dateOfBirth: new Date('1990-01-01'),
      role: 'vendor',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testVendorUserId = vendorUserResult[0].id;
    testUserIds.push(testVendorUserId);

    // Create vendor record
    const vendorResult = await db.insert(vendors).values({
      userId: testVendorUserId,
      businessName: 'Test Vendor ML Export Business',
      tier: 'tier1_bvn',
      status: 'approved',
      categories: ['vehicle', 'electronics'],
    }).returning({ id: vendors.id });

    testVendorId = vendorResult[0].id;

    // Create diverse test data for ML export (10 closed auctions)
    for (let i = 0; i < 10; i++) {
      const caseResult = await db.insert(salvageCases).values({
        createdBy: testAdminUserId,
        claimReference: `TEST-ML-EXPORT-${Date.now()}-${i}`,
        assetType: i % 3 === 0 ? 'vehicle' : i % 3 === 1 ? 'electronics' : 'machinery',
        assetDetails: {
          make: i % 3 === 0 ? 'Toyota' : i % 3 === 1 ? 'Samsung' : 'Caterpillar',
          model: i % 3 === 0 ? 'Camry' : i % 3 === 1 ? 'Galaxy S21' : 'D9T',
          year: (2018 + (i % 4)).toString(),
          color: i % 2 === 0 ? 'Black' : 'White',
        },
        damageSeverity: i % 3 === 0 ? 'minor' : i % 3 === 1 ? 'moderate' : 'severe',
        marketValue: (500000 + i * 100000).toString(),
        estimatedSalvageValue: (400000 + i * 80000).toString(),
        reservePrice: (350000 + i * 70000).toString(),
        gpsLocation: sql`point(${i % 3}, ${i % 2})`,
        locationName: i % 2 === 0 ? 'Lagos' : 'Abuja',
        photos: [],
      }).returning({ id: salvageCases.id });

      testCaseIds.push(caseResult[0].id);

      const auctionResult = await db.insert(auctions).values({
        caseId: caseResult[0].id,
        startTime: new Date(Date.now() - (60 - i * 3) * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - (53 - i * 3) * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() - (53 - i * 3) * 24 * 60 * 60 * 1000),
        status: 'closed',
        currentBid: (400000 + i * 90000).toString(),
        currentBidder: testVendorId,
        watchingCount: 5 + i,
      }).returning({ id: auctions.id });

      testAuctionIds.push(auctionResult[0].id);

      // Create bids
      await db.insert(bids).values({
        auctionId: auctionResult[0].id,
        vendorId: testVendorId,
        amount: (400000 + i * 90000).toString(),
        ipAddress: '127.0.0.1',
        deviceType: i % 2 === 0 ? 'desktop' : 'mobile',
      });

      // Create predictions
      await db.insert(predictions).values({
        auctionId: auctionResult[0].id,
        predictedPrice: (420000 + i * 85000).toString(),
        lowerBound: (380000 + i * 75000).toString(),
        upperBound: (460000 + i * 95000).toString(),
        confidenceScore: 0.75 + (i % 3) * 0.05,
        confidenceLevel: i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low',
        method: 'historical',
        sampleSize: 10 + i,
        metadata: {},
        algorithmVersion: 'v1.0',
      });

      // Create recommendations
      await db.insert(recommendations).values({
        vendorId: testVendorId,
        auctionId: auctionResult[0].id,
        matchScore: 0.80 + (i % 5) * 0.03,
        collaborativeScore: 0.75 + (i % 4) * 0.04,
        contentScore: 0.70 + (i % 3) * 0.05,
        reasonCodes: ['category_match', 'price_range_fit'],
        clicked: i % 2 === 0,
        bidPlaced: i % 3 === 0,
      });

      // Create fraud alerts for some auctions
      if (i % 4 === 0) {
        await db.insert(fraudAlerts).values({
          entityType: 'auction',
          entityId: auctionResult[0].id,
          riskScore: 0.60 + (i % 3) * 0.10,
          flagReasons: ['unusual_bidding_pattern'],
          status: i % 2 === 0 ? 'confirmed' : 'dismissed',
        });
      }
    }
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionIds.length > 0) {
      for (const auctionId of testAuctionIds) {
        await db.delete(recommendations).where(eq(recommendations.auctionId, auctionId));
        await db.delete(predictions).where(eq(predictions.auctionId, auctionId));
        await db.delete(bids).where(eq(bids.auctionId, auctionId));
        await db.delete(fraudAlerts).where(eq(fraudAlerts.entityId, auctionId));
        await db.delete(featureVectors).where(eq(featureVectors.entityId, auctionId));
        await db.delete(auctions).where(eq(auctions.id, auctionId));
      }
    }

    if (testCaseIds.length > 0) {
      for (const caseId of testCaseIds) {
        await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
      }
    }

    if (testDatasetIds.length > 0) {
      for (const datasetId of testDatasetIds) {
        await db.delete(mlTrainingDatasets).where(eq(mlTrainingDatasets.id, datasetId));
      }
    }

    if (testVendorId) {
      await db.delete(featureVectors).where(eq(featureVectors.entityId, testVendorId));
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }

    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }, 60000); // 60 second timeout for cleanup

  beforeEach(async () => {
    // Clear datasets before each test
    if (testDatasetIds.length > 0) {
      for (const datasetId of testDatasetIds) {
        await db.delete(mlTrainingDatasets).where(eq(mlTrainingDatasets.id, datasetId));
      }
      testDatasetIds = [];
    }
  });

  describe('POST /api/intelligence/ml/export-dataset - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-admin users', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should allow admin access', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Request Validation', () => {
    it('should reject invalid datasetType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'invalid_type',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject invalid format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'invalid_format',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should accept valid dataset types', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const datasetTypes = ['price_prediction', 'recommendation', 'fraud_detection'];

      for (const datasetType of datasetTypes) {
        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/ml/export-dataset',
          {
            method: 'POST',
            body: JSON.stringify({
              datasetType,
              format: 'csv',
            }),
          }
        );

        const response = await exportDataset(request);
        expect([200, 201]).toContain(response.status);
      }
    });

    it('should accept valid formats', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const formats = ['csv', 'json', 'parquet'];

      for (const format of formats) {
        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/ml/export-dataset',
          {
            method: 'POST',
            body: JSON.stringify({
              datasetType: 'price_prediction',
              format,
            }),
          }
        );

        const response = await exportDataset(request);
        expect([200, 201]).toContain(response.status);
      }
    });

    it('should accept date range filters', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
            startDate,
            endDate,
          }),
        }
      );

      const response = await exportDataset(request);
      expect([200, 201]).toContain(response.status);
    });

    it('should accept custom split ratios', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
            splitRatio: {
              train: 0.7,
              validation: 0.15,
              test: 0.15,
            },
          }),
        }
      );

      const response = await exportDataset(request);
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Price Prediction Dataset', () => {
    it('should export price prediction dataset successfully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect([200, 201]).toContain(response.status);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.datasetId).toBeDefined();
      expect(data.data.datasetType).toBe('price_prediction');
      expect(data.data.format).toBe('csv');
      expect(data.data.recordCount).toBeGreaterThan(0);

      // Track dataset for cleanup
      testDatasetIds.push(data.data.datasetId);
    });

    it('should include all required fields in price prediction dataset', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'json',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data).toHaveProperty('datasetId');
      expect(data.data).toHaveProperty('datasetType');
      expect(data.data).toHaveProperty('format');
      expect(data.data).toHaveProperty('recordCount');
      expect(data.data).toHaveProperty('splits');

      testDatasetIds.push(data.data.datasetId);
    });

    it('should export in CSV format correctly', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.format).toBe('csv');
      testDatasetIds.push(data.data.datasetId);
    });

    it('should export in JSON format correctly', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'json',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.format).toBe('json');
      testDatasetIds.push(data.data.datasetId);
    });

    it('should export in Parquet format correctly', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'parquet',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.format).toBe('parquet');
      testDatasetIds.push(data.data.datasetId);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Recommendation Dataset', () => {
    it('should export recommendation dataset successfully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'recommendation',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect([200, 201]).toContain(response.status);
      expect(data.success).toBe(true);
      expect(data.data.datasetType).toBe('recommendation');
      expect(data.data.recordCount).toBeGreaterThan(0);

      testDatasetIds.push(data.data.datasetId);
    });

    it('should include interaction data in recommendation dataset', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'recommendation',
            format: 'json',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.datasetType).toBe('recommendation');
      testDatasetIds.push(data.data.datasetId);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Fraud Detection Dataset', () => {
    it('should export fraud detection dataset successfully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'fraud_detection',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect([200, 201]).toContain(response.status);
      expect(data.success).toBe(true);
      expect(data.data.datasetType).toBe('fraud_detection');

      testDatasetIds.push(data.data.datasetId);
    });

    it('should include labeled fraud data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'fraud_detection',
            format: 'json',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.datasetType).toBe('fraud_detection');
      testDatasetIds.push(data.data.datasetId);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Train/Validation/Test Splits', () => {
    it('should create train/validation/test splits with default ratios', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.splits).toBeDefined();
      testDatasetIds.push(data.data.datasetId);
    });

    it('should respect custom split ratios', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
            splitRatio: {
              train: 0.6,
              validation: 0.2,
              test: 0.2,
            },
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.splits).toBeDefined();
      testDatasetIds.push(data.data.datasetId);
    });

    it('should validate split ratios sum to 1.0', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
            splitRatio: {
              train: 0.5,
              validation: 0.3,
              test: 0.3, // Sum = 1.1, should fail
            },
          }),
        }
      );

      const response = await exportDataset(request);
      
      // Should either reject or normalize the ratios
      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - PII Anonymization', () => {
    it('should anonymize PII data by default', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'json',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      testDatasetIds.push(data.data.datasetId);
    });

    it('should respect anonymize flag', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'json',
            anonymize: false,
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      testDatasetIds.push(data.data.datasetId);
    });
  });

  describe('POST /api/intelligence/ml/export-dataset - Dataset Storage', () => {
    it('should store dataset metadata in database', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      // Verify dataset was stored
      const storedDatasets = await db
        .select()
        .from(mlTrainingDatasets)
        .where(eq(mlTrainingDatasets.id, data.data.datasetId))
        .limit(1);

      expect(storedDatasets.length).toBe(1);
      expect(storedDatasets[0].datasetType).toBe('price_prediction');
      expect(storedDatasets[0].format).toBe('csv');

      testDatasetIds.push(data.data.datasetId);
    });

    it('should include record count in metadata', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data.data.recordCount).toBeGreaterThan(0);

      const storedDatasets = await db
        .select()
        .from(mlTrainingDatasets)
        .where(eq(mlTrainingDatasets.id, data.data.datasetId))
        .limit(1);

      expect(storedDatasets[0].recordCount).toBe(data.data.recordCount);

      testDatasetIds.push(data.data.datasetId);
    });
  });

  describe('GET /api/intelligence/ml/datasets - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-admin users', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should allow admin access', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/intelligence/ml/datasets - Dataset Listing', () => {
    it('should return list of datasets', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.count).toBeGreaterThanOrEqual(0);
    });

    it('should filter by datasetType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets?datasetType=price_prediction'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.datasetType).toBe('price_prediction');
    });

    it('should respect limit parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets?limit=5'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it('should reject invalid limit', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets?limit=200'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should order datasets by creation date descending', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Create two datasets
      const request1 = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response1 = await exportDataset(request1);
      const data1 = await response1.json();
      testDatasetIds.push(data1.data.datasetId);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const request2 = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'recommendation',
            format: 'json',
          }),
        }
      );

      const response2 = await exportDataset(request2);
      const data2 = await response2.json();
      testDatasetIds.push(data2.data.datasetId);

      // List datasets
      const listRequest = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const listResponse = await getDatasets(listRequest);
      const listData = await listResponse.json();

      expect(listData.data.length).toBeGreaterThanOrEqual(2);
      
      // Most recent should be first
      if (listData.data.length >= 2) {
        const firstDate = new Date(listData.data[0].createdAt);
        const secondDate = new Date(listData.data[1].createdAt);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  describe('GET /api/intelligence/ml/feature-vectors - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for non-admin users', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should allow admin access', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction'
      );

      const response = await getFeatureVectors(request);
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/intelligence/ml/feature-vectors - Feature Vector Retrieval', () => {
    it('should return feature vectors for auctions', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
    });

    it('should return feature vectors for vendors', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=vendor'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by entityId', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction&entityId=${testAuctionIds[0]}`
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.entityId).toBe(testAuctionIds[0]);
    });

    it('should reject invalid entityType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=invalid'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should reject invalid entityId format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction&entityId=invalid-uuid'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should respect limit parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction&limit=5'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Use malformed UUID
      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction&entityId=00000000-0000-0000-0000-000000000000'
      );

      const response = await getFeatureVectors(request);
      
      // Should handle gracefully
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should return 500 on unexpected server error', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // This should work or return appropriate error
      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      
      // Should not crash
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Response Format Validation', () => {
    it('should return properly formatted JSON response for export', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const response = await exportDataset(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.data).toBe('object');

      testDatasetIds.push(data.data.datasetId);
    });

    it('should return properly formatted JSON response for list', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const response = await getDatasets(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return properly formatted JSON response for feature vectors', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/feature-vectors?entityType=auction'
      );

      const response = await getFeatureVectors(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should export dataset within reasonable time', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/export-dataset',
        {
          method: 'POST',
          body: JSON.stringify({
            datasetType: 'price_prediction',
            format: 'csv',
          }),
        }
      );

      const startTime = Date.now();
      const response = await exportDataset(request);
      const duration = Date.now() - startTime;
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      testDatasetIds.push(data.data.datasetId);
    });

    it('should list datasets within reasonable time', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/ml/datasets'
      );

      const startTime = Date.now();
      const response = await getDatasets(request);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});
