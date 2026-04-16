/**
 * Transfer Service
 * Handles transfer of forfeited deposits to platform account
 * 
 * Requirements:
 * - Requirement 12.1: Display "Transfer Forfeited Funds" button for forfeited deposits
 * - Requirement 12.2: Verify auction status is "deposit_forfeited"
 * - Requirement 12.3: Decrease vendor's frozenAmount by forfeitedAmount
 * - Requirement 12.4: Increase platform_account balance by forfeitedAmount
 * - Requirement 12.5: Record transaction with all details
 * - Requirement 12.6: Update auction status to "forfeiture_collected"
 * - Requirement 12.7: Keep remaining frozen amount frozen until auction resolved
 */

import { db } from '@/lib/db/drizzle';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { depositForfeitures, depositEvents } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, isNull } from 'drizzle-orm';

export interface TransferForfeitedFundsParams {
  auctionId: string;
  transferredBy: string; // Finance Officer user ID
}

export interface TransferForfeitedFundsResult {
  transactionId: string;
  amount: number;
  vendorId: string;
  platformAccountId: string;
}

/**
 * Transfer Service
 * Handles transfer of forfeited deposits to platform account
 */
export class TransferService {
  // Platform account ID - this should be configurable in production
  private readonly PLATFORM_ACCOUNT_ID = 'platform-account-id';

  /**
   * Transfer forfeited funds from vendor to platform account
   * 
   * @param params - Transfer parameters
   * @returns Transfer result with transaction ID and amount
   * @throws Error if auction not found, not in correct status, or already transferred
   */
  async transferForfeitedFunds(
    params: TransferForfeitedFundsParams
  ): Promise<TransferForfeitedFundsResult> {
    const { auctionId, transferredBy } = params;

    // Use database transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Verify auction exists and is in "deposit_forfeited" status
      const [auction] = await tx
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        throw new Error(`Auction not found: ${auctionId}`);
      }

      if (auction.status !== 'deposit_forfeited') {
        throw new Error(
          `Cannot transfer forfeited funds. Auction status is "${auction.status}", expected "deposit_forfeited"`
        );
      }

      // Get forfeiture record
      const [forfeitureRecord] = await tx
        .select()
        .from(depositForfeitures)
        .where(
          and(
            eq(depositForfeitures.auctionId, auctionId),
            isNull(depositForfeitures.transferredAt)
          )
        )
        .limit(1);

      if (!forfeitureRecord) {
        throw new Error(
          `No pending forfeiture found for auction ${auctionId}. Funds may have already been transferred.`
        );
      }

      const vendorId = forfeitureRecord.vendorId;
      const forfeitedAmount = parseFloat(forfeitureRecord.forfeitedAmount);

      // Lock vendor wallet for update
      const [vendorWallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .for('update')
        .limit(1);

      if (!vendorWallet) {
        throw new Error(`Wallet not found for vendor ${vendorId}`);
      }

      // Parse vendor wallet values
      const vendorBalance = parseFloat(vendorWallet.balance);
      const vendorAvailable = parseFloat(vendorWallet.availableBalance);
      const vendorFrozen = parseFloat(vendorWallet.frozenAmount);
      const vendorForfeited = parseFloat(vendorWallet.forfeitedAmount || '0');

      // Verify sufficient forfeited amount
      if (vendorForfeited < forfeitedAmount) {
        throw new Error(
          `Insufficient forfeited amount. Required: ₦${forfeitedAmount.toFixed(2)}, Forfeited: ₦${vendorForfeited.toFixed(2)}`
        );
      }

      // Calculate new vendor wallet values
      // Transfer moves funds from forfeited to platform (decreases balance and forfeited)
      const newVendorBalance = vendorBalance - forfeitedAmount;
      const newVendorForfeited = vendorForfeited - forfeitedAmount;

      // Verify vendor wallet invariant before update
      const expectedVendorBalance = vendorAvailable + vendorFrozen + newVendorForfeited;
      if (Math.abs(expectedVendorBalance - newVendorBalance) > 0.01) {
        throw new Error(
          `Vendor wallet invariant violation. Balance: ${newVendorBalance}, Expected: ${expectedVendorBalance}`
        );
      }

      // Update vendor wallet (decrease balance and forfeited amount)
      await tx
        .update(escrowWallets)
        .set({
          balance: newVendorBalance.toFixed(2),
          forfeitedAmount: newVendorForfeited.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.vendorId, vendorId));

      // Get or create platform account wallet
      let [platformWallet] = await tx
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.id, this.PLATFORM_ACCOUNT_ID))
        .for('update')
        .limit(1);

      if (!platformWallet) {
        // Create platform wallet if it doesn't exist
        [platformWallet] = await tx
          .insert(escrowWallets)
          .values({
            id: this.PLATFORM_ACCOUNT_ID,
            vendorId: this.PLATFORM_ACCOUNT_ID, // Special case for platform account
            balance: '0.00',
            availableBalance: '0.00',
            frozenAmount: '0.00',
            forfeitedAmount: '0.00',
          })
          .returning();
      }

      // Parse platform wallet values
      const platformBalance = parseFloat(platformWallet.balance);
      const platformAvailable = parseFloat(platformWallet.availableBalance);

      // Calculate new platform wallet values (increase balance and available)
      const newPlatformBalance = platformBalance + forfeitedAmount;
      const newPlatformAvailable = platformAvailable + forfeitedAmount;

      // Update platform wallet (increase balance and available)
      await tx
        .update(escrowWallets)
        .set({
          balance: newPlatformBalance.toFixed(2),
          availableBalance: newPlatformAvailable.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.id, this.PLATFORM_ACCOUNT_ID));

      // Record transaction in wallet_transactions
      const [transaction] = await tx
        .insert(walletTransactions)
        .values({
          walletId: vendorWallet.id,
          type: 'debit',
          amount: forfeitedAmount.toFixed(2),
          balanceAfter: newVendorBalance.toFixed(2),
          reference: `forfeiture_transfer_${auctionId}`,
          description: `Forfeited deposit transferred to platform account for auction ${auctionId}`,
        })
        .returning();

      // Record platform account credit transaction
      await tx.insert(walletTransactions).values({
        walletId: platformWallet.id,
        type: 'credit',
        amount: forfeitedAmount.toFixed(2),
        balanceAfter: newPlatformBalance.toFixed(2),
        reference: `forfeiture_transfer_${auctionId}`,
        description: `Forfeited deposit received from vendor ${vendorId} for auction ${auctionId}`,
      });

      // Update forfeiture record with transfer details
      await tx
        .update(depositForfeitures)
        .set({
          transferredAt: new Date(),
          transferredBy,
        })
        .where(eq(depositForfeitures.id, forfeitureRecord.id));

      // Record deposit event for vendor
      await tx.insert(depositEvents).values({
        vendorId,
        auctionId,
        eventType: 'forfeit',
        amount: forfeitedAmount.toFixed(2),
        balanceAfter: newVendorBalance.toFixed(2),
        frozenAfter: vendorFrozen.toFixed(2),
        description: `Forfeited funds transferred to platform account`,
      });

      // Update auction status to "forfeiture_collected"
      await tx
        .update(auctions)
        .set({
          status: 'forfeiture_collected',
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auctionId));

      // Verify vendor wallet invariant after update
      await this.verifyInvariantInTransaction(tx, vendorId);

      return {
        transactionId: transaction.id,
        amount: forfeitedAmount,
        vendorId,
        platformAccountId: this.PLATFORM_ACCOUNT_ID,
      };
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
      console.error('[CRITICAL] Wallet invariant violation detected during transfer:', {
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
export const transferService = new TransferService();
