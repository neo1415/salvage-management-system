import { AuctionStatusService } from '@/features/auctions/services/status.service';

/**
 * UI-facing lifecycle for salvage cases (derived from case + auction + payment rows).
 * DB case_status has no "closed" or "awaiting_payment" — those come from auctions/payments.
 */
export type CaseDisplayStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'cancelled'
  | 'sold'
  | 'active_auction'
  | 'awaiting_payment'
  | 'awaiting_pickup'
  | 'closed';

export interface CaseLifecycleInput {
  /** Prefer `caseStatus`; `status` is accepted for case list rows from /api/cases */
  caseStatus?: string;
  status?: string;
  auctionId?: string | null;
  auctionStatus?: string | null;
  auctionEndTime?: string | null;
  paymentId?: string | null;
  paymentStatus?: string | null;
}

function resolveCaseStatus(input: CaseLifecycleInput): string {
  return input.caseStatus ?? input.status ?? 'draft';
}

function isPaymentVerified(paymentStatus?: string | null): boolean {
  return paymentStatus === 'verified' || paymentStatus === 'completed';
}

/**
 * True only when vendors can still bid: auction.status in (active|extended) and endTime in the future.
 */
export function isCaseInLiveAuction(input: CaseLifecycleInput): boolean {
  return resolveCaseDisplayStatus(input) === 'active_auction';
}

/**
 * Maps DB fields to a single display status for badges, tabs, and KPIs.
 */
export function resolveCaseDisplayStatus(input: CaseLifecycleInput): CaseDisplayStatus {
  const caseStatus = resolveCaseStatus(input);
  const { auctionId, auctionStatus, auctionEndTime, paymentId, paymentStatus } = input;

  if (paymentId && !isPaymentVerified(paymentStatus)) {
    return 'awaiting_payment';
  }

  if (auctionStatus === 'awaiting_payment' && !isPaymentVerified(paymentStatus)) {
    return 'awaiting_payment';
  }

  if (caseStatus === 'sold') {
    return 'sold';
  }

  if (isPaymentVerified(paymentStatus)) {
    return 'awaiting_pickup';
  }

  if (caseStatus !== 'active_auction') {
    return caseStatus as CaseDisplayStatus;
  }

  // case_status is still active_auction in DB
  if (auctionId && auctionStatus && auctionEndTime) {
    if (
      AuctionStatusService.isAuctionActive({
        status: auctionStatus,
        endTime: auctionEndTime,
      })
    ) {
      return 'active_auction';
    }
  } else if (
    auctionId &&
    auctionStatus &&
    (auctionStatus === 'active' || auctionStatus === 'extended')
  ) {
    return 'active_auction';
  }

  // Auction ended (closed / awaiting_payment / forfeited / past endTime): payment path vs no winner
  return 'closed';
}
