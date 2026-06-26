import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, sql, and, or, ne, inArray } from 'drizzle-orm';
import type { FinancePaymentFilters } from './payment-case-filters';
import {
  buildFinancePaymentFilterWhere,
} from './payment-case-filters';

export interface FinanceDashboardStats {
  totalPayments: number;
  pendingVerification: number;
  verified: number;
  rejected: number;
  totalAmount: number;
  escrowWalletPayments: number;
  escrowWalletPercentage: number;
  paymentMethodBreakdown: {
    paystack: number;
    bank_transfer: number;
    escrow_wallet: number;
  };
  settlementControl: {
    verifiedRecovery: number;
    pendingFinanceReview: number;
    paidAwaitingPickup: number;
    overdueSignedUnpaid: number;
    frozenEscrowPayments: number;
    averageDaysToPayment: number | null;
  };
}

async function getFilteredPaymentIds(filters: FinancePaymentFilters): Promise<string[] | null> {
  const caseWhere = buildFinancePaymentFilterWhere(filters);
  if (!caseWhere) {
    return null;
  }

  const rows = await db
    .select({ id: payments.id })
    .from(payments)
    .leftJoin(auctions, eq(payments.auctionId, auctions.id))
    .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(caseWhere);

  return rows.map((row) => row.id);
}

function paymentScopeCondition(
  paymentIds: string[] | null,
  extra?: ReturnType<typeof and>
) {
  if (!paymentIds) {
    return extra;
  }
  if (paymentIds.length === 0) {
    return sql`false`;
  }
  const idCondition = inArray(payments.id, paymentIds);
  return extra ? and(idCondition, extra) : idCondition;
}

export async function calculateFinanceDashboardStats(
  filters: FinancePaymentFilters = {}
): Promise<FinanceDashboardStats> {
  const paymentIds = await getFilteredPaymentIds(filters);
  const scope = paymentScopeCondition(paymentIds);

  const totalPaymentsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(scope);

  const totalPayments = totalPaymentsResult[0]?.count || 0;

  const pendingVerificationResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(
      paymentScopeCondition(paymentIds, and(
        eq(payments.status, 'pending'),
        or(ne(payments.paymentMethod, 'escrow_wallet'), ne(payments.escrowStatus, 'frozen'))
      ))
    );

  const pendingVerification = pendingVerificationResult[0]?.count || 0;

  const verifiedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.status, 'verified')));

  const verified = verifiedResult[0]?.count || 0;

  const rejectedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.status, 'rejected')));

  const rejected = rejectedResult[0]?.count || 0;

  const totalAmountResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric`,
    })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.status, 'verified')));

  const totalAmount = parseFloat(totalAmountResult[0]?.total?.toString() || '0');

  const escrowWalletResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.paymentMethod, 'escrow_wallet')));

  const escrowWalletPayments = escrowWalletResult[0]?.count || 0;
  const escrowWalletPercentage =
    totalPayments > 0 ? Math.round((escrowWalletPayments / totalPayments) * 100) : 0;

  const paystackResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.paymentMethod, 'paystack')));

  const bankTransferResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(paymentScopeCondition(paymentIds, eq(payments.paymentMethod, 'bank_transfer')));

  const paymentMethodBreakdown = {
    paystack: paystackResult[0]?.count || 0,
    bank_transfer: bankTransferResult[0]?.count || 0,
    escrow_wallet: escrowWalletPayments,
  };

  const settlementControl = await calculateSettlementControl(paymentIds);

  return {
    totalPayments,
    pendingVerification,
    verified,
    rejected,
    totalAmount,
    escrowWalletPayments,
    escrowWalletPercentage,
    paymentMethodBreakdown,
    settlementControl,
  };
}

async function calculateSettlementControl(paymentIds: string[] | null) {
  const paymentIdFilter =
    paymentIds && paymentIds.length > 0
      ? sql`AND p.id IN (${sql.join(paymentIds.map((id) => sql`${id}`), sql`, `)})`
      : paymentIds && paymentIds.length === 0
        ? sql`AND false`
        : sql``;

  const [settlementRow] = (await db.execute(sql`
    WITH verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.id,
        p.auction_id,
        p.vendor_id,
        p.amount,
        p.verified_at,
        p.created_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
        ${paymentIdFilter}
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    ),
    pending_finance_review AS (
      SELECT p.id
      FROM payments p
      WHERE p.status = 'pending'
        AND (
          p.payment_method IS DISTINCT FROM 'escrow_wallet'
          OR p.escrow_status IS DISTINCT FROM 'frozen'
        )
        ${paymentIdFilter}
    ),
    paid_awaiting_pickup AS (
      SELECT DISTINCT a.id
      FROM auctions a
      INNER JOIN verified_winner_payments p ON p.auction_id = a.id
      WHERE COALESCE(a.pickup_confirmed_admin, false) = false
    ),
    overdue_signed_unpaid AS (
      SELECT DISTINCT rf.auction_id
      FROM release_forms rf
      LEFT JOIN verified_winner_payments p ON p.auction_id = rf.auction_id AND p.vendor_id = rf.vendor_id
      WHERE rf.status = 'signed'
        AND rf.payment_deadline IS NOT NULL
        AND rf.payment_deadline < NOW()
        AND COALESCE(rf.disabled, false) = false
        AND p.id IS NULL
    ),
    payment_cycles AS (
      SELECT EXTRACT(EPOCH FROM (p.verified_at - a.end_time)) / 86400.0 AS days_to_payment
      FROM verified_winner_payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.verified_at IS NOT NULL
        AND p.verified_at >= a.end_time
    )
    SELECT
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM verified_winner_payments) AS verified_recovery,
      (SELECT COUNT(*)::int FROM pending_finance_review) AS pending_finance_review,
      (SELECT COUNT(*)::int FROM paid_awaiting_pickup) AS paid_awaiting_pickup,
      (SELECT COUNT(*)::int FROM overdue_signed_unpaid) AS overdue_signed_unpaid,
      (SELECT COUNT(*)::int FROM payments p
        WHERE p.payment_method = 'escrow_wallet' AND p.escrow_status = 'frozen'
        ${paymentIdFilter}) AS frozen_escrow_payments,
      (SELECT AVG(days_to_payment)::numeric FROM payment_cycles) AS average_days_to_payment
  `)) as Record<string, unknown>[];

  return {
    verifiedRecovery: numberFrom(settlementRow?.verified_recovery),
    pendingFinanceReview: numberFrom(settlementRow?.pending_finance_review),
    paidAwaitingPickup: numberFrom(settlementRow?.paid_awaiting_pickup),
    overdueSignedUnpaid: numberFrom(settlementRow?.overdue_signed_unpaid),
    frozenEscrowPayments: numberFrom(settlementRow?.frozen_escrow_payments),
    averageDaysToPayment: nullableNumberFrom(settlementRow?.average_days_to_payment),
  };
}

function numberFrom(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : null;
}
