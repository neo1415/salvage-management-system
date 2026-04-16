/**
 * Bid Service Unit Tests
 * Tests bid placement flow with deposit integration
 * 
 * Requirements:
 * - Requirement 3.4: Create bid record with depositAmount
 * - Requirement 3.5: Rollback on deposit freeze failure
 * - Requirement 4.3: Update bid status to "outbid"
 * - Requirement 4.4: Freeze new deposit when vendor re-bids
 * - Requirement 27.1-27.6: Concurrent bid handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { bidService, PlaceBidParams } from '@/features/auctions/services/bid.service';
import { depositCalculatorService } from '@/features/auctions/services/deposit-calculator.service';
import { bidValidatorService } from '@/features/auctions/services/bid-validator.service';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { db } from '@/lib/db/drizzle';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/features/auctions/services/deposit-calculator.service');
vi.mock('@/features/auctions/services/bid-validator.service');
vi.mock('@/features/auctions/services/escrow.service');

describe('BidService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('placeBid', () => {
    const mockParams: PlaceBidParams = {
      vendorId: 'vendor-123',
      auctionId: 'auction-456',
      bidAmount: 1000000,
      userId: 'user-789',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile',
    };

    const mockAuction = {
      id: 'auction-456',
      currentBid: '900000',
      currentBidder: 'vendor-old',
      minimumIncrement: '800000',
      status: 'active',
    };

    const mockVendor = {
      id: 'vendor-123',
      tier: 'tier2_full',
      userId: 'user-789',
    };

    const mockWalletBalance = {
      balance: 5000000,
      availableBalance: 5000000,
      frozenAmount: 0,
      forfeitedAmount: 0,
    };

    it('should successfully place a bid with deposit integration', async () => {
      // Setup mocks
      let queryCount = 0;
      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            queryCount++;
            if (queryCount === 1) {
              return Promise.resolve([mockAuction]);
            } else if (queryCount === 2) {
              return Promise.resolve([mockVendor]);
            }
            return Promise.resolve([]); // No existing bid
          }),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{
            id: 'bid-new',
            auctionId: 'auction-456',
            vendorId: 'vendor-123',
            amount: '1000000',
          }]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue(mockWalletBalance);

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: true,
        errors: [],
        depositAmount: 100000,
      });

      vi.mocked(escrowService.freezeDeposit).mockResolvedValue();
      vi.mocked(escrowService.unfreezeDeposit).mockResolvedValue();

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.bidId).toBe('bid-new');
      expect(result.depositAmount).toBe(100000);
      expect(escrowService.freezeDeposit).toHaveBeenCalledWith(
        'vendor-123',
        100000,
        'auction-456',
        'user-789'
      );
    });

    it('should rollback on deposit freeze failure', async () => {
      // Setup mocks
      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            // First call returns auction, second returns vendor
            const callCount = vi.mocked(mockTransaction).mock.calls.length;
            if (callCount === 1) {
              return Promise.resolve([mockAuction]);
            }
            return Promise.resolve([mockVendor]);
          }),
          orderBy: vi.fn().mockReturnThis(),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue(mockWalletBalance);

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: true,
        errors: [],
        depositAmount: 100000,
      });

      vi.mocked(escrowService.freezeDeposit).mockRejectedValue(
        new Error('Insufficient available balance')
      );

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert - Requirement 3.5: Rollback on freeze failure
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient available balance');
      expect(escrowService.freezeDeposit).toHaveBeenCalled();
    });

    it('should calculate incremental deposit for bid increases', async () => {
      // Setup mocks
      const existingBid = {
        id: 'bid-old',
        auctionId: 'auction-456',
        vendorId: 'vendor-123',
        amount: '900000',
        createdAt: new Date(),
      };

      let queryCount = 0;
      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            queryCount++;
            if (queryCount === 1) {
              return Promise.resolve([mockAuction]);
            } else if (queryCount === 2) {
              return Promise.resolve([mockVendor]);
            } else if (queryCount === 3) {
              return Promise.resolve([existingBid]);
            }
            return Promise.resolve([]);
          }),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{
            id: 'bid-new',
            auctionId: 'auction-456',
            vendorId: 'vendor-123',
            amount: '1000000',
          }]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue(mockWalletBalance);

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: true,
        errors: [],
        depositAmount: 100000,
      });

      vi.mocked(depositCalculatorService.calculateIncrementalDeposit).mockReturnValue(10000);

      vi.mocked(escrowService.freezeDeposit).mockResolvedValue();

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert - Requirement 4.4: Calculate incremental deposit
      expect(result.success).toBe(true);
      expect(depositCalculatorService.calculateIncrementalDeposit).toHaveBeenCalledWith(
        1000000,
        900000,
        0.10,
        100000
      );
      expect(escrowService.freezeDeposit).toHaveBeenCalledWith(
        'vendor-123',
        10000,
        'auction-456',
        'user-789'
      );
    });

    it('should unfreeze previous bidder deposit when outbid', async () => {
      // Setup mocks
      const previousBid = {
        id: 'bid-previous',
        auctionId: 'auction-456',
        vendorId: 'vendor-old',
        amount: '900000',
        createdAt: new Date(),
      };

      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            const callCount = vi.mocked(mockTransaction).mock.calls.length;
            if (callCount === 1) {
              return Promise.resolve([mockAuction]);
            } else if (callCount === 2) {
              return Promise.resolve([mockVendor]);
            } else if (callCount === 3) {
              return Promise.resolve([]); // No existing bid for current vendor
            }
            return Promise.resolve([previousBid]);
          }),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{
            id: 'bid-new',
            auctionId: 'auction-456',
            vendorId: 'vendor-123',
            amount: '1000000',
          }]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue(mockWalletBalance);

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: true,
        errors: [],
        depositAmount: 100000,
      });

      vi.mocked(depositCalculatorService.calculateDeposit).mockReturnValue(90000);

      vi.mocked(escrowService.freezeDeposit).mockResolvedValue();
      vi.mocked(escrowService.unfreezeDeposit).mockResolvedValue();

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert - Requirement 4.1-4.2: Unfreeze previous bidder
      expect(result.success).toBe(true);
      expect(escrowService.unfreezeDeposit).toHaveBeenCalledWith(
        'vendor-old',
        90000,
        'auction-456',
        'user-789'
      );
    });

    it('should return validation errors when bid is invalid', async () => {
      // Setup mocks
      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            const callCount = vi.mocked(mockTransaction).mock.calls.length;
            if (callCount === 1) {
              return Promise.resolve([mockAuction]);
            }
            return Promise.resolve([mockVendor]);
          }),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue({
        balance: 50000,
        availableBalance: 50000,
        frozenAmount: 0,
        forfeitedAmount: 0,
      });

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: false,
        errors: ['Insufficient available balance for deposit'],
      });

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Insufficient available balance for deposit');
      expect(escrowService.freezeDeposit).not.toHaveBeenCalled();
    });

    it('should handle timeout errors gracefully', async () => {
      // Setup mocks
      vi.mocked(db.transaction).mockRejectedValue(
        new Error('Lock acquisition timeout')
      );

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert - Requirement 27.6: Return error on timeout
      expect(result.success).toBe(false);
      expect(result.error).toBe('System busy, please retry');
    });

    it('should not unfreeze same vendor when they increase their own bid', async () => {
      // Setup mocks - current bidder is same as new bidder
      const auctionWithSameBidder = {
        ...mockAuction,
        currentBidder: 'vendor-123', // Same as mockParams.vendorId
      };

      const existingBid = {
        id: 'bid-old',
        auctionId: 'auction-456',
        vendorId: 'vendor-123',
        amount: '900000',
        createdAt: new Date(),
      };

      const mockTransaction = vi.fn(async (callback) => {
        return await callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(() => {
            const callCount = vi.mocked(mockTransaction).mock.calls.length;
            if (callCount === 1) {
              return Promise.resolve([auctionWithSameBidder]);
            } else if (callCount === 2) {
              return Promise.resolve([mockVendor]);
            }
            return Promise.resolve([existingBid]);
          }),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{
            id: 'bid-new',
            auctionId: 'auction-456',
            vendorId: 'vendor-123',
            amount: '1000000',
          }]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
        });
      });

      vi.mocked(db.transaction).mockImplementation(mockTransaction as any);

      vi.mocked(escrowService.getBalance).mockResolvedValue(mockWalletBalance);

      vi.mocked(bidValidatorService.validateBid).mockResolvedValue({
        valid: true,
        errors: [],
        depositAmount: 100000,
      });

      vi.mocked(depositCalculatorService.calculateIncrementalDeposit).mockReturnValue(10000);

      vi.mocked(escrowService.freezeDeposit).mockResolvedValue();

      // Execute
      const result = await bidService.placeBid(mockParams);

      // Assert - Should not unfreeze when same vendor
      expect(result.success).toBe(true);
      expect(escrowService.unfreezeDeposit).not.toHaveBeenCalled();
    });
  });

  describe('getVendorCurrentBid', () => {
    it('should return vendor current bid on auction', async () => {
      const mockBid = {
        id: 'bid-123',
        auctionId: 'auction-456',
        vendorId: 'vendor-123',
        amount: '1000000',
        createdAt: new Date(),
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockBid]),
      } as any);

      const result = await bidService.getVendorCurrentBid('vendor-123', 'auction-456');

      expect(result).toEqual(mockBid);
    });

    it('should return null when vendor has no bids', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await bidService.getVendorCurrentBid('vendor-123', 'auction-456');

      expect(result).toBeNull();
    });
  });

  describe('getAuctionBids', () => {
    it('should return all bids for an auction', async () => {
      const mockBids = [
        {
          id: 'bid-1',
          auctionId: 'auction-456',
          vendorId: 'vendor-1',
          amount: '1000000',
          createdAt: new Date(),
        },
        {
          id: 'bid-2',
          auctionId: 'auction-456',
          vendorId: 'vendor-2',
          amount: '900000',
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockBids),
      } as any);

      const result = await bidService.getAuctionBids('auction-456');

      expect(result).toEqual(mockBids);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when auction has no bids', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await bidService.getAuctionBids('auction-456');

      expect(result).toEqual([]);
    });
  });
});
