/**
 * Auction Closure Service (Deposit System)
 * Handles auction closure with top N bidders logic for deposit-based auctions
 * 
 * Requirements:
 * - Requirement 5.1: Identify top N bidders (default 3)
 * - Requirement 5.2: Keep deposits frozen for top N bidders
 * - Requirement 5.3: Unfreeze deposits for bidders ranked below top N
 * - Requirement 5.4: Handle auctions with fewer than N bidders
 * - Requirement 5.5: Update auction status to "closed"
 * - Requirement 5.6: Record winner in auction_winners table with rank
 * - Requirement 21.3: Legacy auction closure without fallback chain
 * 
 * Integration:
 * - This service is called by the existing closure.service.ts after auction ends
 * - It handles the deposit-specific logic for top bidders
 * - Works alongside the existing document generation and notification flow
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { eq, desc, and } from 'drizzle-orm';
import { escrowService } from './escrow.service';
import { depositCalculatorService } from './deposit-calculator.service';
import { configService } from '@/features/auction-deposit/services/config.service';

/**
 * Top bidder information
 */
export interface TopBidder {
  vendorId: string;
  bidAmount: number;
  depositAmount: number;
  rank: number;
}

/**
 * Auction closure result
 */
export interface AuctionClosureResult {
  success: boolean;
  auctionId: string;
  winnerId?: string;
  winningBid?: number;
  topBiddersCount: number;
  unfrozenBiddersCount: number;
  error?: string;
}

/**
 * Auction Closure Service for Deposit System
 * Manages top N bidders logic and deposit retention
 */
export class AuctionClosureService {
  /**
   * Close auction with top N bidders logic
   * 
   * Flow:
   * 1. Get all bids for auction sorted by amount (highest first)
   * 2. Identify top N bidders (default 3)
   * 3. Keep deposits frozen for top N bidders
   * 4. Unfreeze deposits for all bidders ranked below top N
   * 5. Record winner (rank 1) in auction_winners table
   * 6. Update auction status to "closed"
   * 
   * @param auctionId - Auction ID
   * @param topBiddersToKeepFrozen - Number of top bidders to keep frozen (default 3)
   * @returns Auction closure result
   */
  async closeAuction(
    auctionId: string,
    topBiddersToKeepFrozen: number = 3
  ): Promise<AuctionClosureResult> {
    try {
      // Use database transaction for atomicity
      return await db.transaction(async (tx) => {
        // Get auction details
        const [auction] = await tx
          .select()
          .from(auctions)
          .where(eq(auctions.id, auctionId))
          .limit(1);

        if (!auction) {
          throw new Error('Auction not found');
        }

        // Check if auction has ended
        if (auction.status !== 'active' && auction.status !== 'extended') {
          throw new Error(`Auction is not active (status: ${auction.status})`);
        }

        // Get all bids for this auction, sorted by amount (highest first)
        const allBids = await tx
          .select()
          .from(bids)
          .where(eq(bids.auctionId, auctionId))
          .orderBy(desc(bids.amount));

        if (allBids.length === 0) {
          // No bids placed - close auction without winner
          await tx
            .update(auctions)
            .set({
              status: 'closed',
              updatedAt: new Date(),
            })
            .where(eq(auctions.id, auctionId));

          console.log(`✅ Auction ${auctionId} closed with no bids`);
          
          // Auto-unwatch all users when auction closes
          try {
            const { resetWatchingCount } = await import('./watching.service');
            await resetWatchingCount(auctionId);
            console.log(`   - All watchers removed from auction ${auctionId}`);
          } catch (watchError) {
            console.error(`   ⚠️  Failed to reset watching count:`, watchError);
            // Don't fail the closure if watching reset fails
          }
          
          return {
            success: true,
            auctionId,
            topBiddersCount: 0,
            unfrozenBiddersCount: 0,
          };
        }

        // Requirement 21.3: Check if this is a legacy auction
        const isLegacyAuction = allBids[0]?.isLegacy === true;

        // Group bids by vendor (get highest bid per vendor)
        const bidsByVendor = new Map<string, typeof bids.$inferSelect>();
        for (const bid of allBids) {
          if (!bidsByVendor.has(bid.vendorId)) {
            bidsByVendor.set(bid.vendorId, bid);
          }
        }

        // Convert to array and sort by bid amount (highest first)
        const uniqueBidders = Array.from(bidsByVendor.values()).sort(
          (a, b) => parseFloat(b.amount) - parseFloat(a.amount)
        );

        // Get system configuration
        const config = await configService.getConfig();
        const depositRate = isLegacyAuction ? 1.0 : (config.depositRate / 100);
        const minimumDepositFloor = isLegacyAuction ? 0 : config.minimumDepositFloor;

        // Requirement 5.1: Identify top N bidders
        // Requirement 21.3: For legacy auctions, keep only winner (no fallback chain)
        const actualTopBiddersCount = isLegacyAuction 
          ? 1 
          : Math.min(topBiddersToKeepFrozen, uniqueBidders.length);
        const topBidders = uniqueBidders.slice(0, actualTopBiddersCount);
        const lowerBidders = uniqueBidders.slice(actualTopBiddersCount);

        console.log(`📊 Auction ${auctionId} closure (${isLegacyAuction ? 'LEGACY' : 'DEPOSIT'}):`);
        console.log(`   - Total unique bidders: ${uniqueBidders.length}`);
        console.log(`   - Top bidders to keep frozen: ${actualTopBiddersCount}`);
        console.log(`   - Lower bidders to unfreeze: ${lowerBidders.length}`);

        // Requirement 5.2: Keep deposits frozen for top N bidders
        // Requirement 5.6: Record winner in auction_winners table with rank
        for (let i = 0; i < topBidders.length; i++) {
          const bidder = topBidders[i];
          const rank = i + 1;
          const bidAmount = parseFloat(bidder.amount);
          const depositAmount = depositCalculatorService.calculateDeposit(
            bidAmount,
            depositRate,
            minimumDepositFloor
          );

          // Record in auction_winners table
          await tx.insert(auctionWinners).values({
            auctionId,
            vendorId: bidder.vendorId,
            bidAmount: bidAmount.toFixed(2),
            depositAmount: depositAmount.toFixed(2),
            rank,
            status: rank === 1 ? 'active' : 'active', // Winner is rank 1, others are fallback candidates
          });

          console.log(
            `   ✅ Rank ${rank}: Vendor ${bidder.vendorId} - ₦${bidAmount.toLocaleString()} (deposit: ₦${depositAmount.toLocaleString()}) - KEPT FROZEN`
          );
        }

        // Requirement 5.3: Unfreeze deposits for all bidders ranked below top N
        let unfrozenCount = 0;
        for (const bidder of lowerBidders) {
          const bidAmount = parseFloat(bidder.amount);
          const depositAmount = depositCalculatorService.calculateDeposit(
            bidAmount,
            depositRate,
            minimumDepositFloor
          );

          try {
            await escrowService.unfreezeDeposit(
              bidder.vendorId,
              depositAmount,
              auctionId,
              'system' // System user ID for automated operations
            );

            unfrozenCount++;
            console.log(
              `   ✅ Unfroze deposit for Vendor ${bidder.vendorId} - ₦${depositAmount.toLocaleString()}`
            );
          } catch (unfreezeError) {
            console.error(
              `   ❌ Failed to unfreeze deposit for Vendor ${bidder.vendorId}:`,
              unfreezeError
            );
            // Log error but continue with other bidders
          }
        }

        // Requirement 5.5: Update auction status to "closed"
        await tx
          .update(auctions)
          .set({
            status: 'closed',
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, auctionId));

        const winner = topBidders[0];
        const winningBid = parseFloat(winner.amount);

        console.log(`✅ Auction ${auctionId} closed successfully`);
        console.log(`   - Winner: Vendor ${winner.vendorId}`);
        console.log(`   - Winning Bid: ₦${winningBid.toLocaleString()}`);
        console.log(`   - Status: closed`);
        console.log(`   - Top bidders kept frozen: ${actualTopBiddersCount}`);
        console.log(`   - Lower bidders unfrozen: ${unfrozenCount}`);

        // Auto-unwatch all users when auction closes
        try {
          const { resetWatchingCount } = await import('./watching.service');
          await resetWatchingCount(auctionId);
          console.log(`   - All watchers removed from auction ${auctionId}`);
        } catch (watchError) {
          console.error(`   ⚠️  Failed to reset watching count:`, watchError);
          // Don't fail the closure if watching reset fails
        }

        return {
          success: true,
          auctionId,
          winnerId: winner.vendorId,
          winningBid,
          topBiddersCount: actualTopBiddersCount,
          unfrozenBiddersCount: unfrozenCount,
        };
      });
    } catch (error) {
      console.error(`Failed to close auction ${auctionId}:`, error);
      return {
        success: false,
        auctionId,
        topBiddersCount: 0,
        unfrozenBiddersCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get top bidders for an auction
   * 
   * @param auctionId - Auction ID
   * @returns List of top bidders with rank
   */
  async getTopBidders(auctionId: string): Promise<TopBidder[]> {
    try {
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, auctionId))
        .orderBy(auctionWinners.rank);

      return winners.map((winner) => ({
        vendorId: winner.vendorId,
        bidAmount: parseFloat(winner.bidAmount),
        depositAmount: parseFloat(winner.depositAmount),
        rank: winner.rank,
      }));
    } catch (error) {
      console.error(`Failed to get top bidders for auction ${auctionId}:`, error);
      return [];
    }
  }

  /**
   * Get winner for an auction
   * 
   * @param auctionId - Auction ID
   * @returns Winner (rank 1) or null
   */
  async getWinner(auctionId: string): Promise<TopBidder | null> {
    try {
      const [winner] = await db
        .select()
        .from(auctionWinners)
        .where(
          and(
            eq(auctionWinners.auctionId, auctionId),
            eq(auctionWinners.rank, 1)
          )
        )
        .limit(1);

      if (!winner) {
        return null;
      }

      return {
        vendorId: winner.vendorId,
        bidAmount: parseFloat(winner.bidAmount),
        depositAmount: parseFloat(winner.depositAmount),
        rank: winner.rank,
      };
    } catch (error) {
      console.error(`Failed to get winner for auction ${auctionId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const auctionClosureService = new AuctionClosureService();
