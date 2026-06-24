/**
 * Shared bid-history labels: list cards and detail pages use the same payment-aware status.
 */

export type BidHistoryPaymentLabel =
  | 'Payment Completed'
  | 'Payment Pending'
  | 'Payment Rejected'
  | 'Payment Overdue'
  | null;

export type BidHistoryBadgeTone =
  | 'active'
  | 'scheduled'
  | 'extended'
  | 'closed'
  | 'payment'
  | 'warning'
  | 'cancelled';

export type BidHistoryBadge = {
  label: string;
  tone: BidHistoryBadgeTone;
};

type PaymentRow = {
  status?: string | null;
};

export function resolveBidHistoryPaymentLabel(
  payment?: PaymentRow | null,
  caseStatus?: string | null
): BidHistoryPaymentLabel {
  if (payment?.status) {
    if (payment.status === 'verified') return 'Payment Completed';
    if (payment.status === 'rejected') return 'Payment Rejected';
    if (payment.status === 'overdue') return 'Payment Overdue';
    return 'Payment Pending';
  }

  if (caseStatus === 'sold') return 'Payment Pending';
  return null;
}

function humanizeAuctionStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveBidHistoryBadge(input: {
  auctionStatus: string;
  payment?: PaymentRow | null;
  caseStatus?: string | null;
}): BidHistoryBadge {
  const paymentLabel = resolveBidHistoryPaymentLabel(input.payment, input.caseStatus);

  if (paymentLabel === 'Payment Completed') {
    return { label: 'Payment completed', tone: 'closed' };
  }
  if (paymentLabel === 'Payment Pending') {
    return { label: 'Awaiting payment', tone: 'payment' };
  }
  if (paymentLabel === 'Payment Rejected') {
    return { label: 'Payment rejected', tone: 'cancelled' };
  }
  if (paymentLabel === 'Payment Overdue') {
    return { label: 'Payment overdue', tone: 'warning' };
  }

  switch (input.auctionStatus) {
    case 'active':
      return { label: 'Active', tone: 'active' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'scheduled' };
    case 'extended':
      return { label: 'Extended', tone: 'extended' };
    case 'closed':
      return { label: 'Closed', tone: 'closed' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'cancelled' };
    case 'forfeited':
      return { label: 'Forfeited', tone: 'cancelled' };
    case 'awaiting_payment':
      return { label: 'Awaiting payment', tone: 'payment' };
    default:
      return { label: humanizeAuctionStatus(input.auctionStatus), tone: 'closed' };
  }
}

export function bidHistoryBadgeClassName(tone: BidHistoryBadgeTone): string {
  switch (tone) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'extended':
      return 'bg-orange-100 text-orange-800';
    case 'payment':
      return 'bg-amber-100 text-amber-900';
    case 'warning':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'closed':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
