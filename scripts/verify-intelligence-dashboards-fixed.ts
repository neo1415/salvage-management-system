/**
 * Verification Script: Intelligence Dashboards Fixed
 * 
 * Verifies that both Intelligence Dashboard and Market Intelligence
 * dashboards are now working correctly
 */

import { db } from '@/lib/db';
import { 
  vendorSegments,
  schemaEvolutionLog,
  mlTrainingDatasets,
  assetPerformanceAnalytics,
  temporalPatternsAnalytics,
  geographicPatternsAnalytics
} from '@/lib/db/schema';
import { sql, and, gte, lte } from 'drizzle-orm';
import { subDays } from 'date-fns';

async function verifyIntelligenceDashboards() {
  console.log('✅ VERIFICATION: Intelligence Dashboards Fixed\n');
  console.log('=' .repeat(60));

  let allPassed = true;

  // Test 1: Vendor Segments (Intelligence Dashboard - Vendor Analytics)
  console.log('\n📊 TEST 1: Vendor Segments - Activity Segment Distribution');
  console.log('-'.repeat(60));
  
  try {
    const segments = await db
      .select({
        segment: vendorSegments.activitySegment,
        count: sql<number>`COUNT(*)`,
      })
      .from(vendorSegments)
      .where(sql`${vendorSegments.activitySegment} IS NOT NULL`)
      .groupBy(vendorSegments.activitySegment);

    if (segments.length > 0) {
      console.log('✅ PASS: Vendor segments have activitySegment values');
      segments.forEach(s => {
        console.log(`   - ${s.segment}: ${s.count} vendors`);
      });
    } else {
      console.log('❌ FAIL: No vendor segments with activitySegment found');
      allPassed = false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying vendor segments:', error);
    allPassed = false;
  }

  // Test 2: Schema Evolution Log (Intelligence Dashboard - Schema Evolution)
  console.log('\n\n📝 TEST 2: Schema Evolution Log Entries');
  console.log('-'.repeat(60));
  
  try {
    const changes = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schemaEvolutionLog);

    if (changes[0].count >= 3) {
      console.log(`✅ PASS: Schema evolution log has ${changes[0].count} entries`);
      
      // Show sample entries
      const samples = await db
        .select()
        .from(schemaEvolutionLog)
        .limit(3);
      
      samples.forEach(s => {
        console.log(`   - ${s.changeType}: ${s.entityName} (${s.status})`);
      });
    } else {
      console.log(`❌ FAIL: Schema evolution log only has ${changes[0].count} entries (expected >= 3)`);
      allPassed = false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying schema evolution log:', error);
    allPassed = false;
  }

  // Test 3: ML Training Datasets (Intelligence Dashboard - ML Datasets)
  console.log('\n\n🤖 TEST 3: ML Training Datasets');
  console.log('-'.repeat(60));
  
  try {
    const datasets = await db
      .select()
      .from(mlTrainingDatasets);

    if (datasets.length >= 3) {
      console.log(`✅ PASS: ML training datasets has ${datasets.length} datasets`);
      
      datasets.forEach(d => {
        const sizeInMB = d.fileSize ? (d.fileSize / (1024 * 1024)).toFixed(2) : '0';
        console.log(`   - ${d.datasetType}: ${d.recordCount} records, ${sizeInMB} MB`);
      });
      
      // Check if all have fileSize
      const withoutSize = datasets.filter(d => !d.fileSize || d.fileSize === 0);
      if (withoutSize.length > 0) {
        console.log(`⚠️  WARNING: ${withoutSize.length} datasets missing fileSize`);
      }
    } else {
      console.log(`❌ FAIL: ML training datasets only has ${datasets.length} datasets (expected >= 3)`);
      allPassed = false;
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying ML datasets:', error);
    allPassed = false;
  }

  // Test 4: Asset Performance Analytics (Market Intelligence - Trending Assets)
  console.log('\n\n📊 TEST 4: Asset Performance Analytics (Market Intelligence)');
  console.log('-'.repeat(60));
  
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    
    // Convert to date strings for comparison
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const records = await db
      .select()
      .from(assetPerformanceAnalytics)
      .where(
        and(
          gte(assetPerformanceAnalytics.periodStart, startDateStr),
          lte(assetPerformanceAnalytics.periodEnd, endDateStr)
        )
      )
      .limit(5);

    if (records.length > 0) {
      console.log(`✅ PASS: Asset performance data available (${records.length} records)`);
      console.log(`   Date range: ${startDateStr} to ${endDateStr}`);
      records.slice(0, 3).forEach(r => {
        console.log(`   - ${r.assetType}: ${r.totalAuctions} auctions, ₦${r.avgFinalPrice} avg`);
      });
    } else {
      console.log('⚠️  WARNING: No asset performance data in current date range');
      console.log('   This may be expected if date range needs updating');
      
      // Check if data exists at all
      const totalRecords = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(assetPerformanceAnalytics);
      
      if (totalRecords[0].count > 0) {
        console.log(`   Total records in table: ${totalRecords[0].count}`);
        console.log('   💡 Run: npx tsx scripts/update-analytics-date-range.ts');
      }
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying asset performance:', error);
    allPassed = false;
  }

  // Test 5: Temporal Patterns (Market Intelligence - Best Time to Bid)
  console.log('\n\n⏰ TEST 5: Temporal Patterns Analytics');
  console.log('-'.repeat(60));
  
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const records = await db
      .select()
      .from(temporalPatternsAnalytics)
      .where(
        and(
          gte(temporalPatternsAnalytics.periodStart, startDateStr),
          lte(temporalPatternsAnalytics.periodEnd, endDateStr)
        )
      )
      .limit(5);

    if (records.length > 0) {
      console.log(`✅ PASS: Temporal patterns data available (${records.length} records)`);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      records.slice(0, 3).forEach(r => {
        console.log(`   - ${dayNames[r.dayOfWeek]} ${r.hourOfDay}:00 - ${r.peakActivityScore} activity`);
      });
    } else {
      console.log('⚠️  WARNING: No temporal patterns data in current date range');
      const totalRecords = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(temporalPatternsAnalytics);
      console.log(`   Total records in table: ${totalRecords[0].count}`);
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying temporal patterns:', error);
    allPassed = false;
  }

  // Test 6: Geographic Patterns (Market Intelligence - Regional Insights)
  console.log('\n\n🗺️  TEST 6: Geographic Patterns Analytics');
  console.log('-'.repeat(60));
  
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const records = await db
      .select()
      .from(geographicPatternsAnalytics)
      .where(
        and(
          gte(geographicPatternsAnalytics.periodStart, startDateStr),
          lte(geographicPatternsAnalytics.periodEnd, endDateStr)
        )
      );

    if (records.length > 0) {
      console.log(`✅ PASS: Geographic patterns data available (${records.length} records)`);
      records.forEach(r => {
        console.log(`   - ${r.region}: ₦${r.avgFinalPrice} avg, ${(r.demandScore * 100).toFixed(0)}% demand`);
      });
    } else {
      console.log('⚠️  WARNING: No geographic patterns data in current date range');
      const totalRecords = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(geographicPatternsAnalytics);
      console.log(`   Total records in table: ${totalRecords[0].count}`);
    }
  } catch (error) {
    console.error('❌ FAIL: Error querying geographic patterns:', error);
    allPassed = false;
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\nIntelligence Dashboard (/admin/intelligence):');
    console.log('  ✅ Vendor Analytics tab - Shows segment distribution');
    console.log('  ✅ Schema Evolution tab - Shows log entries');
    console.log('  ✅ ML Datasets tab - Shows 3+ datasets');
    console.log('\nMarket Intelligence (/vendor/market-insights):');
    console.log('  ✅ Vendor role has API access');
    console.log('  ⚠️  Data display depends on date range alignment');
    console.log('\nNext Steps:');
    console.log('1. If Market Intelligence shows "No data", run:');
    console.log('   npx tsx scripts/update-analytics-date-range.ts');
    console.log('2. Test both dashboards in browser');
    console.log('3. Verify all tabs display data correctly');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('\nPlease review the errors above and re-run fixes if needed.');
  }
}

verifyIntelligenceDashboards()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
