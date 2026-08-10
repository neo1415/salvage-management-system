import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function stripComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');
}

describe('deposit freeze policy guardrails', () => {
  it('gates active bid balance checks and fund freezing behind the published deposit policy', () => {
    const biddingService = stripComments(source('src/features/auctions/services/bidding.service.ts'));

    expect(biddingService).toContain('policy.escrow.depositSystemEnabled');
    expect(biddingService).toMatch(/if \(depositSystemEnabled\)[\s\S]*escrowService\.getBalance\(vendorId\)/);
    expect(biddingService).toMatch(/if \(policy\.escrow\.depositSystemEnabled\)[\s\S]*incrementalDeposit/);
    expect(biddingService).toMatch(/if \(incrementalDeposit > 0\)[\s\S]*escrowService\.freezeFunds/);
  });

  it('does not unfreeze the previous highest bidder simply because they were outbid', () => {
    const bidService = stripComments(source('src/features/auctions/services/bid.service.ts'));
    const previousBidderSection = bidService.slice(bidService.indexOf('const previousBidderId'));

    expect(previousBidderSection).not.toMatch(/previousBidderId[\s\S]*unfreezeDeposit\s*\(/);
  });

  it('keeps the configured top bidders frozen and only releases bidders below the fallback set at closure', () => {
    const closureService = stripComments(source('src/features/auctions/services/auction-closure.service.ts'));

    expect(closureService).toContain('const topBidders = uniqueBidders.slice(0, actualTopBiddersCount)');
    expect(closureService).toContain('const lowerBidders = uniqueBidders.slice(actualTopBiddersCount)');
    expect(closureService).toMatch(/for \(const bidder of lowerBidders\)[\s\S]*unfreezeDeposit\s*\(/);
  });

  it('settles only the auction-specific frozen deposit and releases non-winner deposits after payment verification', () => {
    const paymentService = stripComments(source('src/features/auction-deposit/services/payment.service.ts'));

    expect(paymentService).toContain('frozenAmount: depositAmount');
    expect(paymentService).toContain('Auction-specific frozen funds settled after payment confirmation');
    expect(paymentService).toMatch(/status:\s*'verified'[\s\S]*unfreezeNonWinnerDeposits\(auctionId, vendorId\)/);
  });

  it('keeps deposit-disabled auctions deposit-free through closure and payment readiness', () => {
    const closureService = stripComments(source('src/features/auctions/services/auction-closure.service.ts'));
    const readinessService = stripComments(source('src/features/auction-deposit/services/payment-readiness.service.ts'));

    expect(closureService).toContain('effectivePolicy.escrow.depositSystemEnabled');
    expect(closureService).toMatch(/depositsEnabled && !isLegacyAuction[\s\S]*:\s*0/);
    expect(readinessService).toMatch(/!policy\.escrow\.depositSystemEnabled\) return '0\.00'/);
  });

  it('publishes payment verification only after local wallet settlement', () => {
    const paymentService = stripComments(source('src/features/auction-deposit/services/payment.service.ts'));
    const settlementIndex = paymentService.indexOf('await this.settleAuctionWalletFunds');
    const verifiedIndex = paymentService.indexOf("status: 'verified'", settlementIndex);

    expect(settlementIndex).toBeGreaterThan(-1);
    expect(verifiedIndex).toBeGreaterThan(settlementIndex);
  });

  it('invalidates every versioned auction detail variant after state mutations', () => {
    const paymentService = source('src/features/auction-deposit/services/payment.service.ts');
    const documentService = source('src/features/documents/services/document.service.ts');
    const pickupService = source('src/features/pickups/services/pickup-confirmation.service.ts');

    expect(paymentService).toContain('invalidateAuctionDetailsCache(auctionId)');
    expect(documentService).toContain('invalidateAuctionDetailsCache(cacheKey)');
    expect(pickupService).toContain('invalidateAuctionDetailsCache(auctionId)');
  });
});
