/**
 * Bidding Service
 * Handles bid placement with OTP verification and real-time broadcasting
 * 
 * Requirements:
 * - Requirement 18: Bid Placement with OTP
 * - Requirement 19: Outbid Push Notifications
 * - Enterprise Standards Section 5: Business Logic Layer
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, desc } from 'drizzle-orm';
import { otpService } from '@/features/auth/services/otp.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { broadcastNewBid, notifyVendorOutbid } from '@/lib/socket/server';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { autoExtendService } from './auto-extend.service';
import { escrowService } from '@/features/payments/services/escrow.service';
import { createOutbidNotification } from '@/features/notifications/services/notification.service';
import { cache } from '@/lib/redis/client';
import { depositCalculatorService } from './deposit-calculator.service';
import { configService } from '@/features/auction-deposit/services/config.service';

/**
 * Bid placement data
 */
export interface PlaceBidData {
  auctionId: string;
  vendorId: string;
  amount: number;
  otp: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Bid placement result
 */
export interface PlaceBidResult {
  success: boolean;
  bid?: {
    id: string;
    auctionId: string;
    vendorId: string;
    amount: string;
    createdAt: Date;
  };
  error?: string;
  errors?: string[];
}

/**
 * Bid validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Bidding Service
 * Handles bid placement with validation and real-time updates
 */
export class BiddingService {
  /**
   * Place a bid on an auction
   * 
   * Requirements:
   * - Validate bid amount > current bid + minimum increment
   * - Validate vendor tier vs auction value (Tier 1 ≤₦500k, Tier 2 unlimited)
   * - Validate auction is in 'active' or 'extended' status
   * - Verify OTP
   * - Update auction current bid and current bidder
   * - Broadcast new bid via Socket.io within 2 seconds
   * - Send push notification to previous highest bidder within 5 seconds
   * - Create audit log entry with IP address
   * 
   * @param data - Bid placement data
   * @returns Bid placement result
   */
  async placeBid(data: PlaceBidData): Promise<PlaceBidResult> {
    const startTime = Date.now();

    try {
      // SECURITY FIX: Enhanced input validation
      if (!data.auctionId || !data.vendorId || !data.amount || !data.otp) {
        return {
          success: false,
          error: 'Auction ID, vendor ID, bid amount, and OTP are required',
        };
      }

      // Validate bid amount is a positive number
      if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) {
        return {
          success: false,
          error: 'Bid amount must be a positive number',
        };
      }

      // Validate bid amount is not unreasonably large (max ₦100M)
      if (data.amount > 100000000) {
        return {
          success: false,
          error: 'Bid amount exceeds maximum allowed (₦100,000,000)',
        };
      }

      // Validate bid amount has at most 2 decimal places
      if (!Number.isInteger(data.amount * 100)) {
        return {
          success: false,
          error: 'Bid amount can have at most 2 decimal places',
        };
      }

      // Fetch auction with case details
      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, data.auctionId),
        with: {
          case: true,
        },
      });

      if (!auction) {
        return {
          success: false,
          error: 'Auction not found',
        };
      }

      // Fetch vendor with user details
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, data.vendorId),
      });

      if (!vendor) {
        return {
          success: false,
          error: 'Vendor not found',
        };
      }

      // Fetch user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Validate bid
      const validation = await this.validateBid(
        data.amount,
        auction.currentBid ? Number(auction.currentBid) : null,
        Number(auction.minimumIncrement),
        auction.status,
        vendor.tier,
        data.otp,
        user.phone,
        data.vendorId,
        data.auctionId
      );

      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          error: validation.errors[0],
        };
      }

      // Get previous highest bidder for notification
      const previousBidderId = auction.currentBidder;

      // CRITICAL: Check for existing bid BEFORE creating new bid (for incremental deposit calculation)
      // This must be done before the transaction to avoid finding the bid we just created
      const existingBids = await db
        .select()
        .from(bids)
        .where(
          and(
            eq(bids.auctionId, data.auctionId),
            eq(bids.vendorId, data.vendorId)
          )
        )
        .orderBy(desc(bids.createdAt))
        .limit(1);

      const existingBid = existingBids.length > 0 ? existingBids[0] : null;

      // SCALABILITY: Use database transaction with row locking to prevent race conditions
      // This ensures atomic bid updates and prevents concurrent bid conflicts
      let newBid: typeof bids.$inferSelect;
      
      try {
        await db.transaction(async (tx) => {
          // Lock the auction row for update (prevents concurrent modifications)
          const [lockedAuction] = await tx
            .select()
            .from(auctions)
            .where(eq(auctions.id, data.auctionId))
            .for('update'); // PostgreSQL row-level lock

          if (!lockedAuction) {
            throw new Error('Auction not found or locked');
          }

          // Re-validate bid amount against locked auction state
          // This prevents race condition where two bids arrive simultaneously
          const currentBidAmount = lockedAuction.currentBid ? Number(lockedAuction.currentBid) : null;
          const minimumBid = currentBidAmount ? currentBidAmount + 20000 : Number(lockedAuction.minimumIncrement);
          
          if (data.amount < minimumBid) {
            throw new Error(`Bid too low. Minimum bid: ₦${minimumBid.toLocaleString()}`);
          }

          // Validate auction status again (could have changed)
          if (lockedAuction.status !== 'active' && lockedAuction.status !== 'extended') {
            throw new Error(`Auction is no longer active (status: ${lockedAuction.status})`);
          }

          // Create bid record within transaction
          const [createdBid] = await tx
            .insert(bids)
            .values({
              auctionId: data.auctionId,
              vendorId: data.vendorId,
              amount: data.amount.toString(),
              otpVerified: true,
              ipAddress: data.ipAddress,
              deviceType: this.getDeviceType(data.userAgent),
            })
            .returning();

          newBid = createdBid;

          // Update auction with new current bid and bidder (atomic)
          await tx
            .update(auctions)
            .set({
              currentBid: data.amount.toString(),
              currentBidder: data.vendorId,
              updatedAt: new Date(),
            })
            .where(eq(auctions.id, data.auctionId));
        });
      } catch (txError) {
        console.error('Transaction failed:', txError);
        return {
          success: false,
          error: txError instanceof Error ? txError.message : 'Failed to place bid due to concurrent update',
        };
      }

      // Calculate deposit amount (Requirement 1.1: max(bid × rate, floor))
      let depositAmount: number;
      let incrementalDeposit: number;
      try {
        const config = await configService.getConfig();
        // Convert percentage to decimal (10% → 0.10)
        const depositRateDecimal = config.depositRate / 100;
        depositAmount = depositCalculatorService.calculateDeposit(
          data.amount,
          depositRateDecimal,
          config.minimumDepositFloor
        );
        if (existingBid) {
          // Calculate incremental deposit (only freeze the difference)
          const previousBidAmount = parseFloat(existingBid.amount);
          incrementalDeposit = depositCalculatorService.calculateIncrementalDeposit(
            data.amount,
            previousBidAmount,
            depositRateDecimal,
            config.minimumDepositFloor
          );
          console.log(`💰 Incremental deposit for ₦${data.amount.toLocaleString()} bid (previous: ₦${previousBidAmount.toLocaleString()}): ₦${incrementalDeposit.toLocaleString()} (total deposit: ₦${depositAmount.toLocaleString()})`);
        } else {
          // First bid - freeze full deposit
          incrementalDeposit = depositAmount;
          console.log(`💰 Deposit calculated for ₦${data.amount.toLocaleString()} bid: ₦${depositAmount.toLocaleString()} (${config.depositRate.toFixed(0)}% rate, ₦${config.minimumDepositFloor.toLocaleString()} floor)`);
        }
      } catch (error) {
        console.error('Failed to calculate deposit:', error);
        // Fallback to 10% if config fails
        depositAmount = Math.max(Math.ceil(data.amount * 0.10), 100000);
        incrementalDeposit = depositAmount;
        console.log(`⚠️ Using fallback deposit calculation: ₦${depositAmount.toLocaleString()}`);
      }

      // Freeze INCREMENTAL deposit funds for this bid (Requirement 3.1: Freeze deposit on bid placement)
      try {
        if (incrementalDeposit > 0) {
          console.log(`\n🔒 FREEZING FUNDS:`);
          console.log(`   Vendor: ${data.vendorId}`);
          console.log(`   Bid Amount: ₦${data.amount.toLocaleString()}`);
          console.log(`   Total Deposit Required: ₦${depositAmount.toLocaleString()}`);
          console.log(`   Incremental Deposit to Freeze: ₦${incrementalDeposit.toLocaleString()}`);
          console.log(`   Existing Bid: ${existingBid ? `₦${parseFloat(existingBid.amount).toLocaleString()}` : 'None (first bid)'}\n`);
          
          await escrowService.freezeFunds(
            data.vendorId,
            incrementalDeposit,  // ✅ INCREMENTAL ONLY
            data.auctionId,
            user.id
          );
          console.log(`✅ SUCCESS: Incremental deposit frozen for vendor ${data.vendorId}: ₦${incrementalDeposit.toLocaleString()}`);
          console.log(`   Total deposit now: ₦${depositAmount.toLocaleString()} (for bid: ₦${data.amount.toLocaleString()})\n`);
        } else {
          console.log(`\nℹ️  NO FREEZE NEEDED:`);
          console.log(`   Vendor: ${data.vendorId}`);
          console.log(`   New Bid: ₦${data.amount.toLocaleString()}`);
          console.log(`   Previous Bid: ₦${existingBid ? parseFloat(existingBid.amount).toLocaleString() : 'N/A'}`);
          console.log(`   Total Deposit Required: ₦${depositAmount.toLocaleString()}`);
          console.log(`   Reason: Bid increase within minimum floor (₦100k already frozen)\n`);
        }
      } catch (error) {
        console.error('❌ FAILED to freeze deposit:', error);
        // Rollback bid creation if freeze fails
        await db.delete(bids).where(eq(bids.id, newBid!.id));
        return {
          success: false,
          error: 'Failed to freeze deposit. Please ensure you have sufficient wallet balance.',
        };
      }

      // Unfreeze deposit for previous bidder if exists and is different (Requirement 4.1: Unfreeze on outbid)
      if (previousBidderId && previousBidderId !== data.vendorId) {
        try {
          // Get previous bid amount
          const previousBid = await db.query.bids.findFirst({
            where: and(
              eq(bids.auctionId, data.auctionId),
              eq(bids.vendorId, previousBidderId)
            ),
            orderBy: desc(bids.createdAt),
          });

          if (previousBid) {
            const previousBidAmount = parseFloat(previousBid.amount);
            
            // Calculate previous deposit amount
            let previousDepositAmount: number;
            try {
              const config = await configService.getConfig();
              previousDepositAmount = depositCalculatorService.calculateDeposit(
                previousBidAmount,
                config.depositRate,
                config.minimumDepositFloor
              );
            } catch (error) {
              // Fallback to 10% if config fails
              previousDepositAmount = Math.max(Math.ceil(previousBidAmount * 0.10), 100000);
            }
            
            // Get previous bidder's user ID
            const [previousVendor] = await db
              .select()
              .from(vendors)
              .where(eq(vendors.id, previousBidderId))
              .limit(1);

            if (previousVendor) {
              await escrowService.unfreezeFunds(
                previousBidderId,
                previousDepositAmount,  // ✅ DEPOSIT ONLY, not full amount
                data.auctionId,
                previousVendor.userId
              );
              console.log(`✅ Deposit unfrozen for previous bidder ${previousBidderId}: ₦${previousDepositAmount.toLocaleString()} (bid was: ₦${previousBidAmount.toLocaleString()})`);
            }
          }
        } catch (error) {
          console.error('Failed to unfreeze previous bidder deposit:', error);
          // Don't fail the bid placement if unfreezing fails - log for manual review
        }
      }

      // SCALABILITY: Invalidate cache for this auction
      // This ensures users see the latest bid immediately
      const detailsCacheKey = `auction:details:${data.auctionId}`;
      await cache.del(detailsCacheKey);
      console.log(`✅ Cache invalidated: ${detailsCacheKey}`);

      // Create audit log entry
      await logAction({
        userId: user.id,
        actionType: AuditActionType.BID_PLACED,
        entityType: AuditEntityType.BID,
        entityId: newBid!.id,
        ipAddress: data.ipAddress,
        deviceType: this.getDeviceType(data.userAgent),
        userAgent: data.userAgent,
        afterState: {
          bidId: newBid!.id,
          auctionId: data.auctionId,
          vendorId: data.vendorId,
          amount: data.amount,
        },
      });

      // Broadcast new bid via Socket.io (async, don't wait)
      // Requirement 18.8: Broadcast within 2 seconds
      this.broadcastBid(newBid!, startTime).catch((error) => {
        console.error('Failed to broadcast bid:', error);
      });

      // Check and extend auction if needed (async, don't wait)
      // Requirement 21: Auto-extend if bid placed with <5 minutes remaining
      this.checkAndExtendAuction(data.auctionId, data.ipAddress, data.userAgent).catch((error) => {
        console.error('Failed to check auction extension:', error);
      });

      // Notify previous highest bidder (async, don't wait)
      // Requirement 19.4: Notify within 5 seconds
      if (previousBidderId && previousBidderId !== data.vendorId) {
        this.notifyPreviousBidder(
          previousBidderId,
          data.auctionId,
          data.amount,
          startTime
        ).catch((error) => {
          console.error('Failed to notify previous bidder:', error);
        });
      }

      return {
        success: true,
        bid: {
          id: newBid!.id,
          auctionId: newBid!.auctionId,
          vendorId: newBid!.vendorId,
          amount: newBid!.amount,
          createdAt: newBid!.createdAt,
        },
      };
    } catch (error) {
      console.error('Failed to place bid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to place bid',
      };
    }
  }

  /**
   * Validate bid before placement
   * 
   * @param bidAmount - Bid amount
   * @param currentBid - Current highest bid (null if first bid)
   * @param minimumIncrement - Minimum bid increment (₦20,000)
   * @param auctionStatus - Auction status
   * @param vendorTier - Vendor tier
   * @param otp - OTP code
   * @param phone - Vendor phone number
   * @param vendorId - Vendor ID (for balance check)
   * @param auctionId - Auction ID (for incremental deposit check)
   * @returns Validation result
   */
  async validateBid(
    bidAmount: number,
    currentBid: number | null,
    minimumIncrement: number,
    auctionStatus: string,
    vendorTier: string,
    otp: string,
    phone: string,
    vendorId: string,
    auctionId: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Calculate minimum bid: if no current bid, use reserve price; otherwise current bid + ₦20,000
    const minimumBid = currentBid ? currentBid + 20000 : minimumIncrement; // minimumIncrement is actually reserve price when no bids
    if (bidAmount < minimumBid) {
      errors.push(`Minimum bid: ₦${minimumBid.toLocaleString()}`);
    }

    // Validate auction status
    if (auctionStatus !== 'active' && auctionStatus !== 'extended') {
      errors.push(`Auction must be in active or extended status (current: ${auctionStatus})`);
    }

    // Validate vendor tier vs bid amount (Requirement 5.6)
    if (bidAmount > 500000 && vendorTier === 'tier1_bvn') {
      errors.push('Bid exceeds your Tier 1 limit of ₦500,000. Upgrade to Tier 2 for unlimited bidding and access to premium auctions.');
    }

    // Check for existing bid from this vendor (for incremental deposit calculation)
    let requiredDeposit: number;
    try {
      const config = await configService.getConfig();
      const depositRateDecimal = config.depositRate / 100;
      
      // Check if vendor already has a bid on this auction
      const existingBids = await db
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

      const existingBid = existingBids.length > 0 ? existingBids[0] : null;

      if (existingBid) {
        // Calculate INCREMENTAL deposit (only the additional amount needed)
        const previousBidAmount = parseFloat(existingBid.amount);
        requiredDeposit = depositCalculatorService.calculateIncrementalDeposit(
          bidAmount,
          previousBidAmount,
          depositRateDecimal,
          config.minimumDepositFloor
        );
        console.log(`\n🔍 VALIDATION - Incremental Deposit Check:`);
        console.log(`   Previous Bid: ₦${previousBidAmount.toLocaleString()}`);
        console.log(`   New Bid: ₦${bidAmount.toLocaleString()}`);
        console.log(`   Incremental Deposit Required: ₦${requiredDeposit.toLocaleString()}`);
      } else {
        // First bid - require full deposit
        requiredDeposit = depositCalculatorService.calculateDeposit(
          bidAmount,
          depositRateDecimal,
          config.minimumDepositFloor
        );
        console.log(`\n🔍 VALIDATION - First Bid Deposit Check:`);
        console.log(`   Bid Amount: ₦${bidAmount.toLocaleString()}`);
        console.log(`   Full Deposit Required: ₦${requiredDeposit.toLocaleString()}`);
      }
    } catch (error) {
      console.error('Error calculating deposit:', error);
      // Fallback to 10% with ₦100k minimum
      requiredDeposit = Math.max(Math.ceil(bidAmount * 0.10), 100000);
    }

    // Check wallet balance - vendor must have sufficient funds for INCREMENTAL DEPOSIT
    try {
      const walletBalance = await escrowService.getBalance(vendorId);
      console.log(`   Available Balance: ₦${walletBalance.availableBalance.toLocaleString()}`);
      console.log(`   Balance Check: ${walletBalance.availableBalance >= requiredDeposit ? '✅ PASS' : '❌ FAIL'}\n`);
      
      if (walletBalance.availableBalance < requiredDeposit) {
        errors.push(
          `Insufficient wallet balance for deposit. Available: ₦${walletBalance.availableBalance.toLocaleString()}, Required Deposit: ₦${requiredDeposit.toLocaleString()}. Please fund your wallet before bidding.`
        );
      }
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      errors.push('Unable to verify wallet balance. Please try again.');
    }

    // Verify OTP
    const otpVerification = await otpService.verifyOTP(
      phone,
      otp,
      'unknown', // IP address not needed for verification
      'mobile' // Device type not needed for verification
    );

    if (!otpVerification.success) {
      errors.push('OTP verification failed. Please request a new OTP.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get auction bids
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

  /**
   * Get current highest bid for an auction
   * 
   * @param auctionId - Auction ID
   * @returns Highest bid or null
   */
  async getCurrentHighestBid(auctionId: string): Promise<typeof bids.$inferSelect | null> {
    try {
      const [highestBid] = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auctionId))
        .orderBy(desc(bids.amount))
        .limit(1);

      return highestBid || null;
    } catch (error) {
      console.error('Failed to get highest bid:', error);
      return null;
    }
  }

  /**
   * Broadcast new bid via Socket.io
   * Requirement 18.8: Broadcast within 2 seconds
   * 
   * @param bid - Bid data
   * @param startTime - Request start time
   */
  private async broadcastBid(bid: typeof bids.$inferSelect, startTime: number): Promise<void> {
    try {
      await broadcastNewBid(bid.auctionId, {
        id: bid.id,
        auctionId: bid.auctionId,
        vendorId: bid.vendorId,
        amount: bid.amount,
        createdAt: bid.createdAt,
      });

      const broadcastTime = Date.now() - startTime;
      console.log(`✅ Bid broadcast completed in ${broadcastTime}ms`);

      if (broadcastTime > 2000) {
        console.warn(`⚠️ Bid broadcast exceeded 2 second limit: ${broadcastTime}ms`);
      }
    } catch (error) {
      console.error('Failed to broadcast bid:', error);
      throw error;
    }
  }

  /**
   * Notify previous highest bidder that they've been outbid
   * Requirement 19.4: Notify within 5 seconds
   * 
   * @param previousBidderId - Previous bidder vendor ID
   * @param auctionId - Auction ID
   * @param newBidAmount - New bid amount
   * @param startTime - Request start time
   */
  private async notifyPreviousBidder(
    previousBidderId: string,
    auctionId: string,
    newBidAmount: number,
    startTime: number
  ): Promise<void> {
    try {
      // Send Socket.io notification
      await notifyVendorOutbid(previousBidderId, auctionId, newBidAmount);

      // Fetch previous bidder details for SMS and email notification
      const previousVendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, previousBidderId),
      });

      if (previousVendor) {
        // Fetch user details
        const [previousUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, previousVendor.userId))
          .limit(1);

        if (previousUser) {
          // Get auction details for email
          const [auction] = await db
            .select()
            .from(auctions)
            .where(eq(auctions.id, auctionId))
            .limit(1);

          // Get case details for asset name
          let assetName = 'Salvage Item';
          if (auction) {
            const [caseDetails] = await db
              .select()
              .from(salvageCases)
              .where(eq(salvageCases.id, auction.caseId))
              .limit(1);
            
            if (caseDetails) {
              assetName = `${caseDetails.assetType.toUpperCase()} - ${caseDetails.claimReference}`;
            }
          }

          // Get previous bid amount
          const previousBids = await db
            .select()
            .from(bids)
            .where(and(eq(bids.auctionId, auctionId), eq(bids.vendorId, previousBidderId)))
            .orderBy(desc(bids.amount))
            .limit(1);

          const yourBid = previousBids.length > 0 ? parseFloat(previousBids[0].amount) : 0;

          // Calculate time remaining
          let timeRemaining: string | undefined;
          if (auction) {
            const now = new Date();
            const endTime = new Date(auction.endTime);
            const diff = endTime.getTime() - now.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timeRemaining = `${hours}h ${minutes}m`;
          }

          // Send SMS notification
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
          const smsMessage = `You've been outbid! New bid: ₦${newBidAmount.toLocaleString()}. Place a higher bid now: ${appUrl}/vendor/auctions/${auctionId}`;

          await smsService.sendSMS({
            to: previousUser.phone,
            message: smsMessage,
          });

          // Send email notification using professional template
          await emailService.sendBidAlertEmail(previousUser.email, {
            vendorName: previousUser.fullName,
            auctionId: auctionId,
            assetName: assetName,
            alertType: 'outbid',
            yourBid: yourBid,
            currentBid: newBidAmount,
            timeRemaining: timeRemaining,
            appUrl: appUrl,
          });

          // Create in-app notification
          await createOutbidNotification(
            previousUser.id,
            auctionId,
            newBidAmount,
            assetName
          );
        }
      }

      const notificationTime = Date.now() - startTime;
      console.log(`✅ Outbid notification completed in ${notificationTime}ms`);

      if (notificationTime > 5000) {
        console.warn(`⚠️ Outbid notification exceeded 5 second limit: ${notificationTime}ms`);
      }
    } catch (error) {
      console.error('Failed to notify previous bidder:', error);
      throw error;
    }
  }

  /**
   * Check and extend auction if bid placed with <5 minutes remaining
   * Requirement 21: Auto-extend auctions
   * 
   * @param auctionId - Auction ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   */
  private async checkAndExtendAuction(
    auctionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const extensionResult = await autoExtendService.extendAuction(
        auctionId,
        ipAddress,
        userAgent
      );

      if (extensionResult.success) {
        console.log(`✅ Auction ${auctionId} auto-extended`);
      }
    } catch (error) {
      console.error('Failed to check auction extension:', error);
      throw error;
    }
  }

  /**
   * Get device type from user agent
   * 
   * @param userAgent - User agent string
   * @returns Device type
   */
  private getDeviceType(userAgent: string): DeviceType {
    const ua = userAgent.toLowerCase();

    if (ua.includes('tablet') || ua.includes('ipad')) {
      return DeviceType.TABLET;
    }

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return DeviceType.MOBILE;
    }

    return DeviceType.DESKTOP;
  }
}

// Export singleton instance
export const biddingService = new BiddingService();
