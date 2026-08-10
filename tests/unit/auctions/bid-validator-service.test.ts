import { describe, expect, it } from 'vitest';
import { bidValidatorService } from '@/features/auctions/services/bid-validator.service';

describe('BidValidatorService', () => {
  const defaultParams = {
    vendorId: 'vendor-123',
    auctionId: 'auction-123',
    bidAmount: 1_000_000,
    currentHighestBid: null,
    vendorTier: 'tier2_full' as const,
    availableBalance: 200_000,
    depositRate: 0.1,
    minimumDepositFloor: 100_000,
    tier1Limit: 500_000,
  };

  it('accepts a valid opening bid', async () => {
    const result = await bidValidatorService.validateBid(defaultParams);

    expect(result).toEqual({ valid: true, errors: [], depositAmount: 100_000 });
  });

  it('accepts any strictly higher bid without a configured increment', async () => {
    const result = await bidValidatorService.validateBid({
      ...defaultParams,
      bidAmount: 1_000_001,
      currentHighestBid: 1_000_000,
    });

    expect(result.valid).toBe(true);
  });

  it('rejects a bid equal to or below the current bid', async () => {
    const equal = await bidValidatorService.validateBid({
      ...defaultParams,
      bidAmount: 1_000_000,
      currentHighestBid: 1_000_000,
    });
    const lower = await bidValidatorService.validateBid({
      ...defaultParams,
      bidAmount: 999_999,
      currentHighestBid: 1_000_000,
    });

    expect(equal.errors).toContain('A new bid must be higher than the current bid');
    expect(lower.errors).toContain('A new bid must be higher than the current bid');
  });

  it('rejects a non-positive opening bid', async () => {
    const result = await bidValidatorService.validateBid({
      ...defaultParams,
      bidAmount: 0,
    });

    expect(result.errors).toContain('The opening bid must be greater than zero');
  });

  it('rejects an insufficient available balance', async () => {
    const result = await bidValidatorService.validateBid({
      ...defaultParams,
      availableBalance: 50_000,
    });

    expect(result.errors).toContain('Insufficient available balance for deposit');
  });

  it('keeps the Tier 1 bid ceiling independent of bid increments', async () => {
    const result = await bidValidatorService.validateBid({
      ...defaultParams,
      bidAmount: 500_001,
      vendorTier: 'tier1_bvn',
    });

    expect(result.errors).toContain('Tier 1 vendors cannot bid above NGN 500,000');
  });
});
