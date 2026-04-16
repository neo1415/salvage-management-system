/**
 * Script to fix auction scheduling issues and activate past scheduled auctions
 * 
 * Fixes:
 * 1. Activates scheduled auctions that have passed their start time
 * 2. Notifies vendors for newly activated auctions
 */

import { db } from '../src/lib/db/drizzle';
import { auctions } from '../src/lib/db/schema/auctions';
import { salvageCases } from '../src/lib/db/schema/cases';
import { vendors } from '../src/lib/db/schema/vendors';
import { users } from '../src/lib/db/schema/users';
import { eq, and, lte, arrayContains } from 'drizzle-orm';
import { smsService } from '../src/features/notifications/services/sms.service';
import { emailService } from '../src/features/notifications/services/email.service';

async function activatePastScheduledAuctions() {
  console.log('🔍 Checking for scheduled auctions that should be active...\n');

  const now = new Date();
  console.log(`Current time: ${now.toISOString()}\n`);

  try {
    // Find scheduled auctions where scheduledStartTime has passed
    const scheduledAuctions = await db
      .select({
        auction: auctions,
        case: salvageCases,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.status, 'scheduled'),
          lte(auctions.scheduledStartTime, now)
        )
      );

    if (scheduledAuctions.length === 0) {
      console.log('✅ No scheduled auctions found that need activation.\n');
      return;
    }

    console.log(`📋 Found ${scheduledAuctions.length} auction(s) to activate:\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const { auction, case: caseRecord } of scheduledAuctions) {
      try {
        console.log(`\n🔄 Processing auction ${auction.id}...`);
        console.log(`   Case: ${caseRecord.claimReference}`);
        console.log(`   Asset: ${caseRecord.assetType}`);
        console.log(`   Scheduled start: ${auction.scheduledStartTime?.toISOString()}`);
        console.log(`   Current status: ${auction.status}`);

        // Update auction status to active
        await db
          .update(auctions)
          .set({
            status: 'active',
            updatedAt: now,
          })
          .where(eq(auctions.id, auction.id));

        console.log(`   ✅ Updated auction status to 'active'`);

        // Update case status to active_auction
        await db
          .update(salvageCases)
          .set({
            status: 'active_auction',
            updatedAt: now,
          })
          .where(eq(salvageCases.id, caseRecord.id));

        console.log(`   ✅ Updated case status to 'active_auction'`);

        // Notify matching vendors
        const assetType = caseRecord.assetType;
        const matchingVendors = await db
          .select({
            vendorId: vendors.id,
            userId: vendors.userId,
            phone: users.phone,
            email: users.email,
            fullName: users.fullName,
          })
          .from(vendors)
          .innerJoin(users, eq(vendors.userId, users.id))
          .where(
            and(
              eq(vendors.status, 'approved'),
              arrayContains(vendors.categories, [assetType])
            )
          );

        console.log(`   📧 Found ${matchingVendors.length} matching vendors`);

        // Filter out test vendors
        const realVendors = matchingVendors.filter(vendor => {
          const isTestEmail = vendor.email.endsWith('@test.com') || vendor.email.endsWith('@example.com');
          return !isTestEmail;
        });

        console.log(`   📧 Notifying ${realVendors.length} real vendors (${matchingVendors.length - realVendors.length} test vendors skipped)`);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
        let notifiedCount = 0;

        for (const vendor of realVendors) {
          try {
            // Send SMS
            const smsMessage = `Auction now live! ${assetType.toUpperCase()} - Reserve: ₦${caseRecord.reservePrice}. Bid now: ${appUrl}/vendor/auctions/${auction.id}`;
            await smsService.sendSMS({
              to: vendor.phone,
              message: smsMessage,
            });

            // Send email
            await emailService.sendAuctionStartEmail(vendor.email, {
              vendorName: vendor.fullName,
              auctionId: auction.id,
              assetType: assetType,
              assetName: `${assetType.toUpperCase()} - ${caseRecord.claimReference}`,
              reservePrice: parseFloat(caseRecord.reservePrice),
              startTime: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
              endTime: auction.endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
              location: caseRecord.locationName,
              appUrl: appUrl,
            });

            notifiedCount++;
          } catch (error) {
            console.error(`   ⚠️  Failed to notify vendor ${vendor.vendorId}:`, error);
          }
        }

        console.log(`   ✅ Notified ${notifiedCount} vendors`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error processing auction ${auction.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully activated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📋 Total processed: ${scheduledAuctions.length}\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the script
activatePastScheduledAuctions()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
