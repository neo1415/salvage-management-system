import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  auctionWinners,
  auctions,
  bids,
  escrowWallets,
  payments,
  releaseForms,
} from '@/lib/db/schema';
import { configService } from './config.service';
import { depositCalculatorService } from '@/features/auctions/services/deposit-calculator.service';
import { checkAllDocumentsSigned } from '@/features/documents/services/document.service';

export interface PaymentReadinessContext {
  auction: typeof auctions.$inferSelect;
  winner: {
    vendorId: string;
    bidAmount: string;
    depositAmount: string;
    source: 'auction_winners' | 'repaired_from_current_bidder' | 'repaired_from_bid_history';
  };
  escrowWallet: typeof escrowWallets.$inferSelect | null;
  repairedWinnerRecord: boolean;
  repairedAuctionStatus: boolean;
}

export class PaymentReadinessError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PaymentReadinessError';
    this.statusCode = statusCode;
  }
}

function numericString(value: unknown, fallback = '0.00'): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : fallback;
}

async function getEffectivePaymentDeadlineHours(legacyHours: number): Promise<number> {
  try {
    const { businessPolicyService } = await import('@/features/business-policy');
    const policy = await businessPolicyService.getEffectivePolicy();
    const configured = policy.payments?.paymentDeadlineAfterSigningHours;
    if (typeof configured === 'number' && configured > 0) {
      return configured;
    }
  } catch {
    // Fall back to legacy deposit config
  }
  return legacyHours;
}

async function resolveDepositAmount(params: {
  latestBid: typeof bids.$inferSelect | null;
  bidAmount: number;
}): Promise<string> {
  if (params.latestBid?.depositAmount) {
    return numericString(params.latestBid.depositAmount);
  }

  if (params.latestBid?.isLegacy) {
    return '0.00';
  }

  try {
    const config = await configService.getConfig();
    const deposit = depositCalculatorService.calculateDeposit(
      params.bidAmount,
      config.depositRate / 100,
      config.minimumDepositFloor
    );
    return numericString(deposit);
  } catch (error) {
    console.warn('[PaymentReadiness] Falling back to zero deposit while repairing winner context', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '0.00';
  }
}

async function repairPaymentDeadlines(auctionId: string, vendorId: string): Promise<void> {
  const signedForms = await db.query.releaseForms.findMany({
    where: and(
      eq(releaseForms.auctionId, auctionId),
      eq(releaseForms.vendorId, vendorId),
      eq(releaseForms.status, 'signed')
    ),
  });

  if (signedForms.length === 0) {
    return;
  }

  const needsDeadline = signedForms.some(
    (form) => !form.paymentDeadline || form.paymentDeadline.getTime() <= 0
  );
  if (!needsDeadline) {
    return;
  }

  const config = await configService.getConfig();
  const paymentDeadlineHours = await getEffectivePaymentDeadlineHours(config.paymentDeadlineAfterSigning);
  const paymentDeadline = new Date();
  paymentDeadline.setHours(paymentDeadline.getHours() + paymentDeadlineHours);

  await db
    .update(releaseForms)
    .set({ paymentDeadline, updatedAt: new Date() })
    .where(
      and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId),
        eq(releaseForms.status, 'signed')
      )
    );

  await db
    .update(payments)
    .set({ paymentDeadline, updatedAt: new Date() })
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'pending')
      )
    );
}

async function repairAuctionPaymentStatus(
  auction: typeof auctions.$inferSelect,
  vendorId: string
): Promise<{ auction: typeof auctions.$inferSelect; repaired: boolean }> {
  const payableStatuses = new Set(['awaiting_payment', 'documents_signed']);
  if (payableStatuses.has(auction.status)) {
    return { auction, repaired: false };
  }

  const allSigned = await checkAllDocumentsSigned(auction.id, vendorId);
  if (!allSigned) {
    return { auction, repaired: false };
  }

  if (auction.status !== 'closed') {
    return { auction, repaired: false };
  }

  await repairPaymentDeadlines(auction.id, vendorId);

  const [updatedAuction] = await db
    .update(auctions)
    .set({ status: 'awaiting_payment', updatedAt: new Date() })
    .where(and(eq(auctions.id, auction.id), eq(auctions.status, 'closed')))
    .returning();

  if (!updatedAuction) {
    return { auction, repaired: false };
  }

  console.log(`[PaymentReadiness] Repaired auction ${auction.id}: closed → awaiting_payment`);
  return { auction: updatedAuction, repaired: true };
}

async function resolveWinningBidForVendor(
  auctionId: string,
  vendorId: string,
  auction: typeof auctions.$inferSelect
): Promise<{ latestBid: typeof bids.$inferSelect | null; bidAmount: number } | null> {
  const latestBid = await db.query.bids.findFirst({
    where: and(eq(bids.auctionId, auctionId), eq(bids.vendorId, vendorId)),
    orderBy: desc(bids.amount),
  });

  if (latestBid) {
    const bidAmount = Number(latestBid.amount);
    if (Number.isFinite(bidAmount) && bidAmount > 0) {
      return { latestBid, bidAmount };
    }
  }

  if (auction.currentBidder === vendorId && auction.currentBid) {
    const bidAmount = Number(auction.currentBid);
    if (Number.isFinite(bidAmount) && bidAmount > 0) {
      return { latestBid: null, bidAmount };
    }
  }

  const highestBid = await db.query.bids.findFirst({
    where: eq(bids.auctionId, auctionId),
    orderBy: desc(bids.amount),
  });

  if (highestBid?.vendorId === vendorId) {
    const bidAmount = Number(highestBid.amount);
    if (Number.isFinite(bidAmount) && bidAmount > 0) {
      return { latestBid: highestBid, bidAmount };
    }
  }

  return null;
}

async function repairWinnerRecord(
  auctionId: string,
  vendorId: string,
  auction: typeof auctions.$inferSelect,
  source: PaymentReadinessContext['winner']['source']
): Promise<typeof auctionWinners.$inferSelect> {
  const resolved = await resolveWinningBidForVendor(auctionId, vendorId, auction);
  if (!resolved) {
    throw new PaymentReadinessError(
      'Winner payment record is not ready for this auction yet.',
      400
    );
  }

  const depositAmount = await resolveDepositAmount({
    latestBid: resolved.latestBid,
    bidAmount: resolved.bidAmount,
  });

  const [repairedWinner] = await db
    .insert(auctionWinners)
    .values({
      auctionId,
      vendorId,
      bidAmount: resolved.bidAmount.toFixed(2),
      depositAmount,
      rank: 1,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [auctionWinners.auctionId, auctionWinners.rank],
      set: {
        vendorId,
        bidAmount: resolved.bidAmount.toFixed(2),
        depositAmount,
        status: 'active',
        failedAt: null,
        failureReason: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`[PaymentReadiness] Repaired winner record for auction ${auctionId} (${source})`);
  return repairedWinner;
}

export async function ensurePaymentReadinessContext(
  auctionId: string,
  vendorId: string
): Promise<PaymentReadinessContext> {
  let auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
  });

  if (!auction) {
    throw new PaymentReadinessError('Auction not found', 404);
  }

  const statusRepair = await repairAuctionPaymentStatus(auction, vendorId);
  auction = statusRepair.auction;

  const wallet = await db.query.escrowWallets.findFirst({
    where: eq(escrowWallets.vendorId, vendorId),
  });

  // Always resolve the winner row for THIS vendor (never another rank-1 fallback).
  let winnerRecord = await db.query.auctionWinners.findFirst({
    where: and(
      eq(auctionWinners.auctionId, auctionId),
      eq(auctionWinners.vendorId, vendorId),
      eq(auctionWinners.status, 'active')
    ),
    orderBy: asc(auctionWinners.rank),
  });

  let repairedWinnerRecord = false;

  if (!winnerRecord) {
    const isCurrentWinner = auction.currentBidder === vendorId && auction.currentBid;
    const highestBid = await db.query.bids.findFirst({
      where: eq(bids.auctionId, auctionId),
      orderBy: desc(bids.amount),
    });
    const isHighestBidder = highestBid?.vendorId === vendorId;

    if (!isCurrentWinner && !isHighestBidder) {
      throw new PaymentReadinessError('Forbidden - You are not the winner of this auction', 403);
    }

    const source: PaymentReadinessContext['winner']['source'] = isCurrentWinner
      ? 'repaired_from_current_bidder'
      : 'repaired_from_bid_history';
    winnerRecord = await repairWinnerRecord(auctionId, vendorId, auction, source);
    repairedWinnerRecord = true;
  }

  return {
    auction,
    winner: {
      vendorId: winnerRecord.vendorId,
      bidAmount: winnerRecord.bidAmount,
      depositAmount: winnerRecord.depositAmount,
      source: repairedWinnerRecord
        ? auction.currentBidder === vendorId
          ? 'repaired_from_current_bidder'
          : 'repaired_from_bid_history'
        : 'auction_winners',
    },
    escrowWallet: wallet || null,
    repairedWinnerRecord,
    repairedAuctionStatus: statusRepair.repaired,
  };
}
