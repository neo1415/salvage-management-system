/**
 * Bid Service
 * Core service layer integrating Deposit Calculator, Bid Validator, and Escrow Service
 * 
 * Requirements:
 * - Requirement 3.4: Create bid record with status "active" and depositAmount field
 * - Requirement 3.5: Rollback on deposit freeze failure
 * - Requirement 4.3: Update bid status to "outbid"
 * - Requirement 4.4: Freeze new deposit when vendor re-bids
 * - Requirement 21: Legacy auction handling and backward compatibility
 * - Requirement 22: Feature flag for deposit system
 * - Requirement 27.1-27.6: Concurrent bid handling with database-level locking
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, desc } from 'drizzle-orm';
import { depositCalculatorService } from './deposit-calculator.service';
import { bidValidatorService, ValidateBidParams } from './bid-validator.service';
import { escrowService } from './escrow.service';
import { configService } from '@/features/auction-deposit/services/config.service';

/**
 * Bid placement parameters
 */
export interface PlaceBidParams {
  vendorId: string;
  auctionId: string;
  bidAmount: number;
  userId: string;
  ipAddress: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Bid placement result
 */
export interface PlaceBidResult {
  success: boolean;
  bidId?: string;
  depositAmount?: number;
  error?: string;
  errors?: string[];
}

/**
 * Bid Service
 * Integrates deposit calculation, validation, and escrow operations
 */
export class BidService {
  /**
   * Place bid with deposit integration
   * 
   * Flow:
   * 1. Validate bid eligibility (Bid Validator)
   * 2. Freeze deposit (Escrow Service)
   * 3. Create bid record
   * 4. Unfreeze previous bidder's deposit
   * 
   * Uses database-level locking for concurrent bid handling
   * 10-second timeout for bid placement
   * 
   * @param params - Bid placement parameters
   * @returns Bid placement result
   */
  async placeBid(params: PlaceBidParams): Promise<PlaceBidResult> {
    const startTime = Date.now();
    const TIMEOUT_MS = 10000; // 10 seconds

    try {
      // Requirement 27.1: Process bids sequentially using database-level locking
      return await db.transaction(async (tx) => {
        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new Error('Bid placement timeout - please retry');
        }

        // Requirement 27.3: Lock auction record
        const [auction] = await tx
          .select()
          .from(auctions)
          .where(eq(auctions.id, params.auctionId))
          .for('update')
          .limit(1);

        if (!auction) {
          throw new Error('Auction not found');
        }

        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new Error('Bid placement timeout - please retry');
        }

        // Requirement 27.2: Lock vendor's escrow wallet record
        const [vendor] = await tx
          .select()
          .from(vendors)
          .where(eq(vendors.id, params.vendorId))
          .for('update')
          .limit(1);

        if (!vendor) {
          throw new Error('Vendor not found');
        }

        // Get wallet balance
        const walletBalance = await escrowService.getBalance(params.vendorId);

        // Requirement 22.1: Check if deposit system is enabled
        const depositSystemEnabled = await configService.isDepositSystemEnabled();

        // Requirement 21.1: Determine if this is a legacy auction
        // Legacy auction = deposit system disabled OR auction already has legacy bids
        const [existingBidsCount] = await tx
          .select()
          .from(bids)
          .where(eq(bids.auctionId, params.auctionId))
          .limit(1);

        const isLegacyAuction = !depositSystemEnabled || (existingBidsCount?.isLegacy === true);

        // Get system configuration
        const config = await configService.getConfig();
        
        // Requirement 21.2: For legacy auctions, use 100% deposit rate (full-amount freeze)
        const depositRate = isLegacyAuction ? 1.0 : (config.depositRate / 100);
        const minimumDepositFloor = isLegacyAuction ? 0 : config.minimumDepositFloor;
        const tier1Limit = config.tier1Limit;
        const minimumBidIncrement = config.minimumBidIncrement;

        // Get reserve price from auction (using currentBid as fallback)
        const reservePrice = auction.currentBid 
          ? parseFloat(auction.currentBid) 
          : parseFloat(auction.minimumIncrement);

        // Requirement 27.4: Re-validate bid eligibility with locked data
        const validationParams: ValidateBidParams = {
          vendorId: params.vendorId,
          auctionId: params.auctionId,
          bidAmount: params.bidAmount,
          reservePrice,
          currentHighestBid: auction.currentBid ? parseFloat(auction.currentBid) : null,
          vendorTier: vendor.tier as 'tier1_bvn' | 'tier2_full',
          availableBalance: walletBalance.availableBalance,
          depositRate,
          minimumDepositFloor,
          minimumBidIncrement,
          tier1Limit,
        };

        const validation = await bidValidatorService.validateBid(validationParams);

        if (!validation.valid) {
          return {
            success: false,
            errors: validation.errors,
            error: validation.errors[0],
          };
        }

        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          throw new Error('Bid placement timeout - please retry');
        }

        // Get deposit amount from validation result
        const depositAmount = validation.depositAmount!;

        // Check if vendor has existing bid on this auction
        const [existingBid] = await tx
          .select()
          .from(bids)
          .where(
            and(
              eq(bids.auctionId, params.auctionId),
              eq(bids.vendorId, params.vendorId)
            )
          )
          .orderBy(desc(bids.createdAt))
          .limit(1);

        let incrementalDeposit = depositAmount;

        // Requirement 4.4: Calculate incremental deposit for bid increases
        if (existingBid) {
          const previousBidAmount = parseFloat(existingBid.amount);
          incrementalDeposit = depositCalculatorService.calculateIncrementalDeposit(
            params.bidAmount,
            previousBidAmount,
            depositRate,
            minimumDepositFloor
          );
        }

        // Requirement 3.1-3.2: Freeze deposit
        try {
          await escrowService.freezeDeposit(
            params.vendorId,
            incrementalDeposit,
            params.auctionId,
            params.userId
          );
        } catch (freezeError) {
          // Requirement 3.5: Rollback on deposit freeze failure
          console.error('Failed to freeze deposit:', freezeError);
          return {
            success: false,
            error: freezeError instanceof Error 
              ? freezeError.message 
              : 'Failed to freeze deposit',
          };
        }

        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          // Rollback freeze
          await escrowService.unfreezeDeposit(
            params.vendorId,
            incrementalDeposit,
            params.auctionId,
            params.userId
          );
          throw new Error('Bid placement timeout - please retry');
        }

        // Requirement 3.4: Create bid record with depositAmount field
        const [newBid] = await tx
          .insert(bids)
          .values({
            auctionId: params.auctionId,
            vendorId: params.vendorId,
            amount: params.bidAmount.toFixed(2),
            depositAmount: depositAmount.toFixed(2),
            status: 'active',
            isLegacy: isLegacyAuction, // Requirement 21.1: Mark legacy bids
            otpVerified: true, // Assuming OTP verified before calling this service
            ipAddress: params.ipAddress,
            deviceType: params.deviceType,
          })
          .returning();

        // Get previous bidder
        const previousBidderId = auction.currentBidder;

        // Update auction with new current bid and bidder
        await tx
          .update(auctions)
          .set({
            currentBid: params.bidAmount.toFixed(2),
            currentBidder: params.vendorId,
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, params.auctionId));

        // Requirement 4.1-4.2: Unfreeze previous bidder's deposit
        if (previousBidderId && previousBidderId !== params.vendorId) {
          try {
            // Get previous bidder's last bid
            const [previousBid] = await tx
              .select()
              .from(bids)
              .where(
                and(
                  eq(bids.auctionId, params.auctionId),
                  eq(bids.vendorId, previousBidderId)
                )
              )
              .orderBy(desc(bids.createdAt))
              .limit(1);

            if (previousBid) {
              const previousBidAmount = parseFloat(previousBid.amount);
              const previousDepositAmount = depositCalculatorService.calculateDeposit(
                previousBidAmount,
                depositRate,
                minimumDepositFloor
              );

              // Unfreeze previous bidder's deposit
              await escrowService.unfreezeDeposit(
                previousBidderId,
                previousDepositAmount,
                params.auctionId,
                params.userId
              );

              console.log(
                `✅ Unfroze deposit for previous bidder ${previousBidderId}: ₦${previousDepositAmount.toLocaleString()}`
              );
            }
          } catch (unfreezeError) {
            // Log error but don't fail the bid placement
            console.error('Failed to unfreeze previous bidder deposit:', unfreezeError);
            // This will be handled manually if needed
          }
        }

        // Requirement 27.5: Release locks after bid processing completes
        const elapsedTime = Date.now() - startTime;
        console.log(`✅ Bid placed successfully in ${elapsedTime}ms`);

        return {
          success: true,
          bidId: newBid.id,
          depositAmount,
        };
      });
    } catch (error) {
      console.error('Bid placement error:', error);

      // Requirement 27.6: Return error on lock acquisition timeout
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          success: false,
          error: 'System busy, please retry',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to place bid',
      };
    }
  }

  /**
   * Get vendor's current bid on an auction
   * 
   * @param vendorId - Vendor ID
   * @param auctionId - Auction ID
   * @returns Current bid or null
   */
  async getVendorCurrentBid(
    vendorId: string,
    auctionId: string
  ): Promise<typeof bids.$inferSelect | null> {
    try {
      const [currentBid] = await db
        .select()
        .from(bids)
        .where(
          and(
            eq(bids.auctionId, auctionId),
            eq(bids.vendorId, vendorId)
          )
        )
        .orderBy(desc(bids.createdAt))
        .limit(1);

      return currentBid || null;
    } catch (error) {
      console.error('Failed to get vendor current bid:', error);
      return null;
    }
  }

  /**
   * Get all bids for an auction
   * 
   * @param auctionId - Auction ID
   * @returns List of bids
   */
  async getAuctionBids(auctionId: string): Promise<typeof bids.$inferSelect[]> {
    try {
      const auctionBids = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auctionId))
        .orderBy(desc(bids.createdAt));

      return auctionBids;
    } catch (error) {
      console.error('Failed to get auction bids:', error);
      return [];
    }
  }
}

// Export singleton instance
export const bidService = new BidService();
