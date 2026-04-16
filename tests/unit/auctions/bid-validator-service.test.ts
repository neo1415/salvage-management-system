import { describe, it, expect } from 'vitest';
import { bidValidatorService } from '@/features/auctions/services/bid-validator.service';

describe('BidValidatorService', () => {
  const defaultParams = {
    vendorId: 'vendor-123',
    auctionId: 'auction-123',
    bidAmount: 1000000,
    reservePrice: 700000,
    currentHighestBid: null,
    vendorTier: 'tier2_full' as const,
    availableBalance: 200000,
    depositRate: 0.10,
    minimumDepositFloor: 100000,
    minimumBidIncrement: 20000,
    tier1Limit: 500000,
  };

  describe('validateBid', () => {
    it('should pass validation when all criteria are met', async () => {
      const result = await bidValidatorService.validateBid(defaultParams);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.depositAmount).toBe(100000);
    });

    it('should fail when available balance is insufficient', async () => {
      const result = await bidValidatorService.validateBid({
        ...defaultParams,
        availableBalance: 50000,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Insufficient available balance for deposit');
    });

    it('should fail when bid is below reserve price', async () => {
      const result = await bidValidatorService.validateBid({
        ...defaultParams,
        bidAmount: 600000,
        reservePrice: 700000,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bid must be at least ₦700,000');
    });

    it('should fail when bid increment is too small', async () => {
      const result = await bidValidatorService.validateBid({
        ...defaultParams,
        bidAmount: 1010000,
        currentHighestBid: 1000000,
        minimumBidIncrement: 20000,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum bid increment is ₦20,000');
    });

    it('should fail when Tier 1 vendor bids above limit', async () => {
      const result = await bidValidatorService.validateBid({
        ...defaultParams,
        bidAmount: 600000,
        vendorTier: 'tier1_bvn',
        tier1Limit: 500000,
        reservePrice: 400000,
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tier 1 vendors cannot bid above ₦500,000');
    });
  });
});
