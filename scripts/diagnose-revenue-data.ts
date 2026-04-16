/**
 * Diagnose Revenue Data
 * 
 * Check if there's actual data in the database for revenue reports
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function diagnoseRevenueData() {
  console.log('🔍 Diagnosing Revenue Data...\n');

  try {
    // Check total cases
    const totalCases = await db
      .select({ count: sql<number>`count(*)` })
      .from(salvageCases);
    console.log(`📊 Total Cases: ${totalCases[0]?.count || 0}`);

    // Check sold cases
    const soldCases = await db
      .select({ count: sql<number>`count(*)` })
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'));
    console.log(`✅ Sold Cases: ${soldCases[0]?.count || 0}`);

    // Check cases by status
    const casesByStatus = await db
      .select({
        status: salvageCases.status,
        count: sql<number>`count(*)`,
      })
      .from(salvageCases)
      .groupBy(salvageCases.status);
    console.log('\n📈 Cases by Status:');
    casesByStatus.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Check cases by asset type
    const casesByAssetType = await db
      .select({
        assetType: salvageCases.assetType,
        count: sql<number>`count(*)`,
      })
      .from(salvageCases)
      .groupBy(salvageCases.assetType);
    console.log('\n🚗 Cases by Asset Type:');
    casesByAssetType.forEach(row => {
      console.log(`  ${row.assetType}: ${row.count}`);
    });

    // Check auctions
    const totalAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctions);
    console.log(`\n🔨 Total Auctions: ${totalAuctions[0]?.count || 0}`);

    // Check payments
    const totalPayments = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments);
    console.log(`💰 Total Payments: ${totalPayments[0]?.count || 0}`);

    // Check completed payments
    const verifiedPayments = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.status, 'verified'));
    console.log(`✅ Verified Payments: ${verifiedPayments[0]?.count || 0}`);

    // Sample sold cases
    console.log('\n📋 Sample Sold Cases:');
    const sampleData = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'))
      .limit(5);

    if (sampleData.length === 0) {
      console.log('  ⚠️  No sold cases found!');
      console.log('\n💡 Suggestion: The database may not have any sold cases yet.');
      console.log('   Revenue reports require cases with status="sold" and associated payments.');
    } else {
      sampleData.forEach((row, i) => {
        console.log(`\n  Case ${i + 1}:`);
        console.log(`    Claim Ref: ${row.claimReference}`);
        console.log(`    Asset Type: ${row.assetType}`);
        console.log(`    Market Value: ₦${row.marketValue}`);
        console.log(`    Region: ${row.region || 'Unknown'}`);
      });
    }

    // Check if region data exists
    const casesWithRegion = await db
      .select({ count: sql<number>`count(*)` })
      .from(salvageCases)
      .where(sql`${salvageCases.region} IS NOT NULL AND ${salvageCases.region} != ''`);
    console.log(`\n🗺️  Cases with Region Data: ${casesWithRegion[0]?.count || 0}`);

    console.log('\n✅ Diagnosis Complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnoseRevenueData();
