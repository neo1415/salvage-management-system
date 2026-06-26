/**
 * Pickup price adjustment reconciliation (Batch B5).
 * Compares amount collected (payments.amount) vs final settled sale amount.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import {
  getEffectiveSaleAmount,
  parseNumericAmount,
  type EffectiveSaleAmountAuction,
} from './effective-sale-amount';

export type PickupSettlementAdjustment = {
  auctionId: string;
  claimReference: string | null;
  paidAmount: number;
  settledAmount: number;
  delta: number;
  adjustedAt: string | null;
};

export type SettlementReconciliationSummary = {
  adjustedCount: number;
  paidVsSettledDelta: number;
  settledRecoveryTotal: number;
  items: PickupSettlementAdjustment[];
};

export type PaymentSettlementInfo = {
  paidAmount: string;
  settledAmount: string;
  originalWinningBid: string | null;
  paidVsSettledDelta: string;
  hasPriceAdjustment: boolean;
  note: string;
};

export function describePaidVsSettledDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) {
    return 'Collected amount matches the final settled sale amount.';
  }
  const abs = Math.abs(delta).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  if (delta > 0) {
    return `NGN ${abs} more was collected than the final settled sale amount after pickup adjustment. Verified receipts include the higher paid amount; recovery reports use the settled amount.`;
  }
  return `Final settled amount is NGN ${abs} above the amount collected. Review reimbursement or external settlement for this case.`;
}

export function buildPaymentSettlementFields(
  paidAmount: string | number | null | undefined,
  auction: (EffectiveSaleAmountAuction & { originalWinningBid?: string | number | null }) | null
): {
  effectiveSaleAmount: string | null;
  settlement: PaymentSettlementInfo | null;
} {
  if (!auction) {
    return { effectiveSaleAmount: null, settlement: null };
  }

  const settled = parseNumericAmount(auction.finalSettledAmount);
  const effective = getEffectiveSaleAmount(auction, { amount: paidAmount });
  const paid = parseNumericAmount(paidAmount) ?? 0;

  if (settled === null) {
    return {
      effectiveSaleAmount: effective > 0 ? effective.toFixed(2) : null,
      settlement: null,
    };
  }

  const delta = paid - settled;
  return {
    effectiveSaleAmount: settled.toFixed(2),
    settlement: {
      paidAmount: paid.toFixed(2),
      settledAmount: settled.toFixed(2),
      originalWinningBid:
        parseNumericAmount(auction.originalWinningBid)?.toFixed(2) ?? paid.toFixed(2),
      paidVsSettledDelta: delta.toFixed(2),
      hasPriceAdjustment: true,
      note: describePaidVsSettledDelta(delta),
    },
  };
}

export async function getSettlementReconciliationSummary(
  itemLimit = 25
): Promise<SettlementReconciliationSummary> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id as auction_id,
      sc.claim_reference,
      p.amount as paid_amount,
      a.final_settled_amount,
      a.price_adjusted_at
    FROM auctions a
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
    INNER JOIN payments p ON p.auction_id = a.id
      AND p.status = 'verified'
      AND p.vendor_id = a.current_bidder
    WHERE a.final_settled_amount IS NOT NULL
    ORDER BY a.id, p.verified_at DESC NULLS LAST, p.created_at DESC
  `)) as Record<string, unknown>[];

  const items: PickupSettlementAdjustment[] = rows.map((row) => {
    const paid = parseNumericAmount(row.paid_amount as string) ?? 0;
    const settled = parseNumericAmount(row.final_settled_amount as string) ?? 0;
    const adjustedAt = row.price_adjusted_at;
    return {
      auctionId: String(row.auction_id),
      claimReference: row.claim_reference ? String(row.claim_reference) : null,
      paidAmount: paid,
      settledAmount: settled,
      delta: paid - settled,
      adjustedAt:
        adjustedAt instanceof Date
          ? adjustedAt.toISOString()
          : adjustedAt
            ? String(adjustedAt)
            : null,
    };
  });

  items.sort((a, b) => {
    const aTime = a.adjustedAt ? Date.parse(a.adjustedAt) : 0;
    const bTime = b.adjustedAt ? Date.parse(b.adjustedAt) : 0;
    return bTime - aTime;
  });

  const limited = items.slice(0, itemLimit);
  const paidVsSettledDelta = items.reduce((sum, item) => sum + item.delta, 0);
  const settledRecoveryTotal = items.reduce((sum, item) => sum + item.settledAmount, 0);

  return {
    adjustedCount: items.length,
    paidVsSettledDelta: Math.round(paidVsSettledDelta * 100) / 100,
    settledRecoveryTotal: Math.round(settledRecoveryTotal * 100) / 100,
    items: limited,
  };
}
