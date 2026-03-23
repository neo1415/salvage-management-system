/**
 * Fraud Auto-Suspend Cron Job
 * Automatically suspends vendors with 3+ confirmed fraud flags
 * 
 * Requirements:
 * - Requirement 36: Auto-Suspend Repeat Offenders
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 * 
 * Schedule: Every hour (0 * * * *)
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { users } from '@/lib/db/schema/users';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

/**
 * Fraud auto-suspend result
 */
export interface FraudAutoSuspendResult {
  vendorsSuspended: number;
  bidsCancelled: number;
  notificationsSent: number;
  errors: string[];
}

/**
 * Fraud Auto-Suspend Service
 * Identifies and suspends vendors with 3+ fraud flags
 */
export class FraudAutoSuspendService {
  /**
   * Run fraud auto-suspend check
   * 
   * Requirements:
   * - 36.1: Check for vendors with 3+ confirmed fraud flags
   * - 36.1: Auto-suspend account for 30 days
   * - 36.2: Cancel all active bids
   * - 36.3: Send SMS + Email notification
   * - 36.4: Allow Admin to review and reinstate
   * - 36.5: Create audit log entry
   * 
   * @returns Fraud auto-suspend result
   */
  async run(): Promise<FraudAutoSuspendResult> {
    const result: FraudAutoSuspendResult = {
      vendorsSuspended: 0,
      bidsCancelled: 0,
      notificationsSent: 0,
      errors: [],
    };

    try {
      console.log('🔍 Starting fraud auto-suspend check...');

      // Step 1: Identify vendors with 3+ fraud flags who are not already suspended
      const repeatOffenders = await this.identifyRepeatOffenders();

      if (repeatOffenders.length === 0) {
        console.log('✅ No repeat offenders found');
        return result;
      }

      console.log(`🚨 Found ${repeatOffenders.length} repeat offenders to suspend`);

      // Step 2: Process each repeat offender
      for (const vendor of repeatOffenders) {
        try {
          // Suspend the vendor
          await this.suspendVendor(vendor.id, vendor.performanceStats.fraudFlags);
          result.vendorsSuspended++;

          // Cancel all active bids
          const cancelledBids = await this.cancelActiveBids(vendor.id);
          result.bidsCancelled += cancelledBids;

          // Send notifications
          const notificationsSent = await this.sendNotifications(vendor);
          result.notificationsSent += notificationsSent;

          console.log(`✅ Suspended vendor ${vendor.id} (${vendor.performanceStats.fraudFlags} fraud flags)`);
        } catch (error) {
          const errorMessage = `Failed to suspend vendor ${vendor.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
        }
      }

      console.log(`✅ Fraud auto-suspend complete: ${result.vendorsSuspended} vendors suspended, ${result.bidsCancelled} bids cancelled`);

      return result;
    } catch (error) {
      const errorMessage = `Fraud auto-suspend failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Identify vendors with 3+ fraud flags who are not already suspended
   * 
   * Requirement 36.1: Check for vendors with 3+ confirmed fraud flags
   * 
   * @returns List of repeat offenders
   */
  private async identifyRepeatOffenders(): Promise<typeof vendors.$inferSelect[]> {
    try {
      // Query vendors with status 'approved' and 3+ fraud flags
      // We use raw SQL for the JSONB query since Drizzle doesn't have great JSONB support yet
      const repeatOffenders = await db.execute<typeof vendors.$inferSelect>(sql`
        SELECT * FROM ${vendors}
        WHERE ${vendors.status} = 'approved'
        AND (${vendors.performanceStats}->>'fraudFlags')::int >= 3
      `);

      return Array.from(repeatOffenders);
    } catch (error) {
      console.error('Failed to identify repeat offenders:', error);
      return [];
    }
  }

  /**
   * Suspend vendor account for 30 days
   * 
   * Requirements:
   * - 36.1: Auto-suspend account for 30 days
   * - 36.5: Create audit log entry
   * 
   * @param vendorId - Vendor ID
   * @param fraudFlagCount - Number of fraud flags
   */
  private async suspendVendor(vendorId: string, fraudFlagCount: number): Promise<void> {
    try {
      // Calculate suspension end date (30 days from now)
      const suspensionEndDate = new Date();
      suspensionEndDate.setDate(suspensionEndDate.getDate() + 30);

      // Update vendor status to 'suspended'
      await db
        .update(vendors)
        .set({
          status: 'suspended',
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendorId));

      // Get vendor details for audit log
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, vendorId),
      });

      if (!vendor) {
        throw new Error(`Vendor ${vendorId} not found`);
      }

      // Create audit log entry
      await logAction({
        userId: vendor.userId,
        actionType: AuditActionType.VENDOR_SUSPENDED,
        entityType: AuditEntityType.VENDOR,
        entityId: vendorId,
        ipAddress: '0.0.0.0', // System action
        deviceType: DeviceType.DESKTOP,
        userAgent: 'System/Cron',
        afterState: {
          status: 'suspended',
          reason: 'Auto-suspended: 3+ fraud flags',
          fraudFlagCount,
          suspensionEndDate: suspensionEndDate.toISOString(),
          suspensionDays: 30,
        },
      });

      console.log(`✅ Vendor ${vendorId} suspended until ${suspensionEndDate.toISOString()}`);
    } catch (error) {
      console.error(`Failed to suspend vendor ${vendorId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel all active bids for suspended vendor
   * 
   * Requirement 36.2: Cancel all active bids
   * 
   * @param vendorId - Vendor ID
   * @returns Number of bids cancelled
   */
  private async cancelActiveBids(vendorId: string): Promise<number> {
    try {
      // Find all active auctions where this vendor is the current bidder
      const activeAuctions = await db.query.auctions.findMany({
        where: and(
          eq(auctions.currentBidder, vendorId),
          eq(auctions.status, 'active')
        ),
      });

      let bidsCancelled = 0;

      for (const auction of activeAuctions) {
        try {
          // Find the previous highest bid from a different vendor
          const previousBids = await db.query.bids.findMany({
            where: and(
              eq(bids.auctionId, auction.id),
              sql`${bids.vendorId} != ${vendorId}`
            ),
            orderBy: (bids, { desc }) => [desc(bids.amount)],
            limit: 1,
          });

          if (previousBids.length > 0) {
            const previousBid = previousBids[0];

            // Reset auction to previous highest bid
            await db
              .update(auctions)
              .set({
                currentBid: previousBid.amount,
                currentBidder: previousBid.vendorId,
                updatedAt: new Date(),
              })
              .where(eq(auctions.id, auction.id));

            console.log(`✅ Reset auction ${auction.id} to previous bidder ${previousBid.vendorId}`);
          } else {
            // No other bids, reset to reserve price
            await db
              .update(auctions)
              .set({
                currentBid: null,
                currentBidder: null,
                updatedAt: new Date(),
              })
              .where(eq(auctions.id, auction.id));

            console.log(`✅ Reset auction ${auction.id} to reserve price (no other bids)`);
          }

          bidsCancelled++;

          // Create audit log entry for bid cancellation
          await logAction({
            userId: 'system',
            actionType: AuditActionType.BID_CANCELLED,
            entityType: AuditEntityType.BID,
            entityId: auction.id,
            ipAddress: '0.0.0.0',
            deviceType: DeviceType.DESKTOP,
            userAgent: 'System/Cron',
            afterState: {
              auctionId: auction.id,
              vendorId,
              reason: 'Vendor auto-suspended for fraud',
            },
          });
        } catch (error) {
          console.error(`Failed to cancel bid for auction ${auction.id}:`, error);
        }
      }

      return bidsCancelled;
    } catch (error) {
      console.error(`Failed to cancel active bids for vendor ${vendorId}:`, error);
      return 0;
    }
  }

  /**
   * Send SMS and email notifications to suspended vendor
   * 
   * Requirement 36.3: Send SMS + Email notification
   * 
   * @param vendor - Vendor record
   * @returns Number of notifications sent
   */
  private async sendNotifications(vendor: typeof vendors.$inferSelect): Promise<number> {
    let notificationsSent = 0;

    try {
      // Get user details for phone and email
      const user = await db.query.users.findFirst({
        where: eq(users.id, vendor.userId),
      });

      if (!user) {
        console.error(`User ${vendor.userId} not found for vendor ${vendor.id}`);
        return 0;
      }

      const suspensionEndDate = new Date();
      suspensionEndDate.setDate(suspensionEndDate.getDate() + 30);

      // Send SMS notification
      try {
        await smsService.sendSMS({
          to: user.phone,
          message: `Your account has been suspended due to suspicious activity (${vendor.performanceStats.fraudFlags} fraud flags). Contact support@nem-insurance.com if you believe this is an error. Suspension ends: ${suspensionEndDate.toLocaleDateString('en-NG')}`,
        });
        notificationsSent++;
        console.log(`✅ SMS sent to ${user.phone}`);
      } catch (error) {
        console.error(`Failed to send SMS to ${user.phone}:`, error);
      }

      // Send email notification
      try {
        await emailService.sendEmail({
          to: user.email,
          subject: '⚠️ Account Suspended - Suspicious Activity Detected',
          html: `
            <h2>Account Suspension Notice</h2>
            <p>Dear ${user.fullName},</p>
            
            <p>Your account has been automatically suspended due to suspicious activity detected on our platform.</p>
            
            <h3>Suspension Details:</h3>
            <ul>
              <li><strong>Reason:</strong> Multiple fraud flags (${vendor.performanceStats.fraudFlags} confirmed)</li>
              <li><strong>Suspension Period:</strong> 30 days</li>
              <li><strong>Suspension End Date:</strong> ${suspensionEndDate.toLocaleDateString('en-NG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</li>
            </ul>
            
            <h3>What This Means:</h3>
            <ul>
              <li>Your account access has been temporarily restricted</li>
              <li>All active bids have been cancelled</li>
              <li>You cannot place new bids during the suspension period</li>
            </ul>
            
            <h3>Appeal Process:</h3>
            <p>If you believe this suspension is an error, please contact our support team:</p>
            <ul>
              <li><strong>Email:</strong> support@nem-insurance.com</li>
              <li><strong>Phone:</strong> 234-02-014489560</li>
            </ul>
            
            <p>Our admin team will review your case and may reinstate your account if the fraud flags are determined to be false positives.</p>
            
            <p><em>This is an automated message. Please do not reply to this email.</em></p>
            
            <hr>
            <p style="font-size: 12px; color: #666;">
              NEM Insurance Plc<br>
              199 Ikorodu Road, Obanikoro, Lagos<br>
              Phone: 234-02-014489560
            </p>
          `,
        });
        notificationsSent++;
        console.log(`✅ Email sent to ${user.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
      }

      return notificationsSent;
    } catch (error) {
      console.error(`Failed to send notifications for vendor ${vendor.id}:`, error);
      return notificationsSent;
    }
  }
}

// Export singleton instance
export const fraudAutoSuspendService = new FraudAutoSuspendService();
