import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

// Mock notification services to prevent actual SMS/email sending
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-sms-id' }),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-email-id' }),
  },
}));

// Mock Cloudinary upload
vi.mock('@/lib/storage/cloudinary', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    publicId: 'payment-proofs/test-payment/receipt.jpg',
    url: 'https://res.cloudinary.com/test/image/upload/v1234567890/payment-proofs/test-payment/receipt.jpg',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/v1234567890/payment-proofs/test-payment/receipt.jpg',
    format: 'jpg',
    width: 1024,
    height: 768,
    bytes: 102400,
    createdAt: new Date().toISOString(),
  }),
  validateFile: vi.fn().mockReturnValue({ valid: true }),
}));

/**
 * Integration Test: Bank Transfer Payment Proof Upload
 * 
 * Tests the bank transfer payment flow:
 * 1. Upload payment proof (receipt/screenshot)
 * 2. Set payment status to pending
 * 3. Notify Finance Officers
 * 
 * Requirements: 25 (Bank Transfer Payment)
 */

describe('Bank Transfer Payment Integration', () => {
  let testUser: any;
  let testVendor: any;
  let testCase: any;
  let testAuction: any;
  let testPayment: any;
  let financeOfficer: any;

  beforeAll(async () => {
    // Create test user (vendor)
    [testUser] = await db
      .insert(users)
      .values({
        email: `test-bank-transfer-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'test-hash',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Bank Transfer Vendor',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    // Create finance officer for notifications
    [financeOfficer] = await db
      .insert(users)
      .values({
        email: `finance-officer-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'test-hash',
        role: 'finance_officer',
        status: 'verified_tier_1',
        fullName: 'Test Finance Officer',
        dateOfBirth: new Date('1985-01-01'),
      })
      .returning();

    // Create test vendor
    [testVendor] = await db
      .insert(vendors)
      .values({
        userId: testUser.id,
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
      })
      .returning();

    // Create test case
    [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `CLM-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '5000000',
        estimatedSalvageValue: '1500000',
        reservePrice: '1050000',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['front damage'],
          confidenceScore: 85,
          damagePercentage: 30,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792],
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: testUser.id,
      })
      .returning();

    // Create test auction
    [testAuction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        currentBid: '1200000',
        currentBidder: testVendor.id,
        minimumIncrement: '10000',
        status: 'closed',
        watchingCount: 5,
      })
      .returning();

    // Create test payment
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + 24);

    [testPayment] = await db
      .insert(payments)
      .values({
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        amount: '1200000',
        paymentMethod: 'bank_transfer',
        status: 'pending',
        paymentDeadline,
      })
      .returning();
  });

  afterAll(async () => {
    // Clean up test data (delete in reverse order of creation to avoid FK constraints)
    // Delete audit logs first
    const { auditLogs } = await import('@/lib/db/schema/audit-logs');
    
    if (testUser) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, testUser.id));
    }
    if (financeOfficer) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, financeOfficer.id));
    }
    
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
    if (financeOfficer) {
      await db.delete(users).where(eq(users.id, financeOfficer.id));
    }
  });

  it('should upload payment proof and set status to pending', async () => {
    // Import the POST handler
    const { POST } = await import('@/app/api/payments/[id]/upload-proof/route');

    // Create mock file
    const mockFile = new File(['mock receipt content'], 'receipt.jpg', { type: 'image/jpeg' });
    
    // Create form data
    const formData = new FormData();
    formData.append('file', mockFile);
    formData.append('userId', testUser.id);

    // Create mock request
    const mockRequest = {
      formData: async () => formData,
      headers: {
        get: (name: string) => {
          if (name === 'x-forwarded-for') return '127.0.0.1';
          if (name === 'user-agent') return 'Mozilla/5.0 (Mobile)';
          return null;
        },
      },
    } as any;

    // Call the API
    const response = await POST(mockRequest, { params: Promise.resolve({ id: testPayment.id }) });
    const data = await response.json();

    // Verify response
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Payment proof uploaded successfully');
    expect(data.payment).toBeDefined();
    expect(data.payment.status).toBe('pending');
    expect(data.payment.paymentProofUrl).toBeDefined();

    // Verify database update
    const [updatedPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, testPayment.id))
      .limit(1);

    expect(updatedPayment.status).toBe('pending');
    expect(updatedPayment.paymentProofUrl).toBeDefined();
    expect(updatedPayment.paymentProofUrl).toContain('cloudinary.com');
  });

  it('should reject upload if file is missing', async () => {
    const { POST } = await import('@/app/api/payments/[id]/upload-proof/route');

    // Create form data without file
    const formData = new FormData();
    formData.append('userId', testUser.id);

    const mockRequest = {
      formData: async () => formData,
      headers: {
        get: () => null,
      },
    } as any;

    const response = await POST(mockRequest, { params: Promise.resolve({ id: testPayment.id }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Payment proof file is required');
  });

  it('should reject upload if payment not found', async () => {
    const { POST } = await import('@/app/api/payments/[id]/upload-proof/route');

    const mockFile = new File(['mock receipt content'], 'receipt.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', mockFile);
    formData.append('userId', testUser.id);

    const mockRequest = {
      formData: async () => formData,
      headers: {
        get: () => null,
      },
    } as any;

    // Use a valid UUID format that doesn't exist in database
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const response = await POST(mockRequest, { params: Promise.resolve({ id: nonExistentId }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('Payment not found');
  });

  it('should reject upload if user does not own the payment', async () => {
    const { POST } = await import('@/app/api/payments/[id]/upload-proof/route');

    // Create another user
    const [anotherUser] = await db
      .insert(users)
      .values({
        email: `another-user-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'test-hash',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Another User',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    try {
      const mockFile = new File(['mock receipt content'], 'receipt.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);
      formData.append('userId', anotherUser.id);

      const mockRequest = {
        formData: async () => formData,
        headers: {
          get: () => null,
        },
      } as any;

      const response = await POST(mockRequest, { params: Promise.resolve({ id: testPayment.id }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    } finally {
      // Clean up - delete audit logs first
      const { auditLogs } = await import('@/lib/db/schema/audit-logs');
      await db.delete(auditLogs).where(eq(auditLogs.userId, anotherUser.id));
      await db.delete(users).where(eq(users.id, anotherUser.id));
    }
  });
});
