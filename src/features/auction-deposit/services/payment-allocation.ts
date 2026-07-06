export interface AuctionPaymentAllocation {
  finalBid: number;
  depositHeld: number;
  depositApplied: number;
  depositSurplus: number;
  remainingAmount: number;
}

export interface WalletSettlementBalances {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
}

function toCurrencyAmount(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite, non-negative amount`);
  }

  return Math.round(value * 100) / 100;
}

/**
 * Allocates a frozen auction deposit without ever creating a negative balance due.
 * Any deposit above the winning bid is returned to the vendor's available wallet.
 */
export function calculateAuctionPaymentAllocation(
  finalBidValue: number,
  depositHeldValue: number,
  options: { applyDeposit?: boolean } = {}
): AuctionPaymentAllocation {
  const finalBid = toCurrencyAmount(finalBidValue, 'Final bid');
  const depositHeld = toCurrencyAmount(depositHeldValue, 'Deposit');
  const applyDeposit = options.applyDeposit !== false;
  const depositApplied = applyDeposit ? Math.min(depositHeld, finalBid) : 0;
  const depositSurplus = applyDeposit ? depositHeld - depositApplied : 0;
  const remainingAmount = finalBid - depositApplied;

  return {
    finalBid,
    depositHeld,
    depositApplied: toCurrencyAmount(depositApplied, 'Applied deposit'),
    depositSurplus: toCurrencyAmount(depositSurplus, 'Deposit surplus'),
    remainingAmount: toCurrencyAmount(remainingAmount, 'Remaining payment'),
  };
}

export function calculateWalletSettlementBalances(input: {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
  forfeitedAmount: number;
  availableCharge: number;
  frozenAmountToClose: number;
  frozenSurplusToReturn: number;
  totalDebit: number;
}): WalletSettlementBalances {
  const balance = toCurrencyAmount(input.balance, 'Wallet balance');
  const availableBalance = toCurrencyAmount(input.availableBalance, 'Available balance');
  const frozenAmount = toCurrencyAmount(input.frozenAmount, 'Frozen balance');
  const forfeitedAmount = toCurrencyAmount(input.forfeitedAmount, 'Forfeited balance');
  const availableCharge = toCurrencyAmount(input.availableCharge, 'Available balance charge');
  const frozenAmountToClose = toCurrencyAmount(input.frozenAmountToClose, 'Frozen amount to close');
  const frozenSurplusToReturn = toCurrencyAmount(
    input.frozenSurplusToReturn,
    'Frozen surplus to return'
  );
  const totalDebit = toCurrencyAmount(input.totalDebit, 'Settlement debit');

  if (frozenSurplusToReturn > frozenAmountToClose) {
    throw new Error('Frozen surplus cannot exceed the frozen amount being settled');
  }
  if (availableBalance < availableCharge) {
    throw new Error('Insufficient available balance for auction settlement');
  }
  if (frozenAmount < frozenAmountToClose) {
    throw new Error('Insufficient frozen balance for auction settlement');
  }

  const allocatedDebit = availableCharge + frozenAmountToClose - frozenSurplusToReturn;
  if (Math.abs(allocatedDebit - totalDebit) > 0.01) {
    throw new Error('Auction settlement allocation does not match the total debit');
  }

  const next = {
    balance: toCurrencyAmount(balance - totalDebit, 'Updated wallet balance'),
    availableBalance: toCurrencyAmount(
      availableBalance - availableCharge + frozenSurplusToReturn,
      'Updated available balance'
    ),
    frozenAmount: toCurrencyAmount(
      frozenAmount - frozenAmountToClose,
      'Updated frozen balance'
    ),
  };

  const expectedBalance = next.availableBalance + next.frozenAmount + forfeitedAmount;
  if (Math.abs(next.balance - expectedBalance) > 0.01) {
    throw new Error('Wallet invariant violation during auction settlement');
  }

  return next;
}
