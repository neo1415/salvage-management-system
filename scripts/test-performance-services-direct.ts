/**
 * Test Performance Report Services Directly
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { AuctionPerformanceService, VendorPerformanceService } from '../src/features/reports/operational/services';
import { MyPerformanceService } from '../src/features/reports/user-performance/services';

async function testServices() {
  console.log('=== Testing Performance Report Services ===\n');

  const filters = {
    startDate: '2026-03-16',
    endDate: '2026-04-15',
  };

  try {
    // 1. Vendor Performance
    console.log('1. VENDOR PERFORMANCE');
    const vendorReport = await VendorPerformanceService.generateReport(filters);
    console.log('Summary:', vendorReport.summary);
    console.log(`Rankings count: ${vendorReport.rankings.length}`);
    if (vendorReport.rankings.length > 0) {
      console.log('Top 3 vendors:');
      console.table(vendorReport.rankings.slice(0, 3));
    } else {
      console.log('❌ NO VENDOR RANKINGS');
    }

    // 2. Auction Performance
    console.log('\n2. AUCTION PERFORMANCE');
    const auctionReport = await AuctionPerformanceService.generateReport(filters);
    console.log('Summary:', auctionReport.summary);
    console.log('By Status:');
    console.table(auctionReport.byStatus);
    console.log('Bidding:', auctionReport.bidding);

    // 3. My Performance (need a user ID)
    console.log('\n3. MY PERFORMANCE');
    // Get a sample user ID from the database using raw SQL to avoid Drizzle bug
    const { sql } = await import('drizzle-orm');
    const userResult = await db.execute(
      sql`SELECT id, full_name as name, role FROM users WHERE role = 'claims_adjuster' LIMIT 1`
    );

    // Drizzle execute returns an array directly, not { rows: [] }
    if (userResult && userResult.length > 0) {
      const sampleUser = userResult[0] as any;
      console.log(`Testing with user: ${sampleUser.name} (${sampleUser.role})`);
      const myReport = await MyPerformanceService.generateReport(filters, sampleUser.id);
      console.log('My Performance:', myReport);
    } else {
      console.log('❌ NO CLAIMS ADJUSTER FOUND');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

testServices()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
