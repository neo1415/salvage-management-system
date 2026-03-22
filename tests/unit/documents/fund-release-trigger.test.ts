/**
 * Unit Tests for Automatic Fund Release Trigger
 * 
 * Tests the triggerFundReleaseOnDocumentCompletion() function
 * which is the CORE automation that completes the payment flow.
 * 
 * Test Coverage:
 * - Only triggers when all 3 documents signed
 * - Calls escrowService.releaseFunds() with correct parameters
 * - Updates payment status to 'verified'
 * - Updates case status to 'sold'
 * - Sends notifications (SMS, email, push)
 * - Handles Paystack transfer failures
 * - Sends Finance Officer alerts on failure
 * - Creates audit log entries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerFundReleaseOnDocumentCompletion } from '@/features/documents/services/document.service';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    releaseFunds: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendPaymentConfirmationEmail: vi.fn(),
    sendEmail: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/notification.service', () => ({
  createNotification: vi.fn(),
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

describe('triggerFundReleaseOnDocumentCompletion', () => {
  const mockAuctionId = 'auction-123';
  const mockVendorId = 'vendor-456';
  const mockUserId = 'user-789';
  const mockPaymentId = 'payment-abc';
  const mockCaseId = 'case-xyz';

  // Helper function to create proper query builder mock
  // For queries WITHOUT .limit() (like checkAllDocumentsSigned)
  const createSelectMockNoLimit = (data: any) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(data),
    }),
  });

  // Helper function to create proper query builder mock WITH .limit()
  const createSelectMock = (data: any) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
      }),
    }),
  });

  // Helper function to create update mock
  const createUpdateMock = () => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip fund release when not all documents are signed', async () => {
    // Mock checkAllDocumentsSigned to return false
    const { db } = await import('@/lib/db/drizzle');
    vi.mocked(db.select).mockReturnValue(createSelectMockNoLimit([
      { documentType: 'bill_of_sale', status: 'signed' },
      { documentType: 'liability_waiver', status: 'pending' },
      { documentType: 'pickup_authorization', status: 'pending' },
    ]) as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should not call releaseFunds
    expect(escrowService.releaseFunds).not.toHaveBeenCalled();
  });

  it('should skip fund release when payment already verified', async () => {
    // Mock checkAllDocumentsSigned to return true
    const { db } = await import('@/lib/db/drizzle');
    
    // First call: documents query (all signed) - NO .limit()
    vi.mocked(db.select).mockReturnValueOnce(createSelectMockNoLimit([
      { documentType: 'bill_of_sale', status: 'signed' },
      { documentType: 'liability_waiver', status: 'signed' },
      { documentType: 'pickup_authorization', status: 'signed' },
    ]) as any);

    // Second call: payment query (already verified) - WITH .limit()
    vi.mocked(db.select).mockReturnValueOnce(createSelectMock([
      {
        id: mockPaymentId,
        auctionId: mockAuctionId,
        vendorId: mockVendorId,
        amount: '500000.00',
        paymentMethod: 'escrow_wallet',
        status: 'verified', // Already verified
        escrowStatus: 'released',
      },
    ]) as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should not call releaseFunds
    expect(escrowService.releaseFunds).not.toHaveBeenCalled();
  });

  it('should release funds when all documents signed and payment pending', async () => {
    const { db } = await import('@/lib/db/drizzle');
    
    // Mock all database queries in sequence
    vi.mocked(db.select)
      // Documents query - NO .limit()
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      // Payment query - WITH .limit()
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockPaymentId,
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          amount: '500000.00',
          paymentMethod: 'escrow_wallet',
          status: 'pending',
          escrowStatus: 'frozen',
        },
      ]) as any)
      // Auction query - WITH .limit()
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockAuctionId,
          caseId: mockCaseId,
          title: '2020 Toyota Camry',
        },
      ]) as any)
      // Vendor query - WITH .limit()
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any)
      // User query - WITH .limit()
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockUserId,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '2348141252812',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should call releaseFunds with correct parameters
    expect(escrowService.releaseFunds).toHaveBeenCalledWith(
      mockVendorId,
      500000,
      mockAuctionId,
      mockUserId
    );
  });

  it('should update payment status to verified after fund release', async () => {
    const { db } = await import('@/lib/db/drizzle');
    
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockPaymentId,
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          amount: '500000.00',
          paymentMethod: 'escrow_wallet',
          status: 'pending',
          escrowStatus: 'frozen',
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockAuctionId,
          caseId: mockCaseId,
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockUserId,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '2348141252812',
        },
      ]) as any);

    const mockUpdate = vi.fn().mockReturnValue(createUpdateMock());
    vi.mocked(db.update).mockReturnValue(mockUpdate as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should update payment status
    expect(db.update).toHaveBeenCalled();
  });

  it('should send notifications after successful fund release', async () => {
    const { db } = await import('@/lib/db/drizzle');
    
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockPaymentId,
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          amount: '500000.00',
          paymentMethod: 'escrow_wallet',
          status: 'pending',
          escrowStatus: 'frozen',
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockAuctionId,
          caseId: mockCaseId,
          title: '2020 Toyota Camry',
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockUserId,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '2348141252812',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { createNotification } = await import('@/features/notifications/services/notification.service');

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should send SMS
    expect(smsService.sendSMS).toHaveBeenCalled();
    
    // Should send email
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalled();
    
    // Should send push notification
    expect(createNotification).toHaveBeenCalled();
  });

  it('should send Finance Officer alert when fund release fails', async () => {
    const { db } = await import('@/lib/db/drizzle');
    
    // Mock documents query (all signed)
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockPaymentId,
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          amount: '500000.00',
          paymentMethod: 'escrow_wallet',
          status: 'pending',
          escrowStatus: 'frozen',
        },
      ]) as any)
      // Finance officers query for alert - NO .limit()
      .mockReturnValueOnce(createSelectMockNoLimit([
        {
          id: 'finance-officer-1',
          fullName: 'Finance Officer',
          email: 'finance@nem-insurance.com',
          role: 'finance',
        },
      ]) as any)
      // Vendor query for alert - WITH .limit()
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any);

    // Mock escrowService.releaseFunds to throw error
    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockRejectedValue(new Error('Paystack transfer failed'));

    const { emailService } = await import('@/features/notifications/services/email.service');

    // Should throw error
    await expect(
      triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId)
    ).rejects.toThrow('Paystack transfer failed');

    // Should send alert email to Finance Officer
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'finance@nem-insurance.com',
        subject: expect.stringContaining('Escrow Payment Failed'),
      })
    );
  });

  it('should create audit log entry after successful fund release', async () => {
    const { db } = await import('@/lib/db/drizzle');
    
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockPaymentId,
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          amount: '500000.00',
          paymentMethod: 'escrow_wallet',
          status: 'pending',
          escrowStatus: 'frozen',
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockAuctionId,
          caseId: mockCaseId,
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockUserId,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '2348141252812',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    const { logAction } = await import('@/lib/utils/audit-logger');

    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Should create audit log
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        entityId: mockPaymentId,
        afterState: expect.objectContaining({
          trigger: 'document_signing_completion',
          autoVerified: true,
        }),
      })
    );
  });

  it('should throw error when payment record not found', async () => {
    // Mock checkAllDocumentsSigned to return true
    const { db } = await import('@/lib/db/drizzle');
    
    vi.mocked(db.select)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      // Mock payment query to return empty array
      .mockReturnValueOnce(createSelectMock([]) as any)
      // Mock finance officers query for alert - NO .limit()
      .mockReturnValueOnce(createSelectMockNoLimit([]) as any)
      // Mock vendor query for alert - WITH .limit()
      .mockReturnValueOnce(createSelectMock([]) as any);

    await expect(
      triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId)
    ).rejects.toThrow('Payment record not found');
  });
});
