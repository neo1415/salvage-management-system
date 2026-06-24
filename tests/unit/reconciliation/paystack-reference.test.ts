import { describe, expect, it } from 'vitest';
import {
  isInternalWalletReference,
  isPaystackComparableReference,
} from '@/features/reconciliation/utils/paystack-reference';

describe('paystack-reference', () => {
  it('treats internal escrow refs as non-Paystack', () => {
    expect(isInternalWalletReference('FREEZE_abc')).toBe(true);
    expect(isInternalWalletReference('UNFREEZE_abc')).toBe(true);
    expect(isInternalWalletReference('HYBRID_FREEZE_abc')).toBe(true);
    expect(isInternalWalletReference('AUCTION_SETTLEMENT_abc')).toBe(true);
    expect(isInternalWalletReference('TRANSFER_abc')).toBe(true);
    expect(isPaystackComparableReference('FREEZE_abc')).toBe(false);
  });

  it('treats deposit refs as Paystack-comparable', () => {
    expect(isPaystackComparableReference('WALLET_5ed2ac86_1780014499589')).toBe(true);
    expect(isPaystackComparableReference('PAY-0af6b9b7-3212-4a70-b30a-bb0660318c87-1780020058533')).toBe(true);
    expect(isPaystackComparableReference('REG-6A814BAA-1779717102509')).toBe(true);
  });
});
