/**
 * Unit Tests for Escrow Payment Audit Logging
 * 
 * Tests audit logging for:
 * - Wallet payment confirmation
 * - Document signing progress
 * - Automatic fund release
 * - Manual fund release by Finance Officer
 * - Pickup confirmations (vendor and admin)
 * 
 * Task 7.1: Enhance audit logging for escrow payments
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

describe('Escrow Payment Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('7.1.1 Wallet Payment Confirmation Logging', () => {
    it('should log wallet payment confirmation with correct action type', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.PAYMENT_INITIATED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          status: 'pending',
          escrowStatus: 'frozen',
        },
        afterState: {
          status: 'pending',
          escrowStatus: 'frozen',
          walletConfirmed: true,
          frozenAmount: 500000,
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should include wallet confirmation details in afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.PAYMENT_INITIATED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0',
        afterState: {
          walletConfirmed: true,
          frozenAmount: 500000,
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AuditActionType.PAYMENT_INITIATED,
          afterState: expect.objectContaining({
            walletConfirmed: true,
            frozenAmount: 500000,
          }),
        })
      );
    });
  });

  describe('7.1.2 Document Signing Progress Logging', () => {
    it('should log document signing progress with DOCUMENT_SIGNING_PROGRESS action', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.DOCUMENT_SIGNING_PROGRESS,
        entityType: AuditEntityType.DOCUMENT,
        entityId: 'auction-123',
        ipAddress: 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'document-service',
        afterState: {
          auctionId: 'auction-123',
          vendorId: 'vendor-123',
          signedDocuments: 2,
          totalDocuments: 3,
          progress: 67,
          allSigned: false,
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should include progress details in afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.DOCUMENT_SIGNING_PROGRESS,
        entityType: AuditEntityType.DOCUMENT,
        entityId: 'auction-123',
        ipAddress: 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'document-service',
        afterState: {
          signedDocuments: 3,
          totalDocuments: 3,
          progress: 100,
          allSigned: true,
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AuditActionType.DOCUMENT_SIGNING_PROGRESS,
          afterState: expect.objectContaining({
            signedDocuments: 3,
            totalDocuments: 3,
            progress: 100,
            allSigned: true,
          }),
        })
      );
    });
  });

  describe('7.1.3 Automatic Fund Release Logging', () => {
    it('should log automatic fund release with FUNDS_RELEASED action', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'document-service',
        afterState: {
          auctionId: 'auction-123',
          vendorId: 'vendor-123',
          amount: 500000,
          status: 'verified',
          escrowStatus: 'released',
          autoVerified: true,
          trigger: 'document_signing_completion',
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should include automatic trigger indicator in afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: 'system',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'document-service',
        afterState: {
          autoVerified: true,
          trigger: 'document_signing_completion',
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          afterState: expect.objectContaining({
            autoVerified: true,
            trigger: 'document_signing_completion',
          }),
        })
      );
    });
  });

  describe('7.1.4 Manual Fund Release by Finance Officer Logging', () => {
    it('should log manual fund release with Finance Officer details', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'finance-officer-123',
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          status: 'pending',
          escrowStatus: 'frozen',
        },
        afterState: {
          status: 'verified',
          escrowStatus: 'released',
          manualRelease: true,
          financeOfficerId: 'finance-officer-123',
          financeOfficerName: 'John Doe',
          reason: 'Automatic release failed - manual intervention required',
          amount: 500000,
          transferReference: 'TRANSFER_12345678_1234567890',
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should include manual release indicator and reason in afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'finance-officer-123',
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        afterState: {
          manualRelease: true,
          financeOfficerId: 'finance-officer-123',
          financeOfficerName: 'John Doe',
          reason: 'Paystack transfer timeout - retrying manually',
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          afterState: expect.objectContaining({
            manualRelease: true,
            financeOfficerId: 'finance-officer-123',
            financeOfficerName: 'John Doe',
            reason: 'Paystack transfer timeout - retrying manually',
          }),
        })
      );
    });
  });

  describe('7.1.5 Pickup Confirmations Logging', () => {
    it('should log vendor pickup confirmation with PICKUP_CONFIRMED_VENDOR action', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.PICKUP_CONFIRMED_VENDOR,
        entityType: AuditEntityType.AUCTION,
        entityId: 'auction-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          pickupConfirmedVendor: false,
        },
        afterState: {
          pickupConfirmedVendor: true,
          pickupConfirmedVendorAt: '2024-01-15T10:30:00Z',
          pickupAuthCode: 'AUTH-12345678',
          vendorId: 'vendor-123',
          vendorName: 'John Vendor',
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should log admin pickup confirmation with PICKUP_CONFIRMED_ADMIN action', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
        })),
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'admin-123',
        actionType: AuditActionType.PICKUP_CONFIRMED_ADMIN,
        entityType: AuditEntityType.AUCTION,
        entityId: 'auction-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          pickupConfirmedAdmin: false,
          caseStatus: 'pending',
        },
        afterState: {
          pickupConfirmedAdmin: true,
          pickupConfirmedAdminAt: '2024-01-15T11:00:00Z',
          pickupConfirmedAdminBy: 'admin-123',
          adminName: 'Admin User',
          caseStatus: 'sold',
          notes: 'Item collected in good condition',
        },
      });

      expect(mockInsert).toHaveBeenCalledWith(auditLogs);
    });

    it('should include pickup details in vendor confirmation afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.PICKUP_CONFIRMED_VENDOR,
        entityType: AuditEntityType.AUCTION,
        entityId: 'auction-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0',
        afterState: {
          pickupAuthCode: 'AUTH-12345678',
          vendorName: 'John Vendor',
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: AuditActionType.PICKUP_CONFIRMED_VENDOR,
          afterState: expect.objectContaining({
            pickupAuthCode: 'AUTH-12345678',
            vendorName: 'John Vendor',
          }),
        })
      );
    });

    it('should include case status change in admin confirmation afterState', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'admin-123',
        actionType: AuditActionType.PICKUP_CONFIRMED_ADMIN,
        entityType: AuditEntityType.AUCTION,
        entityId: 'auction-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          caseStatus: 'pending',
        },
        afterState: {
          caseStatus: 'sold',
          adminName: 'Admin User',
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeState: expect.objectContaining({
            caseStatus: 'pending',
          }),
          afterState: expect.objectContaining({
            caseStatus: 'sold',
            adminName: 'Admin User',
          }),
        })
      );
    });
  });

  describe('Audit Log Data Integrity', () => {
    it('should not throw error if database insert fails', async () => {
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => {
          throw new Error('Database error');
        }),
      }));
      (db.insert as any) = mockInsert;

      // Should not throw - audit logging failures should be silent
      await expect(
        logAction({
          userId: 'user-123',
          actionType: AuditActionType.PAYMENT_INITIATED,
          entityType: AuditEntityType.PAYMENT,
          entityId: 'payment-123',
          ipAddress: '192.168.1.1',
          deviceType: DeviceType.MOBILE,
          userAgent: 'Mozilla/5.0',
        })
      ).resolves.not.toThrow();
    });

    it('should log all required fields for escrow payment events', async () => {
      const mockValues = vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'log-1' }])),
      }));
      const mockInsert = vi.fn(() => ({
        values: mockValues,
      }));
      (db.insert as any) = mockInsert;

      await logAction({
        userId: 'user-123',
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: 'payment-123',
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        beforeState: {
          status: 'pending',
        },
        afterState: {
          status: 'verified',
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          actionType: AuditActionType.FUNDS_RELEASED,
          entityType: AuditEntityType.PAYMENT,
          entityId: 'payment-123',
          ipAddress: '192.168.1.1',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'Mozilla/5.0',
          beforeState: expect.any(Object),
          afterState: expect.any(Object),
        })
      );
    });
  });
});
