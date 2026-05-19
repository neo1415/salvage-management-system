export const ACTIVE_AUCTION_STATUSES = ['active', 'extended'] as const;
export const SOLD_CASE_STATUSES = ['sold'] as const;
export const REJECTED_CASE_STATUSES = ['cancelled'] as const;
export const PENDING_CASE_STATUSES = ['pending_approval'] as const;
export const VERIFIED_PAYMENT_STATUS = 'verified' as const;

export function formatRatingLabel(
  storedRating: string | number | null | undefined,
  autoRating: number,
  activityCount: number
): { value: number; label: string; source: 'stored' | 'auto' | 'insufficient' } {
  const parsedRating =
    typeof storedRating === 'number'
      ? storedRating
      : parseFloat(storedRating || '0');

  if (Number.isFinite(parsedRating) && parsedRating > 0) {
    return {
      value: Math.round(parsedRating * 100) / 100,
      label: parsedRating.toFixed(1),
      source: 'stored',
    };
  }

  if (activityCount >= 3 && autoRating > 0) {
    return {
      value: Math.round(autoRating * 100) / 100,
      label: autoRating.toFixed(1),
      source: 'auto',
    };
  }

  return {
    value: 0,
    label: 'Not enough data',
    source: 'insufficient',
  };
}
