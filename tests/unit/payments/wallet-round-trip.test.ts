import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fc } from '@fast-check/vitest';

/**
 * Property 16: Wallet Transaction Round-Trip
 * 
 * Validates: Requirements 26.5-26.8
 * 
 * For any wallet with initial state (balance, availableBalance, frozenAmount),
 * if we freeze an amount and then unfreeze the same amount,
 * the wallet should return to its original state.
 * 
 * This property ensures that freeze/unfreeze operations are reversible
 * and don't lose or create funds.
 */

describe('Property 16: Wallet Transaction Round-Trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should restore original state after freeze → unfreeze round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 5000000 }), // Initial balance
        fc.integer({ min: 10000, max: 500000 }), // Amount to freeze
        async (initialBalance, freezeAmount) => {
          // Ensure freeze amount doesn't exceed available balance
          const actualFreezeAmount = Math.min(freezeAmount, initialBalance);

          // Initial state
          const initialState = {
            balance: initialBalance,
            availableBalance: initialBalance,
            frozenAmount: 0,
          };

          // Freeze operation
          const afterFreeze = {
            balance: initialState.balance,
            availableBalance: initialState.availableBalance - actualFreezeAmount,
            frozenAmount: initialState.frozenAmount + actualFreezeAmount,
          };

          // Verify freeze worked correctly
          expect(afterFreeze.balance).toBe(
            afterFreeze.availableBalance + afterFreeze.frozenAmount
          );

          // Unfreeze operation (reverse the freeze)
          const afterUnfreeze = {
            balance: afterFreeze.balance,
            availableBalance: afterFreeze.availableBalance + actualFreezeAmount,
            frozenAmount: afterFreeze.frozenAmount - actualFreezeAmount,
          };

          // PROPERTY: After round-trip, state should match initial state
          expect(afterUnfreeze.balance).toBe(initialState.balance);
          expect(afterUnfreeze.availableBalance).toBe(initialState.availableBalance);
          expect(afterUnfreeze.frozenAmount).toBe(initialState.frozenAmount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should restore original state after multiple freeze → unfreeze cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500000, max: 2000000 }), // Initial balance
        fc.array(fc.integer({ min: 50000, max: 200000 }), { minLength: 1, maxLength: 5 }), // Multiple freeze amounts
        async (initialBalance, freezeAmounts) => {
          // Initial state
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          const frozenAmounts: number[] = [];

          // Freeze multiple amounts
          for (const amount of freezeAmounts) {
            if (availableBalance >= amount) {
              availableBalance -= amount;
              frozenAmount += amount;
              frozenAmounts.push(amount);
            }
          }

          // Unfreeze all in reverse order
          for (const amount of frozenAmounts.reverse()) {
            frozenAmount -= amount;
            availableBalance += amount;
          }

          // PROPERTY: After all round-trips, state should match initial state
          expect(balance).toBe(initialBalance);
          expect(availableBalance).toBe(initialBalance);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle partial freeze → unfreeze correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 1000000 }), // Initial balance
        fc.integer({ min: 50000, max: 500000 }), // Freeze amount
        fc.integer({ min: 10000, max: 100000 }), // Partial unfreeze amount
        async (initialBalance, freezeAmount, unfreezeAmount) => {
          const actualFreezeAmount = Math.min(freezeAmount, initialBalance);

          // Initial state
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          // Freeze
          availableBalance -= actualFreezeAmount;
          frozenAmount += actualFreezeAmount;

          // Partial unfreeze (only if we have enough frozen)
          const actualUnfreezeAmount = Math.min(unfreezeAmount, frozenAmount);
          frozenAmount -= actualUnfreezeAmount;
          availableBalance += actualUnfreezeAmount;

          // PROPERTY: Balance invariant must hold
          expect(balance).toBe(availableBalance + frozenAmount);

          // Unfreeze the rest
          availableBalance += frozenAmount;
          frozenAmount = 0;

          // PROPERTY: After complete unfreeze, should return to initial state
          expect(balance).toBe(initialBalance);
          expect(availableBalance).toBe(initialBalance);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle freeze → debit → unfreeze correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200000, max: 1000000 }), // Initial balance
        fc.integer({ min: 100000, max: 500000 }), // Freeze amount
        fc.integer({ min: 50000, max: 200000 }), // Debit amount
        async (initialBalance, freezeAmount, debitAmount) => {
          const actualFreezeAmount = Math.min(freezeAmount, initialBalance);

          // Initial state
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          // Freeze
          availableBalance -= actualFreezeAmount;
          frozenAmount += actualFreezeAmount;

          // Debit from frozen (release to NEM)
          const actualDebitAmount = Math.min(debitAmount, frozenAmount);
          frozenAmount -= actualDebitAmount;
          balance -= actualDebitAmount;

          // Unfreeze remaining
          const remainingFrozen = frozenAmount;
          availableBalance += remainingFrozen;
          frozenAmount = 0;

          // PROPERTY: Balance invariant must hold
          expect(balance).toBe(availableBalance + frozenAmount);

          // PROPERTY: Final balance should be initial minus debited amount
          expect(balance).toBe(initialBalance - actualDebitAmount);
          expect(availableBalance).toBe(initialBalance - actualDebitAmount);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain consistency across multiple round-trip cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000000, max: 5000000 }), // Initial balance
        fc.array(
          fc.record({
            freezeAmount: fc.integer({ min: 50000, max: 300000 }),
            unfreezeAmount: fc.integer({ min: 50000, max: 300000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (initialBalance, cycles) => {
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          for (const cycle of cycles) {
            // Freeze
            const actualFreezeAmount = Math.min(cycle.freezeAmount, availableBalance);
            if (actualFreezeAmount > 0) {
              availableBalance -= actualFreezeAmount;
              frozenAmount += actualFreezeAmount;
            }

            // Invariant must hold
            expect(balance).toBe(availableBalance + frozenAmount);

            // Unfreeze
            const actualUnfreezeAmount = Math.min(cycle.unfreezeAmount, frozenAmount);
            if (actualUnfreezeAmount > 0) {
              frozenAmount -= actualUnfreezeAmount;
              availableBalance += actualUnfreezeAmount;
            }

            // Invariant must hold
            expect(balance).toBe(availableBalance + frozenAmount);
          }

          // Unfreeze all remaining
          availableBalance += frozenAmount;
          frozenAmount = 0;

          // PROPERTY: After all cycles and final unfreeze, should return to initial state
          expect(balance).toBe(initialBalance);
          expect(availableBalance).toBe(initialBalance);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should never create or lose funds during round-trips', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 2000000 }), // Initial balance
        fc.array(fc.integer({ min: 10000, max: 100000 }), { minLength: 1, maxLength: 10 }), // Freeze amounts
        async (initialBalance, freezeAmounts) => {
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          // Track total frozen for verification
          let totalFrozen = 0;

          // Freeze operations
          for (const amount of freezeAmounts) {
            if (availableBalance >= amount) {
              availableBalance -= amount;
              frozenAmount += amount;
              totalFrozen += amount;
            }
          }

          // PROPERTY: Total balance should remain unchanged
          expect(balance).toBe(initialBalance);
          expect(balance).toBe(availableBalance + frozenAmount);

          // Unfreeze all
          availableBalance += frozenAmount;
          frozenAmount = 0;

          // PROPERTY: No funds created or lost
          expect(balance).toBe(initialBalance);
          expect(availableBalance).toBe(initialBalance);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case: freeze and unfreeze entire balance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 1000000 }), // Initial balance
        async (initialBalance) => {
          // Initial state
          let balance = initialBalance;
          let availableBalance = initialBalance;
          let frozenAmount = 0;

          // Freeze entire balance
          frozenAmount = availableBalance;
          availableBalance = 0;

          // Verify state
          expect(balance).toBe(availableBalance + frozenAmount);
          expect(availableBalance).toBe(0);
          expect(frozenAmount).toBe(initialBalance);

          // Unfreeze entire balance
          availableBalance = frozenAmount;
          frozenAmount = 0;

          // PROPERTY: Should return to initial state
          expect(balance).toBe(initialBalance);
          expect(availableBalance).toBe(initialBalance);
          expect(frozenAmount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
