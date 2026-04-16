/**
 * Escrow Service
 * Manages vendor wallet operations for auction deposits
 * 
 * Requirements:
 * - Requirement 3.1: Increase frozenAmount on deposit freeze
 * - Requirement 3.2: Decrease availableBalance on deposit freeze
 * - Requirement 3.6: Maintain wallet invariant (balance = available + frozen + forfeited)
 * - Requirement 4.1: Decrease frozenAmount on deposit unfreeze
 * - Requirement 4.2: Increase availableBalance on deposit unfreeze
 * - Requirement 4.5: Maintain wallet invariant on unfreeze
 * - Requirement 26.1-26.5: Enforce wallet invariant at all times
 */

import { db } from '@/lib/db/drizzle';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';

export interface WalletBalance {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
  forfeitedAmount: number;
}

/**
 * Escrow Service
 * Handles wallet operations for auction deposit system
 */
export class EscrowService {
  /**
   * Freeze deposit amount in vendor's wallet
   * 
   * @param vendorId - Vendor ID
   * @param amount - Amount to freeze in Naira
   * @param auctionId - Auction ID for tracking
   * @param userId - User ID performing the action
   * @throws Error if insufficient available balance or invariant violation
   */
  async freezeDeposit(
    vendorId: string,
    amount: number,
    auctionId: string,
    userId: string
  ): Promise<void> {
    // Use database transaction for atomicity
    await db.transaction(async (tx) => {
      // Lock wallet row for update
      const [wallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      // Parse current values
      const currentBalance = parseFloat(wallet.balance);
      const currentAvailable = parseFloat(wallet.availableBalance);
      const currentFrozen = parseFloat(wallet.frozenAmount);
      const currentForfeited = parseFloat(wallet.forfeitedAmount || '0');

      // Verify sufficient available balance
      if (currentAvailable < amount) {
        throw new Error(
          `Insufficient available balance. Required: ₦${amount.toFixed(2)}, Available: ₦${currentAvailable.toFixed(2)}`
        );
      }

      // Calculate new values
      const newAvailable = currentAvailable - amount;
      const newFrozen = currentFrozen + amount;

      // Verify invariant before update
      const expectedBalance = newAvailable + newFrozen + currentForfeited;
      if (Math.abs(expectedBalance - currentBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation detected. Balance: ${currentBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet
      await tx
        .update(escrowWallets)
        .set({
          availableBalance: newAvailable.toFixed(2),
          frozenAmount: newFrozen.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Record deposit event
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'freeze',
        amount: amount.toFixed(2),
        balanceAfter: currentBalance.toFixed(2),
        frozenAfter: newFrozen.toFixed(2),
        description: `Deposit frozen for auction ${auctionId}`,
      });

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);
    });
  }

  /**
   * Unfreeze deposit amount in vendor's wallet
   * 
   * @param vendorId - Vendor ID
   * @param amount - Amount to unfreeze in Naira
   * @param auctionId - Auction ID for tracking
   * @param userId - User ID performing the action
   * @throws Error if insufficient frozen amount or invariant violation
   */
  async unfreezeDeposit(
    vendorId: string,
    amount: number,
    auctionId: string,
    userId: string
  ): Promise<void> {
    // Use database transaction for atomicity
    await db.transaction(async (tx) => {
      // Lock wallet row for update
      const [wallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!wallet) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      // Parse current values
      const currentBalance = parseFloat(wallet.balance);
      const currentAvailable = parseFloat(wallet.availableBalance);
      const currentFrozen = parseFloat(wallet.frozenAmount);
      const currentForfeited = parseFloat(wallet.forfeitedAmount || '0');

      // Verify sufficient frozen amount
      if (currentFrozen < amount) {
        throw new Error(
          `Insufficient frozen amount. Required: ₦${amount.toFixed(2)}, Frozen: ₦${currentFrozen.toFixed(2)}`
        );
      }

      // Calculate new values
      const newAvailable = currentAvailable + amount;
      const newFrozen = currentFrozen - amount;

      // Verify invariant before update
      const expectedBalance = newAvailable + newFrozen + currentForfeited;
      if (Math.abs(expectedBalance - currentBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation detected. Balance: ${currentBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet
      await tx
        .update(escrowWallets)
        .set({
          availableBalance: newAvailable.toFixed(2),
          frozenAmount: newFrozen.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Record deposit event
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'unfreeze',
        amount: amount.toFixed(2),
        balanceAfter: currentBalance.toFixed(2),
        frozenAfter: newFrozen.toFixed(2),
        description: `Deposit unfrozen for auction ${auctionId}`,
      });

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);
    });
  }

  /**
   * Get wallet balance details
   * 
   * @param vendorId - Vendor ID
   * @returns Wallet balance details
   * @throws Error if wallet not found
   */
  async getBalance(vendorId: string): Promise<WalletBalance> {
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for vendor ${vendorId}`);
    }

    return {
      balance: parseFloat(wallet.balance),
      availableBalance: parseFloat(wallet.availableBalance),
      frozenAmount: parseFloat(wallet.frozenAmount),
      forfeitedAmount: parseFloat(wallet.forfeitedAmount || '0'),
    };
  }

  /**
   * Verify wallet invariant
   * Invariant: balance = availableBalance + frozenAmount + forfeitedAmount
   * 
   * @param walletId - Wallet ID (not vendorId)
   * @returns true if invariant holds, false otherwise
   */
  async verifyInvariant(walletId: string): Promise<boolean> {
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found with ID ${walletId}`);
    }

    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');

    const expectedBalance = available + frozen + forfeited;

    // Allow for small floating point errors (0.01 Naira tolerance)
    return Math.abs(balance - expectedBalance) <= 0.01;
  }

  /**
   * Verify wallet invariant within a transaction
   * Used internally to verify invariant after operations
   * 
   * @param tx - Database transaction
   * @param vendorId - Vendor ID
   * @throws Error if invariant violation detected
   */
  private async verifyInvariantInTransaction(
    tx: any,
    vendorId: string
  ): Promise<void> {
    const [wallet] = await tx
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      throw new Error(`Wallet not found for vendor ${vendorId}`);
    }

    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');

    const expectedBalance = available + frozen + forfeited;

    // Allow for small floating point errors (0.01 Naira tolerance)
    if (Math.abs(balance - expectedBalance) > 0.01) {
      // Log critical error
      console.error('[CRITICAL] Wallet invariant violation detected:', {
        vendorId,
        walletId: wallet.id,
        balance,
        available,
        frozen,
        forfeited,
        expectedBalance,
        difference: balance - expectedBalance,
      });

      throw new Error(
        `Wallet invariant violation: balance=${balance}, expected=${expectedBalance}, diff=${(balance - expectedBalance).toFixed(2)}`
      );
    }
  }
}

// Export singleton instance
export const escrowService = new EscrowService();
