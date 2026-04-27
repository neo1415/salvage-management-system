/**
 * Pickup Reminder Notifications Cron Job
 * 
 * Sends reminder SMS 24 hours before pickup deadline
 * Pickup deadline is 48 hours from payment verification
 * Only sends reminders for vendors who haven't confirmed pickup yet
 * 
 * Validates: Task 6.3 - Implement pickup reminder notifications
 * Schedule: Every hour (0 * * * *)
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, lte, gte, isNull } from 'drizzle-orm';
import { smsService } from '@/features/notifications/services/sms.service';

export interface PickupReminderResults {
  remindersSent: number;
  errors: string[];
}

/**
 * Send pickup reminder notifications
 * Checks for payments verified ~24 hours ago (23-25 hours window)
 * Only sends to vendors who haven't confirmed pickup
 */
export async function sendPickupReminders(): Promise<PickupReminderResults> {
  const now = new Date();
  const results: PickupReminderResults = {
    remindersSent: 0,
    errors: [],
  };

  try {
    // Get document validity period from config (default 48 hours)
    const { configService } = await import('@/features/auction-deposit/services/config.service');
    const config = await configService.getConfig();
    const documentValidityHours = config.documentValidityPeriod;
    
    // Calculate time window: remind at halfway point (e.g., 24 hours for 48-hour deadline)
    // Use a 2-hour window to catch payments (e.g., 23-25 hours ago for 48-hour deadline)
    const reminderHours = documentValidityHours / 2;
    const windowStart = new Date(now.getTime() - (reminderHours + 1) * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() - (reminderHours - 1) * 60 * 60 * 1000);

    // Find verified payments that need reminders
    const paymentsNeedingReminders = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(payments.status, 'verified'),
          gte(payments.verifiedAt, windowStart),
          lte(payments.verifiedAt, windowEnd),
          // Only send to vendors who haven't confirmed pickup
          eq(auctions.pickupConfirmedVendor, false)
        )
      );

    for (const { payment, auction, vendor: _vendor, user, case: salvageCase } of paymentsNeedingReminders) {
      try {
        // Calculate pickup deadline (documentValidityHours from verification)
        const pickupDeadline = new Date(
          (payment.verifiedAt?.getTime() || now.getTime()) + documentValidityHours * 60 * 60 * 1000
        );
        const deadlineFormatted = pickupDeadline.toLocaleDateString('en-NG', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        // Get pickup authorization code from payment reference or generate placeholder
        const pickupAuthCode = payment.paymentReference || 'AUTH-PENDING';

        // Get pickup location
        const pickupLocation = salvageCase.locationName || 'NEM Insurance Salvage Yard';

        // Send reminder SMS
        await smsService.sendSMS({
          to: user.phone,
          message: `Reminder: Collect your item by ${deadlineFormatted} using code ${pickupAuthCode}. Location: ${pickupLocation}`,
          userId: user.id,
        });

        results.remindersSent++;
        console.log(`✅ Sent pickup reminder to ${user.phone} for auction ${auction.id}`);
      } catch (error) {
        console.error(`Error sending reminder for payment ${payment.id}:`, error);
        results.errors.push(
          `Reminder failed for payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log(`Pickup reminder job completed: ${results.remindersSent} reminders sent, ${results.errors.length} errors`);
    return results;
  } catch (error) {
    console.error('Error in sendPickupReminders:', error);
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return results;
  }
}
