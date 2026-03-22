/**
 * Integration Tests: Document Signing Progress Notifications
 * 
 * Tests for task 6.1: Implement document signing progress notifications
 * 
 * Sub-tasks:
 * - 6.1.1 Send push notification after each document signed (1/3, 2/3)
 * - 6.1.2 Send SMS after all documents signed
 * 
 * Requirements:
 * - Requirement 8.2: Send push notification "1/3 documents signed. 2 documents remaining."
 * - Requirement 8.3: Send push notification "2/3 documents signed. 1 document remaining."
 * - Requirement 8.4: Send SMS "All documents signed! Payment is being processed."
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, sql } from 'drizzle-orm';
import { signDocument } from '@/features/documents/services/document.service';
import { pushNotificationService } from '@/features/notifications/services/push.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

// Mock notification services
vi.mock('@/features/notifications/services/push.service', () => ({
  pushNotificationService: {
    sendPushNotification: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

// Mock escrow service to prevent actual fund transfers
vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    releaseFunds: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Document Signing Progress Notifications', () => {
  let testUserId: string;
  let testVendorId: string;
  let testAuctionId: string;
  let testCaseId: string;
  let testDocumentIds: { billOfSale: string; liabilityWaiver: string; pickupAuth: string };

  beforeEach(async () => {
    // Clear mocks
    vi.clearAllMocks();

    // Set up default mock responses
    vi.mocked(pushNotificationService.sendPushNotification).mockResolvedValue({
      success: true,
      messageId: 'push-test-123',
    });

    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-test-123',
    });

    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-test-123',
    });

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-doc-notif-${Date.now()}@example.com`,
        fullName: 'Test Vendor',
        phone: '2348141252812',
        role: 'vendor',
        passwordHash: 'test-hash',
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
        tier: 'tier1_bvn',
        kycStatus: 'approved',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-NOTIF-${Date.now()}`,
        assetType: 'vehicle',
        vehicleCondition: 'salvage',
        locationName: 'Test Location',
        gpsLocation: sql`point(6.5244, 3.3792)`, // Lagos coordinates
        photos: [],
        createdBy: testUserId,
        status: 'approved',
        marketValue: '200000',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
      })
      .returning();
    testCaseId = testCase.id;

    // Create test auction
    const endTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startingBid: '100000',
        currentBid: '150000',
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime,
        originalEndTime: endTime,
        status: 'closed',
        winnerId: testVendorId,
      })
      .returning();
    testAuctionId = auction.id;

    // Create payment record
    await db.insert(payments).values({
      auctionId: testAuctionId,
      vendorId: testVendorId,
      amount: '150000',
      paymentMethod: 'escrow_wallet',
      escrowStatus: 'frozen',
      status: 'pending',
      paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Create test documents
    const [billOfSale] = await db
      .insert(releaseForms)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'pending',
        pdfUrl: 'https://example.com/bill-of-sale.pdf',
        pdfPublicId: 'test-bill-of-sale',
        documentData: {
          buyerName: 'Test Vendor',
          buyerEmail: 'test@example.com',
          buyerPhone: '2348141252812',
          sellerName: 'NEM Insurance',
          sellerAddress: 'Lagos, Nigeria',
          sellerContact: 'nemsupport@nem-insurance.com',
          assetType: 'vehicle',
          assetDescription: 'Toyota Camry 2020',
          assetCondition: 'salvage',
          salePrice: 150000,
          paymentMethod: 'escrow_wallet',
          transactionDate: new Date().toISOString(),
          pickupLocation: 'Test Location',
          pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        generatedBy: testUserId,
      })
      .returning();

    const [liabilityWaiver] = await db
      .insert(releaseForms)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'pending',
        pdfUrl: 'https://example.com/liability-waiver.pdf',
        pdfPublicId: 'test-liability-waiver',
        documentData: {
          buyerName: 'Test Vendor',
          buyerEmail: 'test@example.com',
          buyerPhone: '2348141252812',
          sellerName: 'NEM Insurance',
          sellerAddress: 'Lagos, Nigeria',
          sellerContact: 'nemsupport@nem-insurance.com',
          assetType: 'vehicle',
          assetDescription: 'Toyota Camry 2020',
          assetCondition: 'salvage',
          salePrice: 150000,
          paymentMethod: 'escrow_wallet',
          transactionDate: new Date().toISOString(),
          pickupLocation: 'Test Location',
          pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        generatedBy: testUserId,
      })
      .returning();

    const [pickupAuth] = await db
      .insert(releaseForms)
      .values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'pending',
        pdfUrl: 'https://example.com/pickup-auth.pdf',
        pdfPublicId: 'test-pickup-auth',
        documentData: {
          buyerName: 'Test Vendor',
          buyerEmail: 'test@example.com',
          buyerPhone: '2348141252812',
          sellerName: 'NEM Insurance',
          sellerAddress: 'Lagos, Nigeria',
          sellerContact: 'nemsupport@nem-insurance.com',
          assetType: 'vehicle',
          assetDescription: 'Toyota Camry 2020',
          assetCondition: 'salvage',
          salePrice: 150000,
          paymentMethod: 'escrow_wallet',
          transactionDate: new Date().toISOString(),
          pickupLocation: 'Test Location',
          pickupDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        generatedBy: testUserId,
      })
      .returning();

    testDocumentIds = {
      billOfSale: billOfSale.id,
      liabilityWaiver: liabilityWaiver.id,
      pickupAuth: pickupAuth.id,
    };
  });

  afterEach(async () => {
    // Clean up test data
    if (testAuctionId) {
      await db.delete(releaseForms).where(eq(releaseForms.auctionId, testAuctionId));
      await db.delete(payments).where(eq(payments.auctionId, testAuctionId));
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

  /**
   * Test 6.1.1: Send push notification after first document signed (1/3)
   * Validates: Requirement 8.2
   */
  it('should send push notification "1/3 documents signed. 2 documents remaining." after first document', async () => {
    // Act: Sign first document (Bill of Sale)
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Push notification was sent with correct message
    expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        userId: testUserId,
        title: 'Document Signing Progress',
        body: '1/3 documents signed. 2 documents remaining.',
        tag: 'document-progress',
        data: expect.objectContaining({
          auctionId: testAuctionId,
          signedDocuments: 1,
          totalDocuments: 3,
        }),
      }),
      expect.objectContaining({
        phone: '2348141252812',
        email: expect.stringContaining('@example.com'),
        fullName: 'Test Vendor',
      })
    );

    // Assert: SMS was NOT sent (only after all documents)
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  /**
   * Test 6.1.1: Send push notification after second document signed (2/3)
   * Validates: Requirement 8.3
   */
  it('should send push notification "2/3 documents signed. 1 document remaining." after second document', async () => {
    // Arrange: Sign first document
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Clear mocks to isolate second document signing
    vi.clearAllMocks();
    vi.mocked(pushNotificationService.sendPushNotification).mockResolvedValue({
      success: true,
      messageId: 'push-test-456',
    });

    // Act: Sign second document (Liability Waiver)
    await signDocument(
      testDocumentIds.liabilityWaiver,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Push notification was sent with correct message
    expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        userId: testUserId,
        title: 'Document Signing Progress',
        body: '2/3 documents signed. 1 document remaining.',
        tag: 'document-progress',
        data: expect.objectContaining({
          auctionId: testAuctionId,
          signedDocuments: 2,
          totalDocuments: 3,
        }),
      }),
      expect.objectContaining({
        phone: '2348141252812',
        email: expect.stringContaining('@example.com'),
        fullName: 'Test Vendor',
      })
    );

    // Assert: SMS was NOT sent (only after all documents)
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  /**
   * Test 6.1.2: Send SMS and Email after all documents signed (3/3)
   * Validates: Requirement 8.4
   */
  it('should send SMS and Email "All documents signed! Payment is being processed." after third document', async () => {
    // Arrange: Sign first two documents
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    await signDocument(
      testDocumentIds.liabilityWaiver,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Clear mocks to isolate third document signing
    vi.clearAllMocks();
    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-test-789',
    });
    vi.mocked(emailService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'email-test-789',
    });

    // Act: Sign third document (Pickup Authorization)
    await signDocument(
      testDocumentIds.pickupAuth,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: SMS was sent with correct message
    expect(smsService.sendSMS).toHaveBeenCalledWith({
      to: '2348141252812',
      message: 'All documents signed! Payment is being processed. You will receive your pickup code shortly.',
      userId: testUserId,
    });

    // Assert: Email was sent with correct details
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining('@example.com'),
        subject: 'All Documents Signed - Payment Processing',
        html: expect.stringContaining('All Required Documents'),
      })
    );

    // Assert: Push notification was NOT sent (no progress notification for 3/3)
    expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
  });

  /**
   * Test: Complete flow - all notifications sent in correct order
   */
  it('should send notifications in correct order: push (1/3) → push (2/3) → SMS + Email (3/3)', async () => {
    const notificationOrder: string[] = [];

    // Track notification order
    vi.mocked(pushNotificationService.sendPushNotification).mockImplementation(async (_, options) => {
      notificationOrder.push(`push: ${options.body}`);
      return { success: true, messageId: 'push-test' };
    });

    vi.mocked(smsService.sendSMS).mockImplementation(async (options) => {
      notificationOrder.push(`sms: ${options.message}`);
      return { success: true, messageId: 'sms-test' };
    });

    vi.mocked(emailService.sendEmail).mockImplementation(async (options) => {
      notificationOrder.push(`email: ${options.subject}`);
      return { success: true, messageId: 'email-test' };
    });

    // Act: Sign all three documents
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    await signDocument(
      testDocumentIds.liabilityWaiver,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    await signDocument(
      testDocumentIds.pickupAuth,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Notifications sent in correct order
    expect(notificationOrder).toEqual([
      'push: 1/3 documents signed. 2 documents remaining.',
      'push: 2/3 documents signed. 1 document remaining.',
      'sms: All documents signed! Payment is being processed. You will receive your pickup code shortly.',
      'email: All Documents Signed - Payment Processing',
    ]);
  });

  /**
   * Test: Email notification includes auction and payment details
   */
  it('should include auction and payment details in email notification', async () => {
    // Arrange: Sign first two documents
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    await signDocument(
      testDocumentIds.liabilityWaiver,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Clear mocks
    vi.clearAllMocks();

    // Act: Sign third document
    await signDocument(
      testDocumentIds.pickupAuth,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Email contains auction details
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining('@example.com'),
        subject: 'All Documents Signed - Payment Processing',
        html: expect.stringContaining('Test Vendor'),
      })
    );

    // Verify email HTML contains payment information
    const emailCall = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(emailCall.html).toContain('All 3 documents have been successfully signed');
    expect(emailCall.html).toContain('payment');
    expect(emailCall.html).toContain('pickup');
  });

  /**
   * Test: Notification failure should not block document signing
   */
  it('should complete document signing even if notification fails', async () => {
    // Arrange: Mock notification failure
    vi.mocked(pushNotificationService.sendPushNotification).mockRejectedValue(
      new Error('Notification service unavailable')
    );

    // Act: Sign document
    const result = await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Document was signed successfully
    expect(result.status).toBe('signed');
    expect(result.signedAt).toBeTruthy();

    // Verify document in database
    const [doc] = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.id, testDocumentIds.billOfSale))
      .limit(1);

    expect(doc.status).toBe('signed');
  });

  /**
   * Test: No notifications sent if document already signed
   */
  it('should not send duplicate notifications if document already signed', async () => {
    // Arrange: Sign document first time
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Clear mocks
    vi.clearAllMocks();

    // Act: Try to sign same document again (should fail)
    await expect(
      signDocument(
        testDocumentIds.billOfSale,
        testVendorId,
        'signature-data-base64',
        '127.0.0.1',
        'desktop',
        'test-user-agent'
      )
    ).rejects.toThrow('Document already signed');

    // Assert: No notifications sent
    expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  /**
   * Test: Notification includes correct auction and user data
   */
  it('should include correct auction and user data in notifications', async () => {
    // Act: Sign first document
    await signDocument(
      testDocumentIds.billOfSale,
      testVendorId,
      'signature-data-base64',
      '127.0.0.1',
      'desktop',
      'test-user-agent'
    );

    // Assert: Push notification includes correct data
    expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        userId: testUserId,
        data: expect.objectContaining({
          auctionId: testAuctionId,
          signedDocuments: 1,
          totalDocuments: 3,
        }),
      }),
      expect.objectContaining({
        phone: '2348141252812',
        email: expect.stringContaining('@example.com'),
        fullName: 'Test Vendor',
      })
    );
  });
});
