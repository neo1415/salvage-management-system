/**
 * Fallback Chain Service
 * 
 * Handles automated fallback chain when auction winner fails to sign documents or pay.
 * Promotes next eligible bidder from top N bidders, skipping ineligible bidders.
 * 
 * Requirements: 9.1-9.7, 10.1-10.6, 30.1-30.5
 */

import { db } from '@/lib/db/drizzle';
import { 
  auctionWinners, 
  systemConfig,
  depositEvents 
} from '@/lib/db/schema/auction-deposit';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { regenerateDocumentsForFallback } from './document-integration.service';

/**
 * Get configuration value from system_config table
 */
async function getConfigValue(parameter: string, defaultValue: number): Promise<number> {
  try {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.parameter, parameter))
      .limit(1);

    if (config && config.value) {
      return parseFloat(config.value);
    }

    return defaultValue;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch config ${parameter}, using default ${defaultValue}:`, error);
    return defaultValue;
  }
}

/**
 * Check if bidder is eligible for promotion (Requirement 10.1, 10.2)
 * 
 * Eligibility criteria:
 * 1. Deposit is still frozen (not unfrozen)
 * 2. Vendor has sufficient balance to cover remaining payment
 * 
 * @param vendorId - Vendor ID
 * @param depositAmount - Deposit amount
 * @param finalBid - Final bid amount
 * @returns Whether bidder is eligible
 */
export async function isEligibleForPromotion(
  vendorId: string,
  depositAmount: number,
  finalBid: number
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    // 1. Check if deposit is still frozen
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    if (!wallet) {
      return {
        eligible: false,
        reason: 'No escrow wallet found'
      };
    }

    // Check if deposit is frozen (frozenAmount >= depositAmount)
    const frozenAmount = parseFloat(wallet.frozenAmount);
    if (frozenAmount < depositAmount) {
      return {
        eligible: false,
        reason: `Insufficient frozen amount (${frozenAmount} < ${depositAmount})`
      };
    }

    // 2. Check if vendor has sufficient balance for remaining payment
    const availableBalance = parseFloat(wallet.availableBalance);
    const remainingPayment = finalBid - depositAmount;

    if (availableBalance < remainingPayment) {
      return {
        eligible: false,
        reason: `Insufficient balance for remaining payment (${availableBalance} < ${remainingPayment})`
      };
    }

    return { eligible: true };
  } catch (error) {
    console.error('❌ Error checking eligibility:', error);
    return {
      eligible: false,
      reason: 'Error checking eligibility'
    };
  }
}

/**
 * Unfreeze failed winner's deposit (Requirement 9.3)
 * 
 * @param vendorId - Vendor ID
 * @param auctionId - Auction ID
 * @param depositAmount - Deposit amount to unfreeze
 * @param reason - Reason for unfreezing
 * @returns Success status
 */
async function unfreezeDeposit(
  vendorId: string,
  auctionId: string,
  depositAmount: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Decrease frozenAmount, increase availableBalance
    await db
      .update(escrowWallets)
      .set({
        frozenAmount: sql`frozen_amount - ${depositAmount}`,
        availableBalance: sql`available_balance + ${depositAmount}`,
        updatedAt: new Date()
      })
      .where(eq(escrowWallets.vendorId, vendorId));

    // Record deposit event
    await db.insert(depositEvents).values({
      vendorId,
      auctionId,
      eventType: 'unfreeze',
      amount: depositAmount.toString(),
      balanceAfter: '0', // Will be updated by trigger
      frozenAfter: '0', // Will be updated by trigger
      description: reason,
      createdAt: new Date()
    });

    console.log(`✅ Unfroze deposit: ₦${depositAmount} for vendor ${vendorId}`);
    console.log(`   - Reason: ${reason}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Error unfreezing deposit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Trigger fallback chain (Requirement 9)
 * 
 * Called when:
 * - Winner fails to sign documents within validity period + buffer
 * - Winner signs documents but fails to pay within payment deadline + buffer
 * 
 * @param auctionId - Auction ID
 * @param failureReason - 'failed_to_sign' or 'failed_to_pay'
 * @param triggeredBy - User ID (system or admin)
 * @returns Success status, new winner, or all fallbacks failed
 */
export async function triggerFallback(
  auctionId: string,
  failureReason: 'failed_to_sign' | 'failed_to_pay',
  triggeredBy: string
): Promise<{
  success: boolean;
  newWinnerId?: string;
  allFallbacksFailed?: boolean;
  error?: string;
}> {
  try {
    console.log(`🔄 Triggering fallback for auction ${auctionId}`);
    console.log(`   - Reason: ${failureReason}`);

    // 1. Get current winner
    const [currentWinner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);

    if (!currentWinner) {
      return {
        success: false,
        error: 'No active winner found'
      };
    }

    // 2. Mark current winner as failed
    await db
      .update(auctionWinners)
      .set({
        status: failureReason,
        updatedAt: new Date()
      })
      .where(eq(auctionWinners.id, currentWinner.id));

    console.log(`❌ Marked winner as ${failureReason}: ${currentWinner.vendorId}`);

    // 3. Unfreeze failed winner's deposit (Requirement 9.3)
    const unfreezeResult = await unfreezeDeposit(
      currentWinner.vendorId,
      auctionId,
      parseFloat(currentWinner.depositAmount),
      `Fallback triggered: ${failureReason}`
    );

    if (!unfreezeResult.success) {
      console.warn(`⚠️ Failed to unfreeze deposit for ${currentWinner.vendorId}`);
    }

    // 4. Get top N bidders (Requirement 9.4)
    const topN = await getConfigValue('top_bidders_to_keep_frozen', 3);

    const topBidders = await db
      .select({
        vendorId: auctionWinners.vendorId,
        bidAmount: auctionWinners.bidAmount,
        depositAmount: auctionWinners.depositAmount,
        rank: auctionWinners.rank
      })
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          sql`${auctionWinners.rank} <= ${topN}`
        )
      )
      .orderBy(auctionWinners.rank);

    console.log(`📊 Found ${topBidders.length} top bidders to check`);

    // 5. Find next eligible bidder (Requirement 10.1, 10.2, 10.3)
    let nextWinner = null;
    for (const bidder of topBidders) {
      // Skip current failed winner
      if (bidder.vendorId === currentWinner.vendorId) {
        continue;
      }

      // Check eligibility
      const eligibility = await isEligibleForPromotion(
        bidder.vendorId,
        parseFloat(bidder.depositAmount || '0'),
        parseFloat(bidder.bidAmount)
      );

      if (eligibility.eligible) {
        nextWinner = bidder;
        console.log(`✅ Found eligible bidder: ${bidder.vendorId} (rank ${bidder.rank})`);
        break;
      } else {
        console.log(`⏭️  Skipping ineligible bidder: ${bidder.vendorId}`);
        console.log(`   - Reason: ${eligibility.reason}`);
      }
    }

    // 6. Handle no eligible bidders found (Requirement 10.5, 30.3)
    if (!nextWinner) {
      console.log(`❌ All fallbacks failed - no eligible bidders found`);

      // Unfreeze all remaining deposits (Requirement 10.5)
      for (const bidder of topBidders) {
        if (bidder.vendorId !== currentWinner.vendorId) {
          await unfreezeDeposit(
            bidder.vendorId,
            auctionId,
            parseFloat(bidder.depositAmount || '0'),
            'All fallbacks failed'
          );
        }
      }

      // Update auction status
      await db
        .update(auctions)
        .set({
          status: 'closed',
          updatedAt: new Date()
        })
        .where(eq(auctions.id, auctionId));

      return {
        success: true,
        allFallbacksFailed: true
      };
    }

    // 7. Promote next eligible bidder (Requirement 9.5)
    await db
      .update(auctionWinners)
      .set({
        status: 'active',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.vendorId, nextWinner.vendorId)
        )
      );

    console.log(`🎉 Promoted new winner: ${nextWinner.vendorId}`);

    // 8. Generate new documents with fresh validity period (Requirement 9.6)
    const docResult = await regenerateDocumentsForFallback(
      auctionId,
      nextWinner.vendorId,
      triggeredBy,
      currentWinner.vendorId
    );

    if (!docResult.success) {
      console.warn(`⚠️ Failed to generate documents for new winner: ${docResult.error}`);
    }

    return {
      success: true,
      newWinnerId: nextWinner.vendorId
    };
  } catch (error) {
    console.error('❌ Error triggering fallback:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if fallback should be triggered (Requirement 9.1, 9.2)
 * 
 * Checks if:
 * - Document deadline has expired + buffer period has passed
 * - Payment deadline has expired + buffer period has passed
 * 
 * @param auctionId - Auction ID
 * @returns Whether fallback should be triggered and reason
 */
export async function shouldTriggerFallback(
  auctionId: string
): Promise<{
  shouldTrigger: boolean;
  reason?: 'document_expired' | 'payment_expired';
  winnerId?: string;
}> {
  try {
    // Get buffer period from config
    const bufferHours = await getConfigValue('fallback_buffer_period', 24);
    const bufferMs = bufferHours * 60 * 60 * 1000;

    // Get current winner
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);

    if (!winner) {
      return { shouldTrigger: false };
    }

    // Check documents
    const documents = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, winner.vendorId)
        )
      );

    if (documents.length === 0) {
      return { shouldTrigger: false };
    }

    const firstDoc = documents[0];
    const now = new Date();

    // Check if all documents are signed
    const allSigned = documents.every(doc => doc.signedAt !== null);

    if (!allSigned) {
      // Check document validity deadline + buffer
      if (firstDoc.validityDeadline) {
        const deadlineWithBuffer = new Date(firstDoc.validityDeadline.getTime() + bufferMs);
        if (now > deadlineWithBuffer) {
          return {
            shouldTrigger: true,
            reason: 'document_expired',
            winnerId: winner.vendorId
          };
        }
      }
    } else {
      // Documents signed, check payment deadline + buffer
      if (firstDoc.paymentDeadline) {
        const deadlineWithBuffer = new Date(firstDoc.paymentDeadline.getTime() + bufferMs);
        if (now > deadlineWithBuffer) {
          // Check if payment was made
          // TODO: Integrate with payment service to check payment status
          return {
            shouldTrigger: true,
            reason: 'payment_expired',
            winnerId: winner.vendorId
          };
        }
      }
    }

    return { shouldTrigger: false };
  } catch (error) {
    console.error('❌ Error checking fallback trigger:', error);
    return { shouldTrigger: false };
  }
}
