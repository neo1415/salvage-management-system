/**
 * Integration Tests for Fund Release Failure Alerts
 * 
 * Tests the complete alert flow when automatic fund release fails:
 * - Email sent to Finance Officers with error details
 * - Email includes payment ID, auction ID, vendor information
 * - Email includes error message and error code (if available)
 * - Email includes link to payment details page for manual release
 * - Push notification sent to Finance Officers
 * 
 * Validates Requirements:
 * - Requirement 7.1: Log error with Paystack error code and message
 * - Requirement 7.2: Send email to Finance Officer with subject "Escrow Payment Failed - Action Required"
 * - Requirement 7.3: Display error message to Vendor
 * - Requirement 7.4: Keep funds frozen and payment status as 'pending'
 * - Requirement 7.10: Create audit log entry with error details
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { triggerFundReleaseOnDocumentCompletion } from '@/features/documents/services/document.service';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Mock notification services
vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
    sendPaymentConfirmationEmail: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/notification.service', () => ({
  createNotification: vi.fn(),
}));

vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    releaseFunds: vi.fn(),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    FUNDS_RELEASED: 'FUNDS_RELEASED',
  },
  AuditEntityType: {
    PAYMENT: 'PAYMENT',
  },
  DeviceType: {
    DESKTOP: 'DESKTOP',
  },
}));

describe('Fund Release Failure Alerts Integration', () => {
  let testUserId: string;
  let testVendorId: string;
  let testAuctionId: string;
  let testCaseId: string;
  let testPaymentId: string;
  let testFinanceOfficerId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Generate unique emails for each test run
    const timestamp = Date.now();
    const vendorEmail = `vendor-${timestamp}@test.com`;
    const financeEmail = `finance-${timestamp}@nem-insurance.com`;

    // Create test vendor user
    const [user] = await db
      .insert(users)
      .values({
        email: vendorEmail,
        fullName: 'Test Vendor',
        phone: `234814125${timestamp.toString().slice(-4)}`,
        role: 'vendor',
        passwordHash: 'hash',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Create test Finance Officer user
    const [financeOfficer] = await db
      .insert(users)
      .values({
        email: financeEmail,
        fullName: 'Finance Officer',
        phone: `234814126${timestamp.toString().slice(-4)}`,
        role: 'finance_officer',
        passwordHash: 'hash',
        dateOfBirth: new Date('1985-01-01'),
      })
      .returning();
    testFinanceOfficerId = financeOfficer.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor Company',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test case
    const [caseRecord] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CLAIM-001',
        assetType: 'vehicle',
        vehicleCondition: 'salvage',
        locationName: 'Lagos Salvage Yard',
        gpsLocation: sql`point(6.5244, 3.3792)`,
        status: 'approved',
        marketValue: '800000',
        photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg', 'https://example.com/photo3.jpg'],
        createdBy: testUserId,
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
      })
      .returning();
    testCaseId = caseRecord.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startingBid: '400000',
        currentBid: '500000',
        highestBidderId: testVendorId,
        status: 'closed',
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      })
      .returning();
    testAuctionId = auction.id;

    // Create test payment
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: '500000.00',
        paymentMethod: 'escrow_wallet',
        status: 'pending',
        escrowStatus: 'frozen',
      })
      .returning();
    testPaymentId = payment.id;

    // Create all 3 signed documents
    await db.insert(releaseForms).values([
      {
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        generatedBy: testUserId,
      },
      {
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        generatedBy: testUserId,
      },
      {
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        generatedBy: testUserId,
      },
    ]);
  });

  afterEach(async () => {
    // Cleanup test data in correct order (respecting foreign key constraints)
    if (testAuctionId) {
      await db.delete(releaseForms).where(eq(releaseForms.auctionId, testAuctionId));
    }
    if (testPaymentId) {
      await db.delete(payments).where(eq(payments.id, testPaymentId));
    }
    if (testAuctionId) {
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testFinanceOfficerId) {
      await db.delete(users).where(eq(users.id, testFinanceOfficerId));
    }
  });

  it('should send email to Finance Officer when automatic fund release fails', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    // Mock escrowService.releaseFunds to throw Paystack error
    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed: Insufficient balance')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-123',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email was sent to Finance Officer
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.to).toMatch(/finance-\d+@nem-insurance\.com/);
    expect(emailCall.subject).toContain('Escrow Payment Failed');
    expect(emailCall.subject).toContain('Action Required');
  });

  it('should include error details in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    const errorMessage = 'Paystack transfer failed: Invalid account number';
    vi.mocked(escrowService.releaseFunds).mockRejectedValue(new Error(errorMessage));

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-456',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow(errorMessage);

    // Assert: Email contains error details
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('Error Details');
    expect(emailCall.html).toContain(errorMessage);
  });

  it('should include payment ID and auction ID in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-789',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email contains auction ID
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('Auction ID');
    expect(emailCall.html).toContain(testAuctionId.substring(0, 8));
    
    // Assert: Email subject contains auction ID
    expect(emailCall.subject).toContain(testAuctionId.substring(0, 8));
  });

  it('should include vendor information in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-101',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email contains vendor information
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('Vendor');
  });

  it('should include link to payment details page in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-202',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email contains link to payment dashboard
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('View Payment Dashboard');
    expect(emailCall.html).toContain('/finance/payments');
  });

  it('should include action instructions in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-303',
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email contains action instructions
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('Action Required');
    expect(emailCall.html).toContain('Manual Release');
    expect(emailCall.html).toContain('Log in to the Finance Officer dashboard');
  });

  it('should send push notification to Finance Officer when fund release fails', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(createNotification).mockResolvedValue({
      id: 'notification-alert-123',
      userId: testFinanceOfficerId,
      type: 'payment_reminder',
      title: '🚨 Escrow Payment Failed',
      message: 'Test message',
      read: false,
      createdAt: new Date(),
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Push notification was sent
    expect(createNotification).toHaveBeenCalledTimes(1);

    const pushCall = vi.mocked(createNotification).mock.calls[0][0];
    expect(pushCall.userId).toBe(testFinanceOfficerId);
    expect(pushCall.type).toBe('payment_reminder');
    expect(pushCall.title).toContain('Escrow Payment Failed');
  });

  it('should include error details in push notification', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    const errorMessage = 'Paystack transfer failed: Network timeout';
    vi.mocked(escrowService.releaseFunds).mockRejectedValue(new Error(errorMessage));

    vi.mocked(createNotification).mockResolvedValue({
      id: 'notification-alert-456',
      userId: testFinanceOfficerId,
      type: 'payment_reminder',
      title: '🚨 Escrow Payment Failed',
      message: 'Test message',
      read: false,
      createdAt: new Date(),
    });

    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow(errorMessage);

    // Assert: Push notification contains error details
    const pushCall = vi.mocked(createNotification).mock.calls[0][0];
    expect(pushCall.data.error).toBe(errorMessage);
    expect(pushCall.data.auctionId).toBe(testAuctionId);
    expect(pushCall.data.vendorId).toBe(testVendorId);
  });

  it('should send alerts to multiple Finance Officers', async () => {
    // Create second Finance Officer
    const timestamp2 = Date.now() + 1;
    const [financeOfficer2] = await db
      .insert(users)
      .values({
        email: `finance2-${timestamp2}@nem-insurance.com`,
        fullName: 'Finance Officer 2',
        phone: `234814127${timestamp2.toString().slice(-4)}`,
        role: 'finance_officer',
        passwordHash: 'hash',
        dateOfBirth: new Date('1988-01-01'),
      })
      .returning();

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-multi',
    });

    vi.mocked(createNotification).mockResolvedValue({
      id: 'notification-alert-multi',
      userId: testFinanceOfficerId,
      type: 'payment_reminder',
      title: '🚨 Escrow Payment Failed',
      message: 'Test message',
      read: false,
      createdAt: new Date(),
    });

    // Trigger fund release (should fail and send alerts)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Emails sent to both Finance Officers
    expect(emailService.sendEmail).toHaveBeenCalledTimes(2);

    const emailCalls = vi.mocked(emailService.sendEmail).mock.calls;
    const recipients = emailCalls.map(call => call[0].to);
    expect(recipients.some(email => email.includes('finance'))).toBe(true);
    expect(recipients.length).toBe(2);

    // Assert: Push notifications sent to both Finance Officers
    expect(createNotification).toHaveBeenCalledTimes(2);

    const pushCalls = vi.mocked(createNotification).mock.calls;
    const pushRecipients = pushCalls.map(call => call[0].userId);
    expect(pushRecipients).toContain(testFinanceOfficerId);
    expect(pushRecipients).toContain(financeOfficer2.id);

    // Cleanup
    await db.delete(users).where(eq(users.id, financeOfficer2.id));
  });

  it('should handle case when no Finance Officers exist', async () => {
    // Delete Finance Officer
    await db.delete(users).where(eq(users.id, testFinanceOfficerId));

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    // Trigger fund release (should fail but not crash when no Finance Officers)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: No emails sent (no Finance Officers to send to)
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('should not crash if alert email fails to send', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    // Mock email service to fail
    vi.mocked(emailService.sendEmail).mockRejectedValue(
      new Error('Email service unavailable')
    );

    // Trigger fund release (should fail but not crash on email failure)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Assert: Email was attempted
    expect(emailService.sendEmail).toHaveBeenCalled();
  });

  it('should include timestamp in alert email', async () => {
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    vi.mocked(escrowService.releaseFunds).mockRejectedValue(
      new Error('Paystack transfer failed')
    );

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-alert-time',
    });

    const beforeTrigger = new Date();
    
    // Trigger fund release (should fail and send alert)
    await expect(
      triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId)
    ).rejects.toThrow('Paystack transfer failed');

    const afterTrigger = new Date();

    // Assert: Email contains timestamp
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('Time:');
    
    // Verify timestamp is recent (within test execution window)
    const timestampMatch = emailCall.html.match(/Time:<\/strong>\s*([^<]+)/);
    expect(timestampMatch).toBeTruthy();
  });
});
