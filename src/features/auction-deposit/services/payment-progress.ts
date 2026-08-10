export interface AuctionPaymentProgress {
  requiredAmount: number;
  confirmedAmount: number;
  outstandingAmount: number;
  isComplete: boolean;
}

function normalizeMoney(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateAuctionPaymentProgress(
  requiredAmount: number,
  confirmedAmounts: readonly number[]
): AuctionPaymentProgress {
  const required = normalizeMoney(requiredAmount);
  const confirmed = confirmedAmounts.reduce(
    (total, amount) => total + normalizeMoney(amount),
    0
  );
  const outstanding = Math.max(0, required - confirmed);

  return {
    requiredAmount: required,
    confirmedAmount: confirmed,
    outstandingAmount: outstanding,
    isComplete: required > 0 && outstanding <= 0.01,
  };
}
