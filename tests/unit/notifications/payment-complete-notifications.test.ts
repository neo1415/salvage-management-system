/**
 * Unit Tests for Payment Complete Notifications
 * 
 * Tests that payment complete notifications include:
 * - SMS with pickup authorization code, location, and deadline
 * - Email with full payment details and pickup instructions
 * - Push notification with pickup information
 * 
 * Validates Task 6.2 Requirements:
 * - 6.2.1: Send SMS and email with pickup authorization code
 * - 6.2.2: Include pickup location and deadline
 * - 6.2.3: Write integration tests for notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
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

describe('Payment Complete Notifications', () => {
  const mockAuctionId = 'auction-123';
  const mockVendorId = 'vendor-456';
  const mockUserId = 'user-789';
  const mockPaymentId = 'payment-abc';
  const mockCaseId = 'case-xyz';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send SMS with pickup code, location, and deadline', async () => {
    // Arrange
    const { db } = await import('@/lib/db/drizzle');
    const { smsService } = await import('@/features/notifications/services/sms.service');
    const { triggerFundReleaseOnDocumentCompletion } = await import('@/features/documents/services/document.service');

    // Mock all database queries
    const createSelectMockNoLimit = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(data),
      }),
    });

    const createSelectMock = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(data),
        }),
      }),
    });

    const createUpdateMock = () => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    vi.mocked(db.select)
      // Documents query (all signed)
      .mockReturnValueOnce(createSelectMockNoLimit([
        { documentType: 'bill_of_sale', status: 'signed' },
        { documentType: 'liability_waiver', status: 'signed' },
        { documentType: 'pickup_authorization', status: 'signed' },
      ]) as any)
      // Payment query
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
      // Auction query
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockAuctionId,
          caseId: mockCaseId,
          title: '2020 Toyota Camry',
        },
      ]) as any)
      // Vendor query
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockVendorId,
          userId: mockUserId,
        },
      ]) as any)
      // User query
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockUserId,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '2348141252812',
        },
      ]) as any)
      // Case query for pickup location
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockCaseId,
          locationName: 'Lagos Salvage Yard',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    vi.mocked(smsService.sendSMS).mockResolvedValue({
      success: true,
      messageId: 'sms-test-123',
    });

    // Act
    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Assert
    expect(smsService.sendSMS).toHaveBeenCalledTimes(1);
    const smsCall = vi.mocked(smsService.sendSMS).mock.calls[0][0];
    
    // Verify SMS contains all required information
    expect(smsCall.to).toBe('2348141252812');
    expect(smsCall.message).toContain('Payment complete');
    expect(smsCall.message).toContain('Pickup code:');
    expect(smsCall.message).toMatch(/AUTH-[A-Z0-9]+/);
    expect(smsCall.message).toContain('Location:');
    expect(smsCall.message).toContain('Lagos Salvage Yard');
    expect(smsCall.message).toContain('Deadline:');
    expect(smsCall.message).toContain('Bring valid ID');
  });

  it('should send email with pickup location and deadline', async () => {
    // Arrange
    const { db } = await import('@/lib/db/drizzle');
    const { emailService } = await import('@/features/notifications/services/email.service');
    const { triggerFundReleaseOnDocumentCompletion } = await import('@/features/documents/services/document.service');

    // Mock database queries (same as above)
    const createSelectMockNoLimit = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(data),
      }),
    });

    const createSelectMock = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(data),
        }),
      }),
    });

    const createUpdateMock = () => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

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
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockCaseId,
          locationName: 'Lagos Salvage Yard',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    vi.mocked(emailService.sendPaymentConfirmationEmail).mockResolvedValue({
      success: true,
      messageId: 'email-test-456',
    });

    // Act
    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Assert
    expect(emailService.sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
    const emailCall = vi.mocked(emailService.sendPaymentConfirmationEmail).mock.calls[0];
    
    // Verify email recipient
    expect(emailCall[0]).toBe('john@example.com');
    
    // Verify email data
    const emailData = emailCall[1];
    expect(emailData.vendorName).toBe('John Doe');
    expect(emailData.pickupAuthCode).toMatch(/AUTH-[A-Z0-9]+/);
    expect(emailData.pickupLocation).toBe('Lagos Salvage Yard');
    expect(emailData.pickupDeadline).toBeDefined();
    expect(emailData.amount).toBe(500000);
  });

  it('should send push notification with pickup information', async () => {
    // Arrange
    const { db } = await import('@/lib/db/drizzle');
    const { createNotification } = await import('@/features/notifications/services/notification.service');
    const { triggerFundReleaseOnDocumentCompletion } = await import('@/features/documents/services/document.service');

    // Mock database queries
    const createSelectMockNoLimit = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(data),
      }),
    });

    const createSelectMock = (data: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(data),
        }),
      }),
    });

    const createUpdateMock = () => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

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
      ]) as any)
      .mockReturnValueOnce(createSelectMock([
        {
          id: mockCaseId,
          locationName: 'Lagos Salvage Yard',
        },
      ]) as any);

    vi.mocked(db.update).mockReturnValue(createUpdateMock() as any);

    const { escrowService } = await import('@/features/payments/services/escrow.service');
    vi.mocked(escrowService.releaseFunds).mockResolvedValue({
      balance: 0,
      availableBalance: 0,
      frozenAmount: 0,
    });

    vi.mocked(createNotification).mockResolvedValue({
      id: 'notification-test-789',
      userId: mockUserId,
      type: 'PAYMENT_UNLOCKED',
      title: 'Payment Complete!',
      message: 'Test message',
      read: false,
      createdAt: new Date(),
    });

    // Act
    await triggerFundReleaseOnDocumentCompletion(mockAuctionId, mockVendorId, mockUserId);

    // Assert
    expect(createNotification).toHaveBeenCalledTimes(1);
    const pushCall = vi.mocked(createNotification).mock.calls[0][0];
    
    // Verify push notification data
    expect(pushCall.userId).toBe(mockUserId);
    expect(pushCall.type).toBe('PAYMENT_UNLOCKED');
    expect(pushCall.title).toBe('Payment Complete!');
    expect(pushCall.message).toContain('Pickup code:');
    expect(pushCall.message).toContain('Location:');
    expect(pushCall.message).toContain('Lagos Salvage Yard');
    expect(pushCall.message).toContain('Deadline:');
    expect(pushCall.data.pickupAuthCode).toMatch(/AUTH-[A-Z0-9]+/);
    expect(pushCall.data.pickupLocation).toBe('Lagos Salvage Yard');
  });
});
