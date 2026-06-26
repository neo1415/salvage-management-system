/**
 * Effective sale amount after pickup price adjustments (Batch B5).
 *
 * Business rules:
 * - price_adjustment_recorded → auctions.final_settled_amount is authoritative
 * - Otherwise → verified payment amount, then current bid
 * - Never mutates payments.amount or bids.amount
 */

export type EffectiveSaleAmountAuction = {
  finalSettledAmount?: string | number | null;
  currentBid?: string | number | null;
};

export type EffectiveSaleAmountPayment = {
  amount?: string | number | null;
} | null | undefined;

export function parseNumericAmount(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Resolve the sale amount used for revenue, reports, and pickup display.
 */
export function getEffectiveSaleAmount(
  auction: EffectiveSaleAmountAuction,
  payment?: EffectiveSaleAmountPayment
): number {
  const settled = parseNumericAmount(auction.finalSettledAmount);
  if (settled !== null) {
    return settled;
  }

  const paid = parseNumericAmount(payment?.amount);
  if (paid !== null) {
    return paid;
  }

  const bid = parseNumericAmount(auction.currentBid);
  if (bid !== null) {
    return bid;
  }

  return 0;
}

/**
 * SQL expression for raw queries joining auctions (a) and payments (p).
 * Prefer COALESCE(final_settled_amount, payment, bid).
 */
export function effectiveSaleAmountSqlFragment(
  auctionAlias = 'a',
  paymentAlias = 'p'
): string {
  return `COALESCE(${auctionAlias}.final_settled_amount::numeric, ${paymentAlias}.amount::numeric, ${auctionAlias}.current_bid::numeric, 0)`;
}

/**
 * Original winning amount before adjustment (for audit/display).
 */
export function getOriginalWinningAmount(
  auction: EffectiveSaleAmountAuction & { originalWinningBid?: string | number | null },
  payment?: EffectiveSaleAmountPayment
): number {
  const original = parseNumericAmount(auction.originalWinningBid);
  if (original !== null) {
    return original;
  }
  return getEffectiveSaleAmount(
    { finalSettledAmount: null, currentBid: auction.currentBid },
    payment
  );
}

export function hasPriceAdjustment(auction: EffectiveSaleAmountAuction): boolean {
  return parseNumericAmount(auction.finalSettledAmount) !== null;
}
