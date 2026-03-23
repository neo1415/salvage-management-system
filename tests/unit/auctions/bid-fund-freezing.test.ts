/**
 * Unit tests for Bid Fund Freezing
 * 
 * Tests that funds are frozen during bidding, not at auction closure
 * 
 * Requirements:
 * - Funds must be frozen when bid is placed
 * - Previous bidder's funds must be unfrozen when outbid
 * - Bid placement fails if funds cannot be frozen
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BiddingService } from '@/features/auctions/services/bidding.service';
import { escrowService } from '@/features/payments/services/escrow.service';
import { db } from '@/lib/db/drizzle';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      auctions: {
        findFirst: vi.fn(),
      },
      vendors: {
        findFirst: vi.fn(),
      },
      bids: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock('@/features/payments/services/escrow.service', () => ({
  escrowService: {
    freezeFunds: vi.fn(),
    unfreezeFunds: vi.fn(),
    getBalance: vi.fn(),
  },
}));

vi.mock('@/features/auth/services/otp.service', () => ({
  otpService: {
    verifyOTP: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    BID_PLACED: 'bid_placed',
  },
  AuditEntityType: {
    BID: 'bid',
  },
  DeviceType: {
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
  },
}));

vi.mock('@/lib/socket/server', () => ({
  broadcastNewBid: vi.fn(),
  notifyVendorOutbid: vi.fn(),
}));

vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendBidAlertEmail: vi.fn(),
  },
}));

vi.mock('./auto-extend.service', () => ({
  autoExtendService: {
    extendAuction: vi.fn().mockResolvedValue({ success: false }),
  },
}));

describe('Bid Fund Freezing', () => {
  let service: BiddingService;

  beforeEach(() => {
    service = new BiddingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Freeze funds on bid placement', () => {
    it('should freeze funds when vendor places first bid', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const userId = 'user-123';
      const bidAmount = 500000;

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: null,
        currentBid: null,
        minimumIncrement: '420000',
        case: {
          id: 'case-123',
          claimReference: 'CLM-001',
        },
      };

      const mockVendor = {
        id: vendorId,
        userId,
        tier: 'tier2_full',
      };

      const mockUser = {
        id: userId,
        phone: '+2348012345678',
        email: 'vendor@example.com',
        fullName: 'Test Vendor',
      };

      const mockBid = {
        id: 'bid-123',
        auctionId,
        vendorId,
        amount: bidAmount.toString(),
        createdAt: new Date(),
      };

      // Mock database queries
      (db.query.auctions.findFirst as any).mockResolvedValue(mockAuction);
      (db.query.vendors.findFirst as any).mockResolvedValue(mockVendor);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock wallet balance check
      (escrowService.getBalance as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 600000,
        frozenAmount: 0,
      });

      // Mock bid insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBid]),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock freeze funds success
      (escrowService.freezeFunds as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 100000,
        frozenAmount: 500000,
      });

      const result = await service.placeBid({
        auctionId,
        vendorId,
        amount: bidAmount,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(true);
      expect(escrowService.freezeFunds).toHaveBeenCalledWith(
        vendorId,
        bidAmount,
        auctionId,
        userId
      );
    });

    it('should rollback bid if funds cannot be frozen', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const userId = 'user-123';
      const bidAmount = 500000;

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: null,
        currentBid: null,
        minimumIncrement: '420000',
        case: {
          id: 'case-123',
          claimReference: 'CLM-001',
        },
      };

      const mockVendor = {
        id: vendorId,
        userId,
        tier: 'tier2_full',
      };

      const mockUser = {
        id: userId,
        phone: '+2348012345678',
        email: 'vendor@example.com',
        fullName: 'Test Vendor',
      };

      const mockBid = {
        id: 'bid-123',
        auctionId,
        vendorId,
        amount: bidAmount.toString(),
        createdAt: new Date(),
      };

      // Mock database queries
      (db.query.auctions.findFirst as any).mockResolvedValue(mockAuction);
      (db.query.vendors.findFirst as any).mockResolvedValue(mockVendor);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock wallet balance check
      (escrowService.getBalance as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 600000,
        frozenAmount: 0,
      });

      // Mock bid insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBid]),
        }),
      });

      // Mock bid delete for rollback
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      // Mock freeze funds failure
      (escrowService.freezeFunds as any).mockRejectedValue(
        new Error('Insufficient available balance')
      );

      const result = await service.placeBid({
        auctionId,
        vendorId,
        amount: bidAmount,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to freeze funds');
      expect(db.delete).toHaveBeenCalled();
    });

    it('should unfreeze previous bidder funds when outbid', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const previousVendorId = 'vendor-456';
      const userId = 'user-123';
      const previousUserId = 'user-456';
      const bidAmount = 550000;
      const previousBidAmount = 500000;

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: previousVendorId,
        currentBid: previousBidAmount.toString(),
        minimumIncrement: '10000',
        case: {
          id: 'case-123',
          claimReference: 'CLM-001',
        },
      };

      const mockVendor = {
        id: vendorId,
        userId,
        tier: 'tier2_full',
      };

      const mockPreviousVendor = {
        id: previousVendorId,
        userId: previousUserId,
        tier: 'tier2_full',
      };

      const mockUser = {
        id: userId,
        phone: '+2348012345678',
        email: 'vendor@example.com',
        fullName: 'Test Vendor',
      };

      const mockPreviousBid = {
        id: 'bid-456',
        auctionId,
        vendorId: previousVendorId,
        amount: previousBidAmount.toString(),
        createdAt: new Date(),
      };

      const mockNewBid = {
        id: 'bid-123',
        auctionId,
        vendorId,
        amount: bidAmount.toString(),
        createdAt: new Date(),
      };

      // Mock database queries
      (db.query.auctions.findFirst as any).mockResolvedValue(mockAuction);
      (db.query.vendors.findFirst as any).mockResolvedValue(mockVendor);
      (db.query.bids.findFirst as any).mockResolvedValue(mockPreviousBid);

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([mockUser]);
              } else {
                return Promise.resolve([mockPreviousVendor]);
              }
            }),
          }),
        }),
      }));

      // Mock wallet balance check
      (escrowService.getBalance as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 600000,
        frozenAmount: 0,
      });

      // Mock bid insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewBid]),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock freeze and unfreeze
      (escrowService.freezeFunds as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 50000,
        frozenAmount: 550000,
      });

      (escrowService.unfreezeFunds as any).mockResolvedValue({
        balance: 500000,
        availableBalance: 500000,
        frozenAmount: 0,
      });

      const result = await service.placeBid({
        auctionId,
        vendorId,
        amount: bidAmount,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(true);
      expect(escrowService.freezeFunds).toHaveBeenCalledWith(
        vendorId,
        bidAmount,
        auctionId,
        userId
      );
      expect(escrowService.unfreezeFunds).toHaveBeenCalledWith(
        previousVendorId,
        previousBidAmount,
        auctionId,
        previousUserId
      );
    });

    it('should not fail bid placement if unfreezing previous bidder fails', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const previousVendorId = 'vendor-456';
      const userId = 'user-123';
      const previousUserId = 'user-456';
      const bidAmount = 550000;
      const previousBidAmount = 500000;

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: previousVendorId,
        currentBid: previousBidAmount.toString(),
        minimumIncrement: '10000',
        case: {
          id: 'case-123',
          claimReference: 'CLM-001',
        },
      };

      const mockVendor = {
        id: vendorId,
        userId,
        tier: 'tier2_full',
      };

      const mockPreviousVendor = {
        id: previousVendorId,
        userId: previousUserId,
        tier: 'tier2_full',
      };

      const mockUser = {
        id: userId,
        phone: '+2348012345678',
        email: 'vendor@example.com',
        fullName: 'Test Vendor',
      };

      const mockPreviousBid = {
        id: 'bid-456',
        auctionId,
        vendorId: previousVendorId,
        amount: previousBidAmount.toString(),
        createdAt: new Date(),
      };

      const mockNewBid = {
        id: 'bid-123',
        auctionId,
        vendorId,
        amount: bidAmount.toString(),
        createdAt: new Date(),
      };

      // Mock database queries
      (db.query.auctions.findFirst as any).mockResolvedValue(mockAuction);
      (db.query.vendors.findFirst as any).mockResolvedValue(mockVendor);
      (db.query.bids.findFirst as any).mockResolvedValue(mockPreviousBid);

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return Promise.resolve([mockUser]);
              } else {
                return Promise.resolve([mockPreviousVendor]);
              }
            }),
          }),
        }),
      }));

      // Mock wallet balance check
      (escrowService.getBalance as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 600000,
        frozenAmount: 0,
      });

      // Mock bid insert
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewBid]),
        }),
      });

      // Mock auction update
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock freeze success but unfreeze failure
      (escrowService.freezeFunds as any).mockResolvedValue({
        balance: 600000,
        availableBalance: 50000,
        frozenAmount: 550000,
      });

      (escrowService.unfreezeFunds as any).mockRejectedValue(
        new Error('Unfreeze failed')
      );

      const result = await service.placeBid({
        auctionId,
        vendorId,
        amount: bidAmount,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Bid should still succeed even if unfreezing previous bidder fails
      expect(result.success).toBe(true);
      expect(escrowService.freezeFunds).toHaveBeenCalled();
      expect(escrowService.unfreezeFunds).toHaveBeenCalled();
    });
  });

  describe('Balance validation before bidding', () => {
    it('should reject bid if vendor has insufficient wallet balance', async () => {
      const auctionId = 'auction-123';
      const vendorId = 'vendor-123';
      const userId = 'user-123';
      const bidAmount = 500000;

      const mockAuction = {
        id: auctionId,
        caseId: 'case-123',
        status: 'active',
        currentBidder: null,
        currentBid: null,
        minimumIncrement: '420000',
        case: {
          id: 'case-123',
          claimReference: 'CLM-001',
        },
      };

      const mockVendor = {
        id: vendorId,
        userId,
        tier: 'tier2_full',
      };

      const mockUser = {
        id: userId,
        phone: '+2348012345678',
        email: 'vendor@example.com',
        fullName: 'Test Vendor',
      };

      // Mock database queries
      (db.query.auctions.findFirst as any).mockResolvedValue(mockAuction);
      (db.query.vendors.findFirst as any).mockResolvedValue(mockVendor);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Mock insufficient wallet balance
      (escrowService.getBalance as any).mockResolvedValue({
        balance: 100000,
        availableBalance: 100000,
        frozenAmount: 0,
      });

      const result = await service.placeBid({
        auctionId,
        vendorId,
        amount: bidAmount,
        otp: '123456',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient wallet balance');
      expect(escrowService.freezeFunds).not.toHaveBeenCalled();
    });
  });
});
