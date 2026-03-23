/**
 * Integration Tests for Payment Complete Notifications
 * 
 * Tests the complete notification flow when payment is verified:
 * - SMS with pickup authorization code, location, and deadline
 * - Email with full payment details and pickup instructions
 * - Push notification with pickup information
 * 
 * Validates Requirements:
 * - Requirement 8.5: Send SMS and email when payment is verified
 * - Requirement 8.6: Include pickup authorization code in both notifications
 * - Requirement 8.7: Include pickup location details
 * - Requirement 8.8: Include pickup deadline (48 hours from payment verification)
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
import { eq, and } from 'drizzle-orm';

// Mock notification services
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendPaymentConfirmationEmail: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/notification.service', () => ({
  createNotification: vi.fn(),
}));

vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    releaseFunds: vi.fn().mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    }),
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

describe('Payment Complete Notifications Integration', () => {
  let testUserId: string;
  let testVendorId: string;
  let testAuctionId: string;
  let testCaseId: string;
  let testPaymentId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: 'vendor@test.com',
        fullName: 'Test Vendor',
        phone: '2348141252812',
        role: 'vendor',
        passwordHash: 'hash',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor Company',
        tier: 'tier1_bvn',
        status: 'active',
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
        status: 'approved',
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

    // Mock notification services
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-test-123',
    });

    vi.mocked(emailService.sendPaymentConfirmationEmail).mockResolvedValue({
      success: true,
      messageId: 'email-test-456',
    });

    vi.mocked(createNotification).mockResolvedValue({
      id: 'notification-test-789',
      userId: testUserId,
      type: 'PAYMENT_UNLOCKED',
      title: 'Payment Complete!',
      message: 'Test message',
      read: false,
      createdAt: new Date(),
    });
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
  });

  it('should send SMS with pickup authorization code, location, and deadline', async () => {
    const { smsService } = await import('@/features/notifications/services/sms.service');

    // Trigger fund release (which sends notifications)
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: SMS was sent
    expect(smsService.sendSMS).toHaveBeenCalledTimes(1);

    // Assert: SMS contains pickup code
    const smsCall = vi.mocked(smsService.sendSMS).mock.calls[0][0];
    expect(smsCall.to).toBe('2348141252812');
    expect(smsCall.message).toContain('Payment complete');
    expect(smsCall.message).toContain('Pickup code:');
    expect(smsCall.message).toMatch(/AUTH-[A-Z0-9]+/); // Pickup authorization code format

    // Assert: SMS contains pickup location
    expect(smsCall.message).toContain('Location:');
    expect(smsCall.message).toContain('Lagos Salvage Yard');

    // Assert: SMS contains pickup deadline
    expect(smsCall.message).toContain('Deadline:');
    // Deadline should be 48 hours from now
    const expectedDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG');
    expect(smsCall.message).toContain(expectedDeadline);

    // Assert: SMS contains instruction to bring ID
    expect(smsCall.message).toContain('Bring valid ID');
  });

  it('should send email with full payment details and pickup instructions', async () => {
    const { emailService } = await import('@/features/notifications/services/email.service');

    // Trigger fund release (which sends notifications)
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: Email was sent
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);

    // Assert: Email contains correct recipient and data
    const emailCall = vi.mocked(emailService.sendPaymentConfirmationEmail).mock.calls[0];
    expect(emailCall[0]).toBe('vendor@test.com'); // Email address

    const emailData = emailCall[1];
    expect(emailData.vendorName).toBe('Test Vendor');
    expect(emailData.auctionId).toBe(testAuctionId);
    expect(emailData.amount).toBe(500000);
    expect(emailData.paymentMethod).toBe('Escrow Wallet');

    // Assert: Email contains pickup authorization code
    expect(emailData.pickupAuthCode).toMatch(/AUTH-[A-Z0-9]+/);

    // Assert: Email contains pickup location
    expect(emailData.pickupLocation).toBe('Lagos Salvage Yard');

    // Assert: Email contains pickup deadline (48 hours)
    const expectedDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString('en-NG');
    expect(emailData.pickupDeadline).toBe(expectedDeadline);

    // Assert: Email contains app URL
    expect(emailData.appUrl).toBeDefined();
  });

  it('should send push notification with pickup information', async () => {
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    // Trigger fund release (which sends notifications)
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: Push notification was sent
    expect(createNotification).toHaveBeenCalledTimes(1);

    // Assert: Push notification contains correct data
    const pushCall = vi.mocked(createNotification).mock.calls[0][0];
    expect(pushCall.userId).toBe(testUserId);
    expect(pushCall.type).toBe('PAYMENT_UNLOCKED');
    expect(pushCall.title).toBe('Payment Complete!');

    // Assert: Message contains pickup code
    expect(pushCall.message).toContain('Pickup code:');
    expect(pushCall.message).toMatch(/AUTH-[A-Z0-9]+/);

    // Assert: Message contains pickup location
    expect(pushCall.message).toContain('Location:');
    expect(pushCall.message).toContain('Lagos Salvage Yard');

    // Assert: Message contains pickup deadline
    expect(pushCall.message).toContain('Deadline:');

    // Assert: Data contains structured information
    expect(pushCall.data.auctionId).toBe(testAuctionId);
    expect(pushCall.data.pickupAuthCode).toMatch(/AUTH-[A-Z0-9]+/);
    expect(pushCall.data.pickupLocation).toBe('Lagos Salvage Yard');
    expect(pushCall.data.pickupDeadline).toBeDefined();
  });

  it('should send all three notification types (SMS, email, push)', async () => {
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    // Trigger fund release (which sends notifications)
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: All three notification types were sent
    expect(smsService.sendSMS).toHaveBeenCalledTimes(1);
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('should use correct pickup location from case data', async () => {
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');

    // Trigger fund release
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: SMS uses correct location
    const smsCall = vi.mocked(smsService.sendSMS).mock.calls[0][0];
    expect(smsCall.message).toContain('Lagos Salvage Yard');

    // Assert: Email uses correct location
    const emailCall = vi.mocked(emailService.sendPaymentConfirmationEmail).mock.calls[0];
    expect(emailCall[1].pickupLocation).toBe('Lagos Salvage Yard');
  });

  it('should calculate 48-hour deadline correctly', async () => {
    const { emailService } = await import('@/features/notifications/services/email.service');

    const beforeTrigger = Date.now();
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);
    const afterTrigger = Date.now();

    // Get the deadline from email
    const emailCall = vi.mocked(emailService.sendPaymentConfirmationEmail).mock.calls[0];
    const deadlineString = emailCall[1].pickupDeadline;

    // Parse the deadline
    const deadlineDate = new Date(deadlineString);
    const expectedDeadlineMin = new Date(beforeTrigger + 48 * 60 * 60 * 1000);
    const expectedDeadlineMax = new Date(afterTrigger + 48 * 60 * 60 * 1000);

    // Assert: Deadline is approximately 48 hours from now (within 1 minute tolerance)
    expect(deadlineDate.getTime()).toBeGreaterThanOrEqual(expectedDeadlineMin.getTime() - 60000);
    expect(deadlineDate.getTime()).toBeLessThanOrEqual(expectedDeadlineMax.getTime() + 60000);
  });

  it('should generate unique pickup authorization code for each auction', async () => {
    const { emailService } = await import('@/features/notifications/services/email.service');

    // Trigger fund release
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Get pickup code from email
    const emailCall = vi.mocked(emailService.sendPaymentConfirmationEmail).mock.calls[0];
    const pickupCode = emailCall[1].pickupAuthCode;

    // Assert: Code format is AUTH-{first 8 chars of auction ID}
    expect(pickupCode).toMatch(/^AUTH-[A-Z0-9]{8}$/);
    expect(pickupCode).toContain(testAuctionId.substring(0, 8).toUpperCase());
  });

  it('should not send notifications if payment already verified', async () => {
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    // Update payment to already verified
    await db
      .update(payments)
      .set({ status: 'verified', escrowStatus: 'released' })
      .where(eq(payments.id, testPaymentId));

    // Trigger fund release
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: No notifications sent (payment already verified)
    expect(smsService.sendSMS).not.toHaveBeenCalled();
    expect(emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('should not send notifications if not all documents signed', async () => {
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    // Update one document to pending
    await db
      .update(releaseForms)
      .set({ status: 'pending', signedAt: null })
      .where(
        and(
          eq(releaseForms.auctionId, testAuctionId),
          eq(releaseForms.documentType, 'pickup_authorization')
        )
      );

    // Trigger fund release
    await triggerFundReleaseOnDocumentCompletion(testAuctionId, testVendorId, testUserId);

    // Assert: No notifications sent (not all documents signed)
    expect(smsService.sendSMS).not.toHaveBeenCalled();
    expect(emailService.sendPaymentConfirmationEmail).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
