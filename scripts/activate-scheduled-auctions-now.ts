/**
 * Manual Script to Activate Scheduled Auctions
 * 
 * This script manually activates any scheduled auctions that should have started by now.
 * Run this if auctions are stuck in "scheduled" status past their scheduled time.
 * 
 * Usage:
 * npx tsx scripts/activate-scheduled-auctions-now.ts
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, lte, arrayContains } from 'drizzle-orm';

async function activateScheduledAuctions() {
  try {
    const now = new Date();
    console.log(`\n🔍 Checking for scheduled auctions at ${now.toISOString()}\n`);

    // Find scheduled auctions that should start now
    const scheduledAuctions = await db
      .select({
        auction: auctions,
        case: salvageCases,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.isScheduled, true),
          eq(auctions.status, 'scheduled'),
          lte(auctions.scheduledStartTime, now)
        )
      );

    if (scheduledAuctions.length === 0) {
      console.log('✅ No scheduled auctions found that need activation.');
      return;
    }

    console.log(`📋 Found ${scheduledAuctions.length} auction(s) to activate:\n`);

    for (const { auction, case: caseRecord } of scheduledAuctions) {
      console.log(`  - Auction ID: ${auction.id}`);
      console.log(`    Case: ${caseRecord.claimReference}`);
      console.log(`    Asset: ${caseRecord.assetType}`);
      console.log(`    Scheduled for: ${auction.scheduledStartTime?.toISOString()}`);
      console.log(`    Current time: ${now.toISOString()}`);
      console.log('');
    }

    console.log('🚀 Activating auctions...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const { auction, case: caseRecord } of scheduledAuctions) {
      try {
        console.log(`⏳ Activating auction ${auction.id}...`);

        // Update auction status
        await db
          .update(auctions)
          .set({
            status: 'active',
            isScheduled: false,
            startTime: now,
            updatedAt: now,
          })
          .where(eq(auctions.id, auction.id));

        // Update case status
        await db
          .update(salvageCases)
          .set({
            status: 'active_auction',
            updatedAt: now,
          })
          .where(eq(salvageCases.id, caseRecord.id));

        console.log(`✅ Activated auction ${auction.id} for case ${caseRecord.claimReference}`);
        successCount++;

        // Find matching vendors
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

        // Filter out test vendors
        const realVendors = matchingVendors.filter(vendor => {
          const isTestEmail = vendor.email.endsWith('@test.com') || vendor.email.endsWith('@example.com');
          return !isTestEmail;
        });

        console.log(`   📧 Found ${realVendors.length} matching vendors to notify`);
        console.log('');
      } catch (error) {
        console.error(`❌ Error activating auction ${auction.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully activated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📋 Total processed: ${scheduledAuctions.length}`);
    console.log('');
    console.log('✨ Done! Auctions should now appear as "active" in the UI.');
    console.log('');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
activateScheduledAuctions()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
