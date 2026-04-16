/**
 * Diagnostic Script: Market Intelligence APIs
 * 
 * Tests all APIs used by the Market Intelligence dashboard to identify why
 * Trending Assets, Temporal Patterns, and Geographic Data show "No data"
 */

import { db } from '@/lib/db';
import { 
  assetPerformanceAnalytics,
  temporalPatternsAnalytics,
  geographicPatternsAnalytics
} from '@/lib/db/schema';
import { sql, and, gte, lte } from 'drizzle-orm';
import { subDays } from 'date-fns';

async function diagnoseMarketIntelligence() {
  console.log('🔍 MARKET INTELLIGENCE DASHBOARD API DIAGNOSTIC\n');
  console.log('=' .repeat(60));

  // Calculate date ranges (matching dashboard logic)
  const endDate = new Date();
  const startDate30d = subDays(endDate, 30);
  
  console.log(`\n📅 Date Ranges:`);
  console.log(`   Dashboard "Last 30 days": ${startDate30d.toISOString()} to ${endDate.toISOString()}`);

  // Test 1: Asset Performance (Trending Assets)
  console.log('\n\n📊 TEST 1: Asset Performance (Trending Assets)');
  console.log('-'.repeat(60));
  
  try {
    // Check total records
    const totalRecords = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(assetPerformanceAnalytics);
    console.log(`Total records in asset_performance_analytics: ${totalRecords[0].count}`);

    // Check date range in database
    if (totalRecords[0].count > 0) {
      const dateRange = await db
        .select({
          minDate: sql<Date>`MIN(period_start)`,
          maxDate: sql<Date>`MAX(period_end)`,
        })
        .from(assetPerformanceAnalytics);
      
      console.log(`Database date range: ${dateRange[0].minDate} to ${dateRange[0].maxDate}`);
      
      // Test query with dashboard dates (convert to ISO date strings)
      const dashboardQuery = await db
        .select()
        .from(assetPerformanceAnalytics)
        .where(
          and(
            gte(assetPerformanceAnalytics.periodStart, startDate30d.toISOString().split('T')[0]),
            lte(assetPerformanceAnalytics.periodEnd, endDate.toISOString().split('T')[0])
          )
        )
        .limit(10);
      
      console.log(`\n🧪 Query with dashboard dates (last 30 days):`);
      console.log(`   Results: ${dashboardQuery.length} records`);
      
      if (dashboardQuery.length > 0) {
        console.log(`   ✅ Data found! Sample:`);
        dashboardQuery.slice(0, 3).forEach(r => {
          console.log(`      - ${r.assetType}: ${r.totalAuctions} auctions, ₦${r.avgFinalPrice} avg`);
        });
      } else {
        console.log(`   ⚠️  No data matches dashboard date range`);
        console.log(`   🔍 This is likely a DATE RANGE MISMATCH (same as analytics dashboard)`);
        
        // Test query without date filter
        const allRecords = await db
          .select()
          .from(assetPerformanceAnalytics)
          .limit(5);
        
        console.log(`\n   Query without date filter: ${allRecords.length} records`);
        if (allRecords.length > 0) {
          console.log(`   Sample record dates:`);
          allRecords.forEach(r => {
            console.log(`      - ${r.periodStart} to ${r.periodEnd}`);
          });
        }
      }
    } else {
      console.log('⚠️  Table is empty - needs population');
    }
  } catch (error) {
    console.error('❌ Error querying asset performance:', error);
  }

  // Test 2: Temporal Patterns (Best Time to Bid)
  console.log('\n\n⏰ TEST 2: Temporal Patterns (Best Time to Bid)');
  console.log('-'.repeat(60));
  
  try {
    const totalRecords = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(temporalPatternsAnalytics);
    console.log(`Total records in temporal_patterns_analytics: ${totalRecords[0].count}`);

    if (totalRecords[0].count > 0) {
      const dateRange = await db
        .select({
          minDate: sql<Date>`MIN(period_start)`,
          maxDate: sql<Date>`MAX(period_end)`,
        })
        .from(temporalPatternsAnalytics);
      
      console.log(`Database date range: ${dateRange[0].minDate} to ${dateRange[0].maxDate}`);
      
      // Test query with dashboard dates (convert to ISO date strings)
      const dashboardQuery = await db
        .select()
        .from(temporalPatternsAnalytics)
        .where(
          and(
            gte(temporalPatternsAnalytics.periodStart, startDate30d.toISOString().split('T')[0]),
            lte(temporalPatternsAnalytics.periodEnd, endDate.toISOString().split('T')[0])
          )
        )
        .limit(10);
      
      console.log(`\n🧪 Query with dashboard dates:`);
      console.log(`   Results: ${dashboardQuery.length} records`);
      
      if (dashboardQuery.length > 0) {
        console.log(`   ✅ Data found! Sample:`);
        dashboardQuery.slice(0, 3).forEach(r => {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          console.log(`      - ${dayNames[r.dayOfWeek]} ${r.hourOfDay}:00 - ${r.peakActivityScore} activity score`);
        });
      } else {
        console.log(`   ⚠️  No data matches dashboard date range`);
        console.log(`   🔍 DATE RANGE MISMATCH detected`);
      }
    } else {
      console.log('⚠️  Table is empty - needs population');
    }
  } catch (error) {
    console.error('❌ Error querying temporal patterns:', error);
  }

  // Test 3: Geographic Patterns (Regional Insights)
  console.log('\n\n🗺️  TEST 3: Geographic Patterns (Regional Insights)');
  console.log('-'.repeat(60));
  
  try {
    const totalRecords = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(geographicPatternsAnalytics);
    console.log(`Total records in geographic_patterns_analytics: ${totalRecords[0].count}`);

    if (totalRecords[0].count > 0) {
      const dateRange = await db
        .select({
          minDate: sql<Date>`MIN(period_start)`,
          maxDate: sql<Date>`MAX(period_end)`,
        })
        .from(geographicPatternsAnalytics);
      
      console.log(`Database date range: ${dateRange[0].minDate} to ${dateRange[0].maxDate}`);
      
      // Test query with dashboard dates (convert to ISO date strings)
      const dashboardQuery = await db
        .select()
        .from(geographicPatternsAnalytics)
        .where(
          and(
            gte(geographicPatternsAnalytics.periodStart, startDate30d.toISOString().split('T')[0]),
            lte(geographicPatternsAnalytics.periodEnd, endDate.toISOString().split('T')[0])
          )
        );
      
      console.log(`\n🧪 Query with dashboard dates:`);
      console.log(`   Results: ${dashboardQuery.length} records`);
      
      if (dashboardQuery.length > 0) {
        console.log(`   ✅ Data found! Sample:`);
        dashboardQuery.forEach(r => {
          console.log(`      - ${r.region}: ₦${r.avgFinalPrice} avg, ${r.demandScore}% demand`);
        });
      } else {
        console.log(`   ⚠️  No data matches dashboard date range`);
        console.log(`   🔍 DATE RANGE MISMATCH detected`);
      }
    } else {
      console.log('⚠️  Table is empty - needs population');
    }
  } catch (error) {
    console.error('❌ Error querying geographic patterns:', error);
  }

  // Test 4: Check API Routes
  console.log('\n\n🌐 TEST 4: API Route Authorization');
  console.log('-'.repeat(60));
  console.log('API routes to check:');
  console.log('  - /api/intelligence/analytics/asset-performance');
  console.log('  - /api/intelligence/analytics/temporal-patterns');
  console.log('  - /api/intelligence/analytics/geographic-patterns');
  console.log('\nNote: These APIs may require vendor role authentication');
  console.log('      Check if vendor users can access these endpoints');

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\nLikely Issues:');
  console.log('1. ⚠️  DATE RANGE MISMATCH (same as analytics dashboard)');
  console.log('   - Dashboard queries for "last 30 days" from today');
  console.log('   - Database has fixed date range from population script');
  console.log('   - Solution: Run update-analytics-date-range.ts script');
  console.log('\n2. ⚠️  Empty Tables');
  console.log('   - If tables are empty, run population scripts');
  console.log('\n3. ⚠️  Authorization Issues');
  console.log('   - Vendor role may not have access to analytics APIs');
  console.log('   - Check API route middleware');
  console.log('\nNext Steps:');
  console.log('1. Run: npx tsx scripts/update-analytics-date-range.ts');
  console.log('2. Test dashboard again');
  console.log('3. If still failing, check API authorization');
}

diagnoseMarketIntelligence()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
