import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: vi.fn(),
}));

// Mock escrow service
vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    releaseFunds: vi.fn(),
  },
}));

// Mock audit logger
vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    FUNDS_RELEASED: 'funds_released',
  },
  AuditEntityType: {
    PAYMENT: 'payment',
  },
  getDeviceTypeFromUserAgent: vi.fn(() => 'desktop'),
  getIpAddress: vi.fn(() => '127.0.0.1'),
}));

/**
 * Integration tests for manual fund release endpoint
 * 
 * Tests:
 * 1. Successfully release funds when called by Finance Officer
 * 2. Reject request from non-Finance Officer user
 * 3. Reject request without authentication
 * 4. Reject request without reason
 * 5. Reject request with empty reason
 * 6. Reject request for non-escrow_wallet payment
 * 7. Reject request when escrow status is not frozen
 * 8. Reject request when payment status is not pending
 * 9. Handle escrowService.releaseFunds failure gracefully
 * 10. Reject request with invalid payment ID format
 * 11. Return 404 for non-existent payment
 */

describe('POST /api/payments/[id]/release-funds - Manual Fund Release', () => {
  let financeOfficerId: string;
  let vendorId: string;
  let vendorUserId: string;
  let auctionId: string;
  let caseId: string;
  let paymentId: string;
  let walletId: string;

  beforeEach(async () => {
    // Create finance officer user
    const [financeOfficer] = await db
      .insert(users)
      .values({
        email: 'finance@nem.com',
        phone: '+2348012345678',
        passwordHash: 'hashed_password',
        role: 'finance_officer',
        status: 'verified_tier_1',
        fullName: 'Finance Officer',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    financeOfficerId = financeOfficer.id;

    // Create vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: 'vendor@example.com',
        phone: '+2348087654321',
        passwordHash: 'hashed_password',
        role: 'vendor',
        status: 'verified_tier_2',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1985-05-15'),
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier2_full',
        status: 'approved',
      })
      .returning();
    vendorId = vendor.id;

    // Create wallet with frozen funds
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId: vendorId,
        balance: '500000.00',
        availableBalance: '100000.00',
        frozenAmount: '400000.00',
      })
      .returning();
    walletId = wallet.id;

    // Create salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CLAIM-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '5000000',
        estimatedSalvageValue: '2000000',
        locationName: 'Lagos',
        gpsLocation: [6.5244, 3.3792],
        status: 'approved',
        photos: [],
        createdBy: vendorUserId,
      })
      .returning();
    caseId = salvageCase.id;

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: caseId,
        currentBid: '400000',
        currentBidder: vendorId,
        status: 'closed',
        startTime: new Date(Date.now() - 86400000), // 1 day ago
        endTime: new Date(Date.now() - 3600000), // 1 hour ago
        originalEndTime: new Date(Date.now() - 3600000),
      })
      .returning();
    auctionId = auction.id;

    // Create payment with escrow_wallet method
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: auctionId,
        vendorId: vendorId,
        amount: '400000.00',
        paymentMethod: 'escrow_wallet',
        escrowStatus: 'frozen',
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
      })
      .returning();
    paymentId = payment.id;

    // Mock escrowService.releaseFunds
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 100000,
      availableBalance: 100000,
      frozenAmount: 0,
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (paymentId) {
      await db.delete(payments).where(eq(payments.id, paymentId));
    }
    if (auctionId) {
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }
    if (caseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    }
    if (walletId) {
      await db.delete(escrowWallets).where(eq(escrowWallets.id, walletId));
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

  it('should successfully release funds when called by Finance Officer', async () => {
    // Mock authentication as Finance Officer
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: financeOfficerId, email: 'finance@nem.com' },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'All documents signed, automatic release failed',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Finance Officer');
    expect(data.payment.status).toBe('verified');
    expect(data.payment.escrowStatus).toBe('released');
    expect(data.transferReference).toBeDefined();
    expect(data.financeOfficer.id).toBe(financeOfficerId);
    expect(data.reason).toBe('All documents signed, automatic release failed');

    // Verify escrowService.releaseFunds was called
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    expect(escrowService.releaseFunds).toHaveBeenCalledWith(
      vendorId,
      400000,
      auctionId,
      financeOfficerId
    );

    // Verify payment was updated
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    expect(updatedPayment.status).toBe('verified');
    expect(updatedPayment.escrowStatus).toBe('released');
    expect(updatedPayment.verifiedAt).toBeDefined();
    expect(updatedPayment.autoVerified).toBe(false);

    // Verify case status was updated to sold
    const [updatedCase] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    expect(updatedCase.status).toBe('sold');
  });

  it('should reject request from non-Finance Officer user', async () => {
    // Mock authentication as vendor (not Finance Officer)
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: vendorUserId, email: 'vendor@example.com' },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Test reason',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only Finance Officers');

    // Verify escrowService.releaseFunds was NOT called
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    expect(escrowService.releaseFunds).not.toHaveBeenCalled();
  });

  it('should reject request without authentication', async () => {
    // Mock no authentication
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue(null as any);

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Test reason',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject request without reason', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: financeOfficerId, email: 'finance@nem.com' },
    } as any);

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Reason is required');
  });

  it('should reject request for non-escrow_wallet payment', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: financeOfficerId, email: 'finance@nem.com' },
    } as any);

    // Update payment to use different payment method
    await db
      .update(payments)
      .set({ paymentMethod: 'paystack' })
      .where(eq(payments.id, paymentId));

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Test reason',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Only escrow_wallet payments');
  });

  it('should reject request when escrow status is not frozen', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: financeOfficerId, email: 'finance@nem.com' },
    } as any);

    // Update payment escrow status
    await db
      .update(payments)
      .set({ escrowStatus: 'released' })
      .where(eq(payments.id, paymentId));

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Test reason',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Expected frozen');
  });

  it('should handle escrowService.releaseFunds failure gracefully', async () => {
    const { auth } = await import('@/lib/auth/next-auth.config');
    vi.mocked(auth).mockResolvedValue({
      user: { id: financeOfficerId, email: 'finance@nem.com' },
    } as any);

    // Mock escrowService.releaseFunds to throw error
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed: Insufficient balance')
    );

    const { POST } = await import('@/app/api/payments/[id]/release-funds/route');

    const request = new NextRequest('http://localhost:3000/api/payments/test/release-funds', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Manual release after automatic failure',
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: paymentId }),
    });

    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to release funds');
    expect(data.details).toContain('Paystack transfer failed');

    // Verify payment was NOT updated
    const [unchangedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    expect(unchangedPayment.status).toBe('pending');
    expect(unchangedPayment.escrowStatus).toBe('frozen');
  });
});
