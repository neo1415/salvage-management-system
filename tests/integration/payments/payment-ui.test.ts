import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users, vendors, payments, auctions, salvageCases } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Payment UI Integration Tests', () => {
  let testUser: typeof users.$inferSelect;
  let testVendor: typeof vendors.$inferSelect;
  let testCase: typeof salvageCases.$inferSelect;
  let testAuction: typeof auctions.$inferSelect;
  let testPayment: typeof payments.$inferSelect;

  beforeAll(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: 'payment-test@example.com',
        phone: '+2348012345678',
        passwordHash: await hash('Test123!@#', 12),
        fullName: 'Payment Test User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUser = user;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUser.id,
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
        rating: '4.50',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 100,
          fraudFlags: 0,
        },
      })
      .returning();
    testVendor = vendor;

    // Create test case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CLM-001',
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '2000000',
        estimatedSalvageValue: '500000',
        reservePrice: '350000',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['front damage', 'bumper dent'],
          confidenceScore: 85,
          damagePercentage: 25,
          processedAt: new Date(),
        },
        gpsLocation: [3.3792, 6.5244], // [longitude, latitude] for PostGIS point
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: testUser.id,
        approvedBy: testUser.id,
        approvedAt: new Date(),
      })
      .returning();
    testCase = salvageCase;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        startTime: new Date(),
        endTime: new Date(Date.now() - 1000), // Ended
        originalEndTime: new Date(Date.now() - 1000),
        currentBid: '500000',
        currentBidder: testVendor.id,
        status: 'closed',
      })
      .returning();
    testAuction = auction;

    // Create test payment
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        amount: '500000',
        paymentMethod: 'paystack',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    testPayment = payment;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testPayment) {
      await db.delete(payments).where(eq(payments.id, testPayment.id));
    }
    if (testAuction) {
      await db.delete(auctions).where(eq(auctions.id, testAuction.id));
    }
    if (testCase) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    }
    if (testVendor) {
      await db.delete(vendors).where(eq(vendors.id, testVendor.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  describe('GET /api/payments/[id]', () => {
    it('should fetch payment details successfully', async () => {
      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.id).toBe(testPayment.id);
      expect(data.amount).toBe('500000');
      expect(data.status).toBe('pending');
      expect(data.auction).toBeDefined();
      expect(data.auction.case).toBeDefined();
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await fetch(
        'http://localhost:3000/api/payments/00000000-0000-0000-0000-000000000000',
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/payments/[id]/initiate', () => {
    it('should initiate Paystack payment successfully', async () => {
      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        expect(data.paymentId).toBeDefined();
        expect(data.paymentUrl).toBeDefined();
        expect(data.reference).toBeDefined();
        expect(data.amount).toBe(500000);
        
        // Validate Paystack URL
        const url = new URL(data.paymentUrl);
        expect(['paystack.co', 'paystack.com']).toContain(url.hostname);
      }
    });

    it('should prevent payment initiation for verified payments', async () => {
      // Update payment to verified
      await db
        .update(payments)
        .set({ status: 'verified' })
        .where(eq(payments.id, testPayment.id));

      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}/initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already verified');

      // Reset payment status
      await db
        .update(payments)
        .set({ status: 'pending' })
        .where(eq(payments.id, testPayment.id));
    });
  });

  describe('POST /api/payments/[id]/upload-proof', () => {
    it('should upload payment proof successfully', async () => {
      const formData = new FormData();
      const file = new File(['test content'], 'receipt.jpg', {
        type: 'image/jpeg',
      });
      formData.append('file', file);

      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}/upload-proof`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        expect(data.id).toBe(testPayment.id);
        expect(data.status).toBe('pending');
        expect(data.paymentProofUrl).toBeDefined();
      }
    });

    it('should reject files larger than 5MB', async () => {
      const formData = new FormData();
      // Create a 6MB file
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });
      formData.append('file', largeFile);

      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}/upload-proof`,
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('size');
    });

    it('should reject invalid file types', async () => {
      const formData = new FormData();
      const invalidFile = new File(['test'], 'document.txt', {
        type: 'text/plain',
      });
      formData.append('file', invalidFile);

      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}/upload-proof`,
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('type');
    });

    it('should enforce rate limiting', async () => {
      const formData = new FormData();
      const file = new File(['test'], 'receipt.jpg', {
        type: 'image/jpeg',
      });
      formData.append('file', file);

      // Make 6 requests (limit is 5 per hour)
      const requests = Array.from({ length: 6 }, () =>
        fetch(`http://localhost:3000/api/payments/${testPayment.id}/upload-proof`, {
          method: 'POST',
          body: formData,
        })
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      // Last request should be rate limited
      expect(lastResponse.status).toBe(429);
      const data = await lastResponse.json();
      expect(data.error).toContain('Too many');
    });
  });

  describe('Payment deadline handling', () => {
    it('should handle expired deadlines', async () => {
      // Update payment deadline to past
      await db
        .update(payments)
        .set({
          paymentDeadline: new Date(Date.now() - 1000),
          status: 'overdue',
        })
        .where(eq(payments.id, testPayment.id));

      const response = await fetch(
        `http://localhost:3000/api/payments/${testPayment.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('overdue');

      // Reset payment
      await db
        .update(payments)
        .set({
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
        })
        .where(eq(payments.id, testPayment.id));
    });
  });
});
