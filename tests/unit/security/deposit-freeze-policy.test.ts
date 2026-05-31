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
    expect(paymentService).toContain('description: `Auction-specific frozen funds settled after payment confirmation`');
    expect(paymentService).toMatch(/status:\s*'verified'[\s\S]*unfreezeNonWinnerDeposits\(auctionId, vendorId\)/);
  });
});
