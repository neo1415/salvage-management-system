/**
 * Auto-Extension Service
 * Handles auction auto-extension logic when bids are placed in final 5 minutes
 * 
 * Requirements:
 * - Requirement 21: Auto-Extend Auctions
 * - Enterprise Standards Section 5: Business Logic Layer
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, desc } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { broadcastAuctionExtension } from '@/lib/socket/server';
import { smsService } from '@/features/notifications/services/sms.service';

/**
 * Extension check result
 */
export interface ExtensionCheckResult {
  shouldExtend: boolean;
  newEndTime?: Date;
  newStatus?: string;
  newExtensionCount?: number;
  timeRemainingMs?: number;
}

/**
 * Extension result
 */
export interface ExtensionResult {
  success: boolean;
  auction?: {
    id: string;
    endTime: Date;
    extensionCount: number;
    status: string;
  };
  error?: string;
}

/**
 * Auto-Extension Service
 * Handles auction auto-extension when bids are placed in final 5 minutes
 */
export class AutoExtendService {
  private readonly EXTENSION_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly EXTENSION_DURATION_MS = 2 * 60 * 1000; // 2 minutes in milliseconds

  /**
   * Check if auction should be extended and calculate new end time
   * 
   * Requirements:
   * - If bid placed when <5 minutes remaining, extend by 2 minutes
   * - Change status to 'extended'
   * - Increment extension count
   * - Allow unlimited extensions
   * 
   * @param auctionId - Auction ID
   * @param currentTime - Current time (for testing)
   * @returns Extension check result
   */
  async checkAndExtendAuction(
    auctionId: string,
    currentTime: Date = new Date()
  ): Promise<ExtensionCheckResult> {
    try {
      // Fetch auction
      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, auctionId),
      });

      if (!auction) {
        return {
          shouldExtend: false,
        };
      }

      // Check if auction is in active or extended status
      if (auction.status !== 'active' && auction.status !== 'extended') {
        return {
          shouldExtend: false,
        };
      }

      // Calculate time remaining
      const timeRemainingMs = auction.endTime.getTime() - currentTime.getTime();

      // Check if time remaining is less than 5 minutes
      if (timeRemainingMs < this.EXTENSION_THRESHOLD_MS) {
        // Calculate new end time (current end time + 2 minutes)
        const newEndTime = new Date(auction.endTime.getTime() + this.EXTENSION_DURATION_MS);
        const newExtensionCount = auction.extensionCount + 1;

        return {
          shouldExtend: true,
          newEndTime,
          newStatus: 'extended',
          newExtensionCount,
          timeRemainingMs,
        };
      }

      return {
        shouldExtend: false,
        timeRemainingMs,
      };
    } catch (error) {
      console.error('Failed to check auction extension:', error);
      return {
        shouldExtend: false,
      };
    }
  }

  /**
   * Extend auction
   * 
   * Requirements:
   * - Extend end time by 2 minutes
   * - Update status to 'extended'
   * - Increment extension count
   * - Broadcast extension via Socket.io
   * - Send push + SMS notification to all bidders
   * - Create audit log entry
   * 
   * @param auctionId - Auction ID
   * @param ipAddress - IP address (for audit log)
   * @param userAgent - User agent (for audit log)
   * @returns Extension result
   */
  async extendAuction(
    auctionId: string,
    ipAddress: string = 'system',
    userAgent: string = 'auto-extend-service'
  ): Promise<ExtensionResult> {
    try {
      // Check if extension is needed
      const extensionCheck = await this.checkAndExtendAuction(auctionId);

      if (!extensionCheck.shouldExtend || !extensionCheck.newEndTime) {
        return {
          success: false,
          error: 'Auction does not need extension',
        };
      }

      // Fetch auction before update
      const auctionBefore = await db.query.auctions.findFirst({
        where: eq(auctions.id, auctionId),
      });

      if (!auctionBefore) {
        return {
          success: false,
          error: 'Auction not found',
        };
      }

      // Update auction
      const [updatedAuction] = await db
        .update(auctions)
        .set({
          endTime: extensionCheck.newEndTime,
          status: extensionCheck.newStatus as any,
          extensionCount: extensionCheck.newExtensionCount,
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auctionId))
        .returning();

      // Create audit log entry
      await logAction({
        userId: 'system', // System-triggered action
        actionType: AuditActionType.AUCTION_EXTENDED,
        entityType: AuditEntityType.AUCTION,
        entityId: auctionId,
        ipAddress,
        deviceType: DeviceType.DESKTOP,
        userAgent,
        beforeState: {
          endTime: auctionBefore.endTime.toISOString(),
          status: auctionBefore.status,
          extensionCount: auctionBefore.extensionCount,
        },
        afterState: {
          endTime: updatedAuction.endTime.toISOString(),
          status: updatedAuction.status,
          extensionCount: updatedAuction.extensionCount,
        },
      });

      // Broadcast extension via Socket.io (async, don't wait)
      this.broadcastExtension(auctionId, extensionCheck.newEndTime).catch((error) => {
        console.error('Failed to broadcast extension:', error);
      });

      // Notify all bidders (async, don't wait)
      this.notifyBidders(auctionId, extensionCheck.newEndTime).catch((error) => {
        console.error('Failed to notify bidders:', error);
      });

      console.log(
        `✅ Auction ${auctionId} extended to ${extensionCheck.newEndTime.toISOString()} (extension #${extensionCheck.newExtensionCount})`
      );

      return {
        success: true,
        auction: {
          id: updatedAuction.id,
          endTime: updatedAuction.endTime,
          extensionCount: updatedAuction.extensionCount,
          status: updatedAuction.status,
        },
      };
    } catch (error) {
      console.error('Failed to extend auction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extend auction',
      };
    }
  }

  /**
   * Broadcast extension via Socket.io
   * Requirement 21.3: Notify all bidders
   * 
   * @param auctionId - Auction ID
   * @param newEndTime - New end time
   */
  private async broadcastExtension(auctionId: string, newEndTime: Date): Promise<void> {
    try {
      await broadcastAuctionExtension(auctionId, newEndTime);
      console.log(`📢 Broadcasted auction extension for ${auctionId}`);
    } catch (error) {
      console.error('Failed to broadcast extension:', error);
      throw error;
    }
  }

  /**
   * Notify all bidders about auction extension
   * Requirement 21.3: Send push and SMS notification to all bidders
   * 
   * @param auctionId - Auction ID
   * @param newEndTime - New end time
   */
  private async notifyBidders(auctionId: string, newEndTime: Date): Promise<void> {
    try {
      // Get all unique bidders for this auction
      const auctionBids = await db
        .select({
          vendorId: bids.vendorId,
        })
        .from(bids)
        .where(eq(bids.auctionId, auctionId))
        .groupBy(bids.vendorId);

      if (auctionBids.length === 0) {
        console.log('No bidders to notify for auction extension');
        return;
      }

      console.log(`Notifying ${auctionBids.length} bidders about auction extension`);

      // Get vendor and user details for all bidders
      const bidderDetails = await Promise.all(
        auctionBids.map(async (bid) => {
          const vendor = await db.query.vendors.findFirst({
            where: eq(vendors.id, bid.vendorId),
          });

          if (!vendor) return null;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, vendor.userId))
            .limit(1);

          if (!user) return null;

          return {
            vendorId: vendor.id,
            phone: user.phone,
            fullName: user.fullName,
          };
        })
      );

      // Filter out null values
      const validBidders = bidderDetails.filter((bidder) => bidder !== null);

      // Send SMS notifications to all bidders
      const notificationPromises = validBidders.map((bidder) =>
        this.sendExtensionNotification(bidder!, auctionId, newEndTime)
      );

      await Promise.allSettled(notificationPromises);

      console.log(`✅ Sent extension notifications to ${validBidders.length} bidders`);
    } catch (error) {
      console.error('Failed to notify bidders:', error);
      throw error;
    }
  }

  /**
   * Send extension notification to a single bidder
   * 
   * @param bidder - Bidder details
   * @param auctionId - Auction ID
   * @param newEndTime - New end time
   */
  private async sendExtensionNotification(
    bidder: { vendorId: string; phone: string; fullName: string },
    auctionId: string,
    newEndTime: Date
  ): Promise<void> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
      const auctionUrl = `${appUrl}/vendor/auctions/${auctionId}`;

      // Format new end time
      const endTimeFormatted = newEndTime.toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      // Send SMS notification
      const smsMessage = `⏰ Auction extended by 2 minutes! New end time: ${endTimeFormatted}. Continue bidding: ${auctionUrl}`;

      await smsService.sendSMS({
        to: bidder.phone,
        message: smsMessage,
      });

      console.log(`📱 Sent extension SMS to ${bidder.phone}`);
    } catch (error) {
      console.error(`Failed to send extension notification to ${bidder.vendorId}:`, error);
      // Don't throw - we want to continue notifying other bidders
    }
  }

  /**
   * Check if auction should be closed (no bids for 5 consecutive minutes)
   * 
   * Requirement 21.5: Close auction when no bids for 5 consecutive minutes
   * 
   * @param auctionId - Auction ID
   * @returns True if auction should be closed
   */
  async shouldCloseAuction(auctionId: string): Promise<boolean> {
    try {
      // Get the most recent bid for this auction
      const [latestBid] = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auctionId))
        .orderBy(desc(bids.createdAt))
        .limit(1);

      if (!latestBid) {
        // No bids yet, don't close
        return false;
      }

      // Check if 5 minutes have passed since last bid
      const now = new Date();
      const timeSinceLastBid = now.getTime() - latestBid.createdAt.getTime();
      const fiveMinutesMs = 5 * 60 * 1000;

      return timeSinceLastBid >= fiveMinutesMs;
    } catch (error) {
      console.error('Failed to check if auction should close:', error);
      return false;
    }
  }
}

// Export singleton instance
export const autoExtendService = new AutoExtendService();
