import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { POST } from '@/app/api/payments/[id]/verify/route';
import { NextRequest } from 'next/server';

describe('Manual Payment Verification API', () => {
  let financeOfficerId: string;
  let vendorId: string;
  let vendorUserId: string;
  let caseId: string;
  let auctionId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Generate unique identifiers for this test run
    const timestamp = Date.now();
    
    // Create Finance Officer
    const [financeOfficer] = await db
      .insert(users)
      .values({
        email: `finance-${timestamp}@test.com`,
        phone: `+234801234${timestamp.toString().slice(-4)}`,
        passwordHash: 'hashed_password',
        role: 'finance_officer',
        status: 'verified_tier_1',
        fullName: 'Finance Officer',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    financeOfficerId = financeOfficer.id;

    // Create Vendor User
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-${timestamp}@test.com`,
        phone: `+234808765${timestamp.toString().slice(-4)}`,
        passwordHash: 'hashed_password',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1985-05-15'),
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create Vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        tier: 'tier1_bvn',
        status: 'approved',
        bankAccountNumber: '0123456789',
        bankName: 'Test Bank',
        bankAccountName: 'Test Vendor',
      })
      .returning();
    vendorId = vendor.id;

    // Create Case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `CLM-TEST-${timestamp}`,
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '5000000',
        estimatedSalvageValue: '2000000',
        reservePrice: '1400000',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['front damage'],
          confidenceScore: 85,
          damagePercentage: 40,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792] as [number, number],
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: vendorUserId,
      })
      .returning();
    caseId = testCase.id;

    // Create Auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        currentBid: '1500000',
        currentBidder: vendorId,
        minimumIncrement: '10000',
        status: 'closed',
        watchingCount: 5,
      })
      .returning();
    auctionId = auction.id;

    // Create Payment
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '1500000',
        paymentMethod: 'bank_transfer',
        paymentProofUrl: 'https://example.com/proof.jpg',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    paymentId = payment.id;
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    // Delete audit logs first (they reference users)
    if (financeOfficerId) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, financeOfficerId));
    }
    if (vendorUserId) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, vendorUserId));
    }
    
    if (paymentId) {
      await db.delete(payments).where(eq(payments.id, paymentId));
    }
    if (auctionId) {
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }
    if (caseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    }
    if (vendorId) {
      await db.delete(vendors).where(eq(vendors.id, vendorId));
    }
    if (vendorUserId) {
      await db.delete(users).where(eq(users.id, vendorUserId));
    }
    if (financeOfficerId) {
      await db.delete(users).where(eq(users.id, financeOfficerId));
    }
  });

  beforeEach(async () => {
    // Reset payment status before each test
    await db
      .update(payments)
      .set({
        status: 'pending',
        verifiedBy: null,
        verifiedAt: null,
      })
      .where(eq(payments.id, paymentId));
  });

  it('should approve payment and generate pickup authorization', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Payment verified successfully');
    expect(data.payment.status).toBe('verified');
    expect(data.payment.verifiedBy).toBe(financeOfficerId);
    expect(data.payment.pickupAuthCode).toMatch(/^NEM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Verify database update
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    expect(updatedPayment.status).toBe('verified');
    expect(updatedPayment.verifiedBy).toBe(financeOfficerId);
    expect(updatedPayment.verifiedAt).toBeTruthy();
    expect(updatedPayment.autoVerified).toBe(false);

    // Verify audit log
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, paymentId))
      .orderBy(auditLogs.createdAt);

    const verificationLog = logs.find((log) => log.actionType === 'payment_verified');
    expect(verificationLog).toBeTruthy();
    expect(verificationLog?.userId).toBe(financeOfficerId);
  }, 15000); // 15 second timeout for notification sending

  it('should reject payment with reason', async () => {
    const rejectionReason = 'Bank details do not match. Please resubmit with correct account information.';

    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'reject',
        comment: rejectionReason,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Payment rejected');
    expect(data.payment.status).toBe('rejected');
    expect(data.payment.verifiedBy).toBe(financeOfficerId);

    // Verify database update
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    expect(updatedPayment.status).toBe('rejected');
    expect(updatedPayment.verifiedBy).toBe(financeOfficerId);
    expect(updatedPayment.verifiedAt).toBeTruthy();

    // Verify audit log
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, paymentId))
      .orderBy(auditLogs.createdAt);

    const rejectionLog = logs.find((log) => log.actionType === 'payment_rejected');
    expect(rejectionLog).toBeTruthy();
    expect(rejectionLog?.userId).toBe(financeOfficerId);
  }, 15000); // 15 second timeout for notification sending

  it('should fail if Finance Officer ID is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Finance Officer ID is required');
  });

  it('should fail if action is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'invalid_action',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Action must be either "approve" or "reject"');
  });

  it('should fail if rejection comment is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'reject',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Comment is required for rejection and must be at least 10 characters');
  });

  it('should fail if rejection comment is too short', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'reject',
        comment: 'Too short',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Comment is required for rejection and must be at least 10 characters');
  });

  it('should fail if user is not a Finance Officer', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId: vendorUserId, // Using vendor user ID instead
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized: User is not a Finance Officer');
  });

  it('should fail if payment is already verified', async () => {
    // First, verify the payment
    await db
      .update(payments)
      .set({
        status: 'verified',
        verifiedBy: financeOfficerId,
        verifiedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: paymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Payment is already verified');
  });

  it('should fail if payment ID is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid-uuid' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid payment ID format');
  });

  it('should fail if payment does not exist', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    const request = new NextRequest('http://localhost:3000/api/payments/test/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        financeOfficerId,
        action: 'approve',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: nonExistentId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Payment not found');
  });
});

