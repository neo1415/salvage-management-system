import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: vi.fn(),
}));

// Mock audit logger
vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    PAYMENT_INITIATED: 'payment_initiated',
  },
  AuditEntityType: {
    PAYMENT: 'payment',
  },
  getDeviceTypeFromUserAgent: vi.fn(() => 'desktop'),
  getIpAddress: vi.fn(() => '127.0.0.1'),
}));

/**
 * Integration tests for wallet payment confirmation endpoint
 * 
 * Tests:
 * 1. Successfully confirm wallet payment with valid data
 * 2. Reject confirmation with invalid payment method
 * 3. Reject confirmation with invalid escrow status
 * 4. Reject confirmation with insufficient frozen funds
 * 5. Reject confirmation for non-existent payment
 * 6. Reject confirmation for payment not belonging to vendor
 * 7. Reject confirmation with invalid payment status
 * 8. Reject confirmation with missing vendorId
 * 9. Reject confirmation with invalid payment ID format
 */

describe('POST /api/payments/[id]/confirm-wallet', () => {
  let testUserId: string;
  let testVendorId: string;
  let testCaseId: string;
  let testAuctionId: string;
  let testPaymentId: string;
  let testWalletId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: 'test-vendor@example.com',
        phone: '+2348012345678',
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        fullName: 'Test Vendor',
        role: 'vendor',
        status: 'verified_tier_1',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier1',
        kycStatus: 'approved',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test wallet with frozen funds
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId: testVendorId,
        balance: '500000.00',
        availableBalance: '100000.00',
        frozenAmount: '400000.00',
      })
      .returning();
    testWalletId = wallet.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CLAIM-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '5000000',
        estimatedSalvageValue: '2000000',
        locationName: 'Lagos',
        locationCoordinates: { lat: 6.5244, lng: 3.3792 },
        status: 'approved',
        photos: [],
      })
      .returning();
    testCaseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startingBid: '1000000',
        currentBid: '400000',
        reservePrice: '1500000',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        status: 'closed',
        winningVendorId: testVendorId,
      })
      .returning();
    testAuctionId = auction.id;

    // Create test payment with escrow_wallet method
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: '400000.00',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })
      .returning();
    testPaymentId = payment.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testPaymentId) {
      await db.delete(payments).where(eq(payments.id, testPaymentId));
    }
    if (testAuctionId) {
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testWalletId) {
      await db.delete(escrowWallets).where(eq(escrowWallets.id, testWalletId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should successfully confirm wallet payment with valid data', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.payment.id).toBe(testPaymentId);
    expect(data.payment.status).toBe('pending');
    expect(data.payment.escrowStatus).toBe('frozen');
    expect(data.payment.amount).toBe(400000);
    expect(data.wallet.frozenAmount).toBe(400000);
    expect(data.documentsUrl).toContain('/vendor/documents');
  });

  it('should reject confirmation with invalid payment method', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    // Update payment to use different payment method
    await db
      .update(payments)
      .set({ paymentMethod: 'paystack' })
      .where(eq(payments.id, testPaymentId));

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid payment method');
  });

  it('should reject confirmation with invalid escrow status', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    // Update payment to have different escrow status
    await db
      .update(payments)
      .set({ escrowStatus: 'released' })
      .where(eq(payments.id, testPaymentId));

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid escrow status');
  });

  it('should reject confirmation with insufficient frozen funds', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    // Update wallet to have insufficient frozen funds
    await db
      .update(escrowWallets)
      .set({ frozenAmount: '100000.00' })
      .where(eq(escrowWallets.id, testWalletId));

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Insufficient frozen funds');
    expect(data.details.required).toBe(400000);
    expect(data.details.available).toBe(100000);
    expect(data.details.shortfall).toBe(300000);
  });

  it('should reject confirmation for non-existent payment', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    const fakePaymentId = '00000000-0000-0000-0000-000000000000';

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: fakePaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Payment not found');
  });

  it('should reject confirmation for payment not belonging to vendor', async () => {
    // Create another vendor
    const [otherUser] = await db
      .insert(users)
      .values({
        email: 'other-vendor@example.com',
        phone: '+2348087654321',
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
        fullName: 'Other Vendor',
        role: 'vendor',
        status: 'verified_tier_1',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    const [otherVendor] = await db
      .insert(vendors)
      .values({
        userId: otherUser.id,
        businessName: 'Other Vendor Business',
        tier: 'tier1',
        kycStatus: 'approved',
      })
      .returning();

    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: otherUser.id },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: otherVendor.id,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Payment does not belong to vendor');

    // Clean up
    await db.delete(vendors).where(eq(vendors.id, otherVendor.id));
    await db.delete(users).where(eq(users.id, otherUser.id));
  });

  it('should reject confirmation with invalid payment status', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    // Update payment to verified status
    await db
      .update(payments)
      .set({ status: 'verified' })
      .where(eq(payments.id, testPaymentId));

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Payment status is verified');
  });

  it('should reject confirmation with missing vendorId', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: testPaymentId }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Vendor ID is required');
  });

  it('should reject confirmation with invalid payment ID format', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/confirm-wallet/route');
    
    const request = new NextRequest('http://localhost:3000/api/payments/test/confirm-wallet', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: testVendorId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid-id' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid payment ID format');
  });
});
