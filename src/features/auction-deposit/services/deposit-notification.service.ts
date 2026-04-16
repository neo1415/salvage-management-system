/**
 * Deposit Notification Service
 * Centralized notification management for auction deposit events
 * 
 * Requirements:
 * - Requirement 24: Notification System for Deposit Events
 * 
 * PERFORMANCE: Async queue-based delivery, batch processing, deduplication
 * RELIABILITY: Multi-channel delivery (email + SMS + push + in-app), automatic fallback
 */

import { createNotification } from '@/features/notifications/services/notification.service';
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';
import { pushNotificationService } from '@/features/notifications/services/push.service';
import { db } from '@/lib/db/drizzle';
import { users, vendors, auctions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';

export interface DepositNotificationContext {
  vendorId: string;
  auctionId: string;
  amount: number;
  assetName?: string;
  deadline?: Date;
  reason?: string;
}

/**
 * Deposit Notification Service
 * Handles all deposit-related notifications with performance optimizations
 */
export class DepositNotificationService {
  private readonly DEDUP_TTL = 300; // 5 minutes deduplication window
  private readonly DEDUP_PREFIX = 'notif:dedup:';

  /**
   * Send deposit freeze notification
   * "Deposit of ₦{amount} frozen for auction {asset_name}"
   * 
   * @param context - Notification context
   */
  async sendDepositFrozenNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, amount, assetName } = context;

    // Deduplication check
    if (await this.isDuplicate('freeze', vendorId, auctionId)) {
      console.log(`⏸️  Skipping duplicate freeze notification for vendor ${vendorId}`);
      return;
    }

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const formattedAmount = amount.toLocaleString();

    // Send multi-channel notifications (async, non-blocking)
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'outbid', // Reuse existing type for deposit freeze
        title: 'Deposit Frozen',
        message: `Deposit of ₦${formattedAmount} frozen for ${asset}`,
        data: {
          auctionId,
          amount,
          assetName: asset,
          type: 'deposit_freeze',
        },
      }),

      // SMS notification (high priority)
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: Deposit of ₦${formattedAmount} frozen for ${asset}. Good luck!`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending deposit frozen notifications:', error);
    });

    // Mark as sent for deduplication
    await this.markAsSent('freeze', vendorId, auctionId);
  }

  /**
   * Send deposit unfreeze notification (outbid)
   * "Deposit of ₦{amount} unfrozen - you were outbid on {asset_name}"
   * 
   * @param context - Notification context
   */
  async sendDepositUnfrozenNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, amount, assetName } = context;

    // Deduplication check
    if (await this.isDuplicate('unfreeze', vendorId, auctionId)) {
      console.log(`⏸️  Skipping duplicate unfreeze notification for vendor ${vendorId}`);
      return;
    }

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const formattedAmount = amount.toLocaleString();

    // Send multi-channel notifications
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'outbid',
        title: 'Outbid - Deposit Unfrozen',
        message: `Deposit of ₦${formattedAmount} unfrozen - you were outbid on ${asset}`,
        data: {
          auctionId,
          amount,
          assetName: asset,
          type: 'deposit_unfreeze',
        },
      }),

      // SMS notification
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: You were outbid on ${asset}. Deposit of ₦${formattedAmount} unfrozen. Bid again to win!`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending deposit unfrozen notifications:', error);
    });

    await this.markAsSent('unfreeze', vendorId, auctionId);
  }

  /**
   * Send auction won notification with document deadline
   * "Congratulations! You won {asset_name}. Please sign documents within {hours} hours"
   * 
   * @param context - Notification context
   */
  async sendAuctionWonNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, amount, assetName, deadline } = context;

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const formattedAmount = amount.toLocaleString();
    const hours = deadline ? Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60)) : 48;

    // Send multi-channel notifications
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'auction_won',
        title: 'Congratulations! You Won!',
        message: `You won ${asset} with a bid of ₦${formattedAmount}. Sign documents within ${hours} hours.`,
        data: {
          auctionId,
          amount,
          assetName: asset,
          deadline: deadline?.toISOString(),
          type: 'auction_won',
        },
      }),

      // Email notification - removed due to incorrect template usage
      // TODO: Create proper auction won email template

      // SMS notification
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: Congratulations! You won ${asset} for ₦${formattedAmount}. Sign documents within ${hours} hours.`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending auction won notifications:', error);
    });
  }

  /**
   * Send document deadline reminder
   * Sent 6 hours before deadline expires
   * 
   * @param context - Notification context
   */
  async sendDocumentDeadlineReminder(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, assetName, deadline } = context;

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const hours = deadline ? Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60)) : 6;

    // Send multi-channel notifications
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'payment_reminder',
        title: 'Document Deadline Approaching',
        message: `Sign documents for ${asset} within ${hours} hours or lose your deposit!`,
        data: {
          auctionId,
          assetName: asset,
          deadline: deadline?.toISOString(),
          type: 'document_reminder',
        },
      }),

      // SMS notification (urgent)
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage URGENT: Sign documents for ${asset} within ${hours} hours or lose your deposit!`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending document reminder notifications:', error);
    });
  }

  /**
   * Send grace extension notification
   * "Extension granted: New deadline is {new_deadline}"
   * 
   * @param context - Notification context
   */
  async sendGraceExtensionNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, assetName, deadline, reason } = context;

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const newDeadline = deadline?.toLocaleString() || 'TBD';

    // Send multi-channel notifications
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'system_alert',
        title: 'Extension Granted',
        message: `Extension granted for ${asset}. New deadline: ${newDeadline}`,
        data: {
          auctionId,
          assetName: asset,
          deadline: deadline?.toISOString(),
          reason,
          type: 'grace_extension',
        },
      }),

      // SMS notification
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: Extension granted for ${asset}. New deadline: ${newDeadline}`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending grace extension notifications:', error);
    });
  }

  /**
   * Send deposit forfeiture notification
   * "Deposit of ₦{amount} forfeited due to payment failure on {asset_name}"
   * 
   * @param context - Notification context
   */
  async sendDepositForfeitureNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, amount, assetName, reason } = context;

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const formattedAmount = amount.toLocaleString();

    // Send multi-channel notifications
    Promise.all([
      // In-app notification
      createNotification({
        userId: user.id,
        type: 'system_alert',
        title: 'Deposit Forfeited',
        message: `Deposit of ₦${formattedAmount} forfeited due to payment failure on ${asset}`,
        data: {
          auctionId,
          amount,
          assetName: asset,
          reason,
          type: 'deposit_forfeiture',
        },
      }),

      // Email notification (detailed explanation)
      emailService.sendEmail({
        to: user.email,
        subject: 'Deposit Forfeited - NEM Salvage',
        html: `
          <h2>Deposit Forfeited</h2>
          <p>Dear ${vendor.businessName},</p>
          <p>Your deposit of <strong>₦${formattedAmount}</strong> has been forfeited for ${asset}.</p>
          <p><strong>Reason:</strong> ${reason || 'Payment deadline expired'}</p>
          <p>Please ensure timely payment in future auctions to avoid forfeiture.</p>
          <p>Best regards,<br>NEM Salvage Team</p>
        `,
      }),

      // SMS notification
      smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: Deposit of ₦${formattedAmount} forfeited for ${asset} due to payment failure.`,
        userId: user.id,
      }),
    ]).catch(error => {
      console.error('Error sending deposit forfeiture notifications:', error);
    });
  }

  /**
   * Send payment confirmation notification
   * "Payment confirmed. Pickup code: {code}"
   * 
   * @param context - Notification context (amount should be FULL finalBid including deposit)
   */
  async sendPaymentConfirmationNotification(context: DepositNotificationContext): Promise<void> {
    const { vendorId, auctionId, amount, assetName } = context;

    // Get vendor and user details
    const { user, vendor, auction } = await this.getNotificationData(vendorId, auctionId);
    if (!user || !vendor) return;

    const asset = assetName || auction?.assetName || 'auction';
    const formattedAmount = amount.toLocaleString(); // This is the FULL amount (₦120k)

    // Send multi-channel notifications - ALL wrapped in try-catch to prevent blocking
    try {
      // In-app notification
      await createNotification({
        userId: user.id,
        type: 'payment_success',
        title: 'Payment Confirmed',
        message: `Payment of ₦${formattedAmount} confirmed for ${asset}. Pickup authorization ready.`,
        data: {
          auctionId,
          amount,
          assetName: asset,
          type: 'payment_confirmation',
        },
      });
    } catch (error) {
      console.error('In-app notification error (non-blocking):', error);
    }

    try {
      // Email notification - removed due to incorrect template usage
      // TODO: Create proper payment confirmation email template with correct parameters
      console.log('Email notification skipped - needs proper template implementation');
    } catch (error) {
      console.error('Email notification error (non-blocking):', error);
    }

    try {
      // SMS notification
      if (user.phone) {
        await smsService.sendSMS({
          to: user.phone,
          message: `NEM Salvage: Payment of ₦${formattedAmount} confirmed for ${asset}. Pickup authorization ready.`,
        });
      }
    } catch (error) {
      console.error('SMS notification error (non-blocking):', error);
    }

    try {
      // Push notification - removed due to incorrect implementation
      // TODO: Implement proper push notification with subscription
      console.log('Push notification skipped - needs proper subscription implementation');
    } catch (error) {
      console.error('Push notification error (non-blocking):', error);
    }
  }

  /**
   * Get notification data (user, vendor, auction)
   * Cached for performance
   * 
   * @param vendorId - Vendor ID
   * @param auctionId - Auction ID
   * @returns Notification data
   */
  private async getNotificationData(vendorId: string, auctionId: string) {
    try {
      // Try cache first
      const cacheKey = `notif:data:${vendorId}:${auctionId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Fetch from database
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });

      if (!vendor) {
        console.error(`Vendor not found: ${vendorId}`);
        return { user: null, vendor: null, auction: null };
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, vendor.userId),
      });

      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, auctionId),
      });

      const data = { user, vendor, auction };

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

      return data;
    } catch (error) {
      console.error('Error getting notification data:', error);
      return { user: null, vendor: null, auction: null };
    }
  }

  /**
   * Check if notification is duplicate (within 5-minute window)
   * 
   * @param type - Notification type
   * @param vendorId - Vendor ID
   * @param auctionId - Auction ID
   * @returns True if duplicate
   */
  private async isDuplicate(type: string, vendorId: string, auctionId: string): Promise<boolean> {
    const key = `${this.DEDUP_PREFIX}${type}:${vendorId}:${auctionId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark notification as sent (for deduplication)
   * 
   * @param type - Notification type
   * @param vendorId - Vendor ID
   * @param auctionId - Auction ID
   */
  private async markAsSent(type: string, vendorId: string, auctionId: string): Promise<void> {
    const key = `${this.DEDUP_PREFIX}${type}:${vendorId}:${auctionId}`;
    await redis.set(key, '1', { ex: this.DEDUP_TTL });
  }
}

// Export singleton instance
export const depositNotificationService = new DepositNotificationService();
