/**
 * Unit Tests: Fraud Auto-Suspend Service
 * 
 * Requirements:
 * - Requirement 36: Auto-Suspend Repeat Offenders
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FraudAutoSuspendService } from '@/lib/cron/fraud-auto-suspend';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { eq, and, sql } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    query: {
      vendors: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      auctions: {
        findMany: vi.fn(),
      },
      bids: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    VENDOR_SUSPENDED: 'vendor_suspended',
    BID_CANCELLED: 'bid_cancelled',
  },
  AuditEntityType: {
    VENDOR: 'vendor',
    BID: 'bid',
  },
  DeviceType: {
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
    TABLET: 'tablet',
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

describe('FraudAutoSuspendService', () => {
  let service: FraudAutoSuspendService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FraudAutoSuspendService();
  });

  describe('run', () => {
    it('should return zero results when no repeat offenders found', async () => {
      // Mock no repeat offenders
      vi.mocked(db.execute).mockResolvedValue({ rows: [] } as any);

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(0);
      expect(result.bidsCancelled).toBe(0);
      expect(result.notificationsSent).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should suspend vendors with 3+ fraud flags', async () => {
      // Mock repeat offender
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([]);

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should cancel active bids when suspending vendor', async () => {
      // Mock repeat offender with active bids
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      const mockAuction = {
        id: 'auction-1',
        currentBidder: 'vendor-1',
        currentBid: 500000,
        status: 'active',
      };

      const mockPreviousBid = {
        id: 'bid-1',
        auctionId: 'auction-1',
        vendorId: 'vendor-2',
        amount: 450000,
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([mockAuction] as any);
      vi.mocked(db.query.bids.findMany).mockResolvedValue([mockPreviousBid] as any);

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(1);
      expect(result.bidsCancelled).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should send SMS and email notifications', async () => {
      // Mock repeat offender
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([]);

      const { smsService } = await import('@/features/notifications/services/sms.service');
      const { emailService } = await import('@/features/notifications/services/email.service');

      vi.mocked(smsService.sendSMS).mockResolvedValue(undefined as any);
      vi.mocked(emailService.sendEmail).mockResolvedValue(undefined as any);

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(1);
      expect(result.notificationsSent).toBe(2); // SMS + Email
      expect(smsService.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+2348012345678',
          message: expect.stringContaining('suspended'),
        })
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'vendor@example.com',
          subject: expect.stringContaining('Suspended'),
        })
      );
    });

    it('should handle errors gracefully and continue processing', async () => {
      // Mock two repeat offenders, one will fail
      const mockVendor1 = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockVendor2 = {
        id: 'vendor-2',
        userId: 'user-2',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 4,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-2',
        email: 'vendor2@example.com',
        phone: '+2348012345679',
        fullName: 'Test Vendor 2',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor1, mockVendor2] } as any);
      
      // First vendor will fail (no user found)
      vi.mocked(db.query.vendors.findFirst)
        .mockResolvedValueOnce(null as any) // First call fails
        .mockResolvedValueOnce(mockVendor2 as any); // Second call succeeds
      
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([]);

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(1); // Only second vendor suspended
      expect(result.errors).toHaveLength(1); // One error recorded
      expect(result.errors[0]).toContain('vendor-1');
    });

    it('should reset auction to reserve price when no other bids exist', async () => {
      // Mock repeat offender with active bid but no other bidders
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      const mockAuction = {
        id: 'auction-1',
        currentBidder: 'vendor-1',
        currentBid: 500000,
        status: 'active',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([mockAuction] as any);
      vi.mocked(db.query.bids.findMany).mockResolvedValue([]); // No other bids

      const result = await service.run();

      expect(result.vendorsSuspended).toBe(1);
      expect(result.bidsCancelled).toBe(1);
      expect(db.update).toHaveBeenCalled();
    });

    it('should create audit log entries for suspension and bid cancellation', async () => {
      // Mock repeat offender with active bid
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      const mockAuction = {
        id: 'auction-1',
        currentBidder: 'vendor-1',
        currentBid: 500000,
        status: 'active',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([mockAuction] as any);
      vi.mocked(db.query.bids.findMany).mockResolvedValue([]);

      const { logAction } = await import('@/lib/utils/audit-logger');

      await service.run();

      // Should log suspension and bid cancellation
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          actionType: 'vendor_suspended',
          entityType: 'vendor',
          entityId: 'vendor-1',
        })
      );

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'system',
          actionType: 'bid_cancelled',
          entityType: 'bid',
          entityId: 'auction-1',
        })
      );
    });

    it('should include suspension details in audit log', async () => {
      // Mock repeat offender
      const mockVendor = {
        id: 'vendor-1',
        userId: 'user-1',
        status: 'approved',
        performanceStats: {
          totalBids: 10,
          totalWins: 5,
          winRate: 50,
          avgPaymentTimeHours: 2,
          onTimePickupRate: 90,
          fraudFlags: 5, // 5 fraud flags
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: 'user-1',
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
      };

      vi.mocked(db.execute).mockResolvedValue({ rows: [mockVendor] } as any);
      vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor as any);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(db.query.auctions.findMany).mockResolvedValue([]);

      const { logAction } = await import('@/lib/utils/audit-logger');

      await service.run();

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          afterState: expect.objectContaining({
            status: 'suspended',
            reason: 'Auto-suspended: 3+ fraud flags',
            fraudFlagCount: 5,
            suspensionDays: 30,
          }),
        })
      );
    });
  });
});
