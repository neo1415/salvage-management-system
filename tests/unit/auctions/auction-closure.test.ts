/**
 * Unit tests for Auction Closure Service
 * 
 * Tests the auction closure logic including:
 * - Closing expired auctions
 * - Identifying winning bidders
 * - Generating payment invoices
 * - Setting payment deadlines
 * - Sending notifications
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuctionClosureService } from '@/features/auctions/services/closure.service';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import * as auditLogger from '@/lib/utils/audit-logger';
import * as smsService from '@/features/notifications/services/sms.service';
import * as emailService from '@/features/notifications/services/email.service';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      auctions: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    AUCTION_CLOSED: 'auction_closed',
    NOTIFICATION_SENT: 'notification_sent',
  },
  AuditEntityType: {
    AUCTION: 'auction',
    PAYMENT: 'payment',
  },
  DeviceType: {
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
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

describe('AuctionClosureService', () => {
  let service: AuctionClosureService;

  beforeEach(() => {
    service = new AuctionClosureService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('closeAuction', () => {
    it('should close auction with winning bidder and create payment', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const userId = 'user-123';
      const caseId = 'case-123';

      const mockAuction = {
        id: auctionId,
        caseId,
        status: 'active',
        currentBidder: vendorId,
        currentBid: '500000.00',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-06'),
        originalEndTime: new Date('2024-01-06'),
        extensionCount: 0,
        minimumIncrement: '10000.00',
        watchingCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const mockVendor = {
        id: vendorId,
        userId,
        businessName: 'Test Vendor',
        tier: 'tier1_bvn',
        status: 'approved',
      };

      const mockUser = {
        id: userId,
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
        role: 'vendor',
        status: 'verified_tier_1',
      };

      const mockCase = {
        id: caseId,
        claimReference: 'CLM-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '2000000.00',
        estimatedSalvageValue: '600000.00',
        reservePrice: '420000.00',
        damageSeverity: 'moderate',
        locationName: 'Lagos, Nigeria',
        status: 'active_auction',
      };

      const mockPayment = {
        id: 'payment-123',
        auctionId,
        vendorId,
        amount: '500000.00',
        paymentMethod: 'paystack',
        status: 'pending',
        paymentDeadline: new Date(),
      };

      // Mock database queries
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      });

      // Mock vendor query
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVendor]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCase]),
          }),
        }),
      });

      // Mock payment insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPayment]),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.closeAuction(auctionId);

      expect(result.success).toBe(true);
      expect(result.auctionId).toBe(auctionId);
      expect(result.winnerId).toBe(vendorId);
      expect(result.winningBid).toBe(500000);
      expect(result.paymentId).toBe('payment-123');
    });

    it('should close auction without winner when no bids placed', async () => {
      const auctionId = 'auction-123';

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: null,
        currentBid: null,
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-06'),
        originalEndTime: new Date('2024-01-06'),
        extensionCount: 0,
        minimumIncrement: '10000.00',
        watchingCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // Mock database queries
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.closeAuction(auctionId);

      expect(result.success).toBe(true);
      expect(result.auctionId).toBe(auctionId);
      expect(result.winnerId).toBeUndefined();
      expect(result.winningBid).toBeUndefined();
      expect(result.paymentId).toBeUndefined();
    });

    it('should return error when auction not found', async () => {
      const auctionId = 'non-existent';

      // Mock database query returning empty array
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.closeAuction(auctionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auction not found');
    });

    it('should skip already closed auctions', async () => {
      const auctionId = 'auction-123';

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'closed',
        currentBidder: 'vendor-123',
        currentBid: '500000.00',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-06'),
        originalEndTime: new Date('2024-01-06'),
        extensionCount: 0,
        minimumIncrement: '10000.00',
        watchingCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // Mock database query
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      });

      const result = await service.closeAuction(auctionId);

      expect(result.success).toBe(true);
      expect(result.auctionId).toBe(auctionId);
      // Should not create new payment for already closed auction
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should set payment deadline to 24 hours from closure', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const userId = 'user-123';
      const caseId = 'case-123';

      const mockAuction = {
        id: auctionId,
        caseId,
        status: 'active',
        currentBidder: vendorId,
        currentBid: '500000.00',
        startTime: new Date('2024-01-01'),
        endTime: new Date('2024-01-06'),
        originalEndTime: new Date('2024-01-06'),
        extensionCount: 0,
        minimumIncrement: '10000.00',
        watchingCount: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const mockVendor = {
        id: vendorId,
        userId,
        businessName: 'Test Vendor',
        tier: 'tier1_bvn',
        status: 'approved',
      };

      const mockUser = {
        id: userId,
        email: 'vendor@example.com',
        phone: '+2348012345678',
        fullName: 'Test Vendor',
        role: 'vendor',
        status: 'verified_tier_1',
      };

      const mockCase = {
        id: caseId,
        claimReference: 'CLM-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '2000000.00',
        estimatedSalvageValue: '600000.00',
        reservePrice: '420000.00',
        damageSeverity: 'moderate',
        locationName: 'Lagos, Nigeria',
        status: 'active_auction',
      };

      let capturedPaymentDeadline: Date | undefined;

      // Mock database queries
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAuction]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVendor]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCase]),
          }),
        }),
      });

      // Mock payment insert and capture deadline
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockImplementation((values: any) => {
          capturedPaymentDeadline = values.paymentDeadline;
          return {
            returning: vi.fn().mockResolvedValue([{
              id: 'payment-123',
              ...values,
            }]),
          };
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const beforeClosure = new Date();
      await service.closeAuction(auctionId);
      const afterClosure = new Date();

      expect(capturedPaymentDeadline).toBeDefined();
      
      if (capturedPaymentDeadline) {
        const hoursDiff = (capturedPaymentDeadline.getTime() - beforeClosure.getTime()) / (1000 * 60 * 60);
        // Should be approximately 24 hours (allow small variance for test execution time)
        expect(hoursDiff).toBeGreaterThanOrEqual(23.9);
        expect(hoursDiff).toBeLessThanOrEqual(24.1);
      }
    });
  });

  describe('closeExpiredAuctions', () => {
    it('should process multiple expired auctions', async () => {
      const now = new Date();
      const expiredAuctions = [
        {
          id: 'auction-1',
          caseId: 'case-1',
          status: 'active',
          currentBidder: null,
          currentBid: null,
          endTime: new Date(now.getTime() - 1000),
          startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(now.getTime() - 1000),
          extensionCount: 0,
          minimumIncrement: '10000.00',
          watchingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'auction-2',
          caseId: 'case-2',
          status: 'active',
          currentBidder: null,
          currentBid: null,
          endTime: new Date(now.getTime() - 2000),
          startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(now.getTime() - 2000),
          extensionCount: 0,
          minimumIncrement: '10000.00',
          watchingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock database query for expired auctions
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(expiredAuctions),
        }),
      });

      // Mock individual auction queries
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(expiredAuctions),
        }),
      }).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation((limit: number) => {
              const auctionId = (vi.mocked(db.select).mock.calls.length % 2 === 0) ? 'auction-1' : 'auction-2';
              const auction = expiredAuctions.find(a => a.id === auctionId);
              return Promise.resolve(auction ? [auction] : []);
            }),
          }),
        }),
      });

      // Mock auction updates
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.closeExpiredAuctions();

      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const now = new Date();
      const expiredAuctions = [
        {
          id: 'auction-1',
          caseId: 'case-1',
          status: 'active',
          currentBidder: null,
          currentBid: null,
          endTime: new Date(now.getTime() - 1000),
          startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(now.getTime() - 1000),
          extensionCount: 0,
          minimumIncrement: '10000.00',
          watchingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'auction-2',
          caseId: 'case-2',
          status: 'active',
          currentBidder: null,
          currentBid: null,
          endTime: new Date(now.getTime() - 2000),
          startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(now.getTime() - 2000),
          extensionCount: 0,
          minimumIncrement: '10000.00',
          watchingCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock database query for expired auctions
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(expiredAuctions),
        }),
      });

      // Mock first auction to fail, second to succeed
      let callCount = 0;
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(expiredAuctions),
        }),
      }).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First auction - return empty to simulate not found
                return Promise.resolve([]);
              }
              // Second auction - return valid data
              return Promise.resolve([expiredAuctions[1]]);
            }),
          }),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await service.closeExpiredAuctions();

      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(false);
      expect(result.results[1].success).toBe(true);
    });
  });
});
