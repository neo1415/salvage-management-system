/**
 * Script: Update Vendor Ratings
 * 
 * Manually trigger vendor rating recalculation for all vendors.
 * 
 * Usage:
 * ```bash
 * npx tsx scripts/update-vendor-ratings.ts
 * ```
 */

import { updateAllVendorRatings, calculateAutoRating } from '@/features/vendors/services/auto-rating.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('🔄 Starting vendor rating update...\n');

  try {
    // Get all vendors first to show before/after
    const allVendors = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        rating: vendors.rating,
        performanceStats: vendors.performanceStats,
      })
      .from(vendors);

    console.log(`Found ${allVendors.length} vendors\n`);

    // Show current ratings
    console.log('📊 Current Ratings:');
    console.log('─'.repeat(80));
    for (const vendor of allVendors) {
      const name = vendor.businessName || 'Unnamed Vendor';
      const stats = vendor.performanceStats as any;
      console.log(`${name.padEnd(30)} | Rating: ${vendor.rating} | Bids: ${stats.totalBids} | Wins: ${stats.totalWins} | Win Rate: ${stats.winRate}%`);
    }
    console.log('─'.repeat(80));
    console.log('');

    // Update all ratings
    const result = await updateAllVendorRatings();

    console.log(`\n✅ Update complete: ${result.updated} updated, ${result.errors} errors\n`);

    // Show new ratings
    const updatedVendors = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        rating: vendors.rating,
        performanceStats: vendors.performanceStats,
      })
      .from(vendors);

    console.log('📊 New Ratings:');
    console.log('─'.repeat(80));
    for (const vendor of updatedVendors) {
      const name = vendor.businessName || 'Unnamed Vendor';
      const stats = vendor.performanceStats as any;
      const oldRating = allVendors.find(v => v.id === vendor.id)?.rating || '0.00';
      const change = (parseFloat(vendor.rating) - parseFloat(oldRating)).toFixed(2);
      const changeStr = change === '0.00' ? '' : ` (${change > '0' ? '+' : ''}${change})`;
      console.log(`${name.padEnd(30)} | Rating: ${vendor.rating}${changeStr} | Bids: ${stats.totalBids} | Wins: ${stats.totalWins} | Win Rate: ${stats.winRate}%`);
    }
    console.log('─'.repeat(80));

    console.log('\n✨ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
