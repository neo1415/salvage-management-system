/**
 * Forfeiture Service
 * Handles deposit forfeiture when winners fail to pay after signing documents
 * 
 * Requirements:
 * - Requirement 11.1: Calculate forfeiture_amount as deposit_amount × forfeiture_percentage
 * - Requirement 11.2: Mark deposit as "forfeited" without unfreezing it
 * - Requirement 11.3: Update vendor's escrow record with forfeitedAmount field
 * - Requirement 11.4: Update auction status to "deposit_forfeited"
 * - Requirement 11.5: Notify vendor of forfeiture with reason
 * - Requirement 11.6: Configurable forfeiture_percentage (default 100%)
 */

import { db } from '@/lib/db/drizzle';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { depositForfeitures, depositEvents } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';
import { depositNotificationService } from './deposit-notification.service';

export interface ForfeitDepositParams {
  auctionId: string;
  vendorId: string;
  depositAmount: number;
  reason: string;
  forfeiturePercentage?: number; // Default 100%
}

export interface ForfeitDepositResult {
  forfeitureId: string;
  forfeitedAmount: number;
  forfeiturePercentage: number;
}

/**
 * Forfeiture Service
 * Handles deposit forfeiture for auction deposit system
 */
export class ForfeitureService {
  /**
   * Forfeit vendor's deposit when they fail to pay after signing documents
   * 
   * @param params - Forfeiture parameters
   * @returns Forfeiture result with ID and amount
   * @throws Error if auction not found, wallet not found, or invariant violation
   */
  async forfeitDeposit(params: ForfeitDepositParams): Promise<ForfeitDepositResult> {
    const {
      auctionId,
      vendorId,
      depositAmount,
      reason,
      forfeiturePercentage = 100, // Default 100% forfeiture
    } = params;

    // Validate forfeiture percentage
    if (forfeiturePercentage < 0 || forfeiturePercentage > 100) {
      throw new Error(
        `Invalid forfeiture percentage: ${forfeiturePercentage}. Must be between 0 and 100.`
      );
    }

    // Calculate forfeited amount
    const forfeitedAmount = (depositAmount * forfeiturePercentage) / 100;

    // Use database transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Verify auction exists
      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        throw new Error(`Auction not found: ${auctionId}`);
      }

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
      if (currentFrozen < depositAmount) {
        throw new Error(
          `Insufficient frozen amount for forfeiture. Required: ₦${depositAmount.toFixed(2)}, Frozen: ₦${currentFrozen.toFixed(2)}`
        );
      }

      // Calculate new values
      // Forfeiture moves funds from frozen to forfeited (does NOT unfreeze)
      const newFrozen = currentFrozen - forfeitedAmount;
      const newForfeited = currentForfeited + forfeitedAmount;

      // Verify invariant before update
      const expectedBalance = currentAvailable + newFrozen + newForfeited;
      if (Math.abs(expectedBalance - currentBalance) > 0.01) {
        throw new Error(
          `Wallet invariant violation detected during forfeiture. Balance: ${currentBalance}, Expected: ${expectedBalance}`
        );
      }

      // Update wallet with forfeited amount
      await tx
        .update(escrowWallets)
        .set({
          frozenAmount: newFrozen.toFixed(2),
          forfeitedAmount: newForfeited.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Create forfeiture record
      const [forfeitureRecord] = await tx
        .insert(depositForfeitures)
        .values({
          auctionId,
          vendorId,
          depositAmount: depositAmount.toFixed(2),
          forfeiturePercentage,
          forfeitedAmount: forfeitedAmount.toFixed(2),
          reason,
        })
        .returning();

      // Record deposit event
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'forfeit',
        amount: forfeitedAmount.toFixed(2),
        balanceAfter: currentBalance.toFixed(2),
        frozenAfter: newFrozen.toFixed(2),
        description: `Deposit forfeited: ${reason}`,
      });

      // Update auction status to "deposit_forfeited"
      await tx
        .update(auctions)
        .set({
          status: 'deposit_forfeited',
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auctionId));

      // Verify invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);

      return {
        forfeitureId: forfeitureRecord.id,
        forfeitedAmount,
        forfeiturePercentage,
      };
    });

    // Send forfeiture notification
    await depositNotificationService.sendDepositForfeitureNotification({
      vendorId,
      auctionId,
      amount: forfeitedAmount,
      reason: 'Payment deadline expired',
    });

    return result;
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
      console.error('[CRITICAL] Wallet invariant violation detected during forfeiture:', {
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
export const forfeitureService = new ForfeitureService();
