/**
 * Simple Analytics Dashboard Diagnostic
 * Checks data availability for all dashboard components
 */

import { db } from '@/lib/db';
import { 
  assetPerformanceAnalytics,
  attributePerformanceAnalytics,
  geographicPatternsAnalytics,
  vendorSegments,
  sessionAnalytics,
  conversionFunnelAnalytics,
} from '@/lib/db/schema/analytics';
import { mlTrainingDatasets } from '@/lib/db/schema/ml-training';
import { count, sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 ANALYTICS DASHBOARD DIAGNOSTIC\n');
  
  try {
    // 1. Asset Performance (for sell-through rate & make/model display)
    console.log('1️⃣  Asset Performance Analytics');
    const assetCount = await db.select({ count: count() }).from(assetPerformanceAnalytics);
    console.log(`   Records: ${assetCount[0].count}`);
    
    if (assetCount[0].count > 0) {
      const sample = await db.select().from(assetPerformanceAnalytics).limit(3);
      console.log('   Sample data:');
      sample.forEach(row => {
        console.log(`     ${row.assetType}: ${row.make} ${row.model} ${row.year || ''}`);
        console.log(`       Sell-through: ${row.avgSellThroughRate} (${Number(row.avgSellThroughRate || 0) * 100}%)`);
      });
    }
    
    // 2. Attribute Performance (Color/Trim/Storage)
    console.log('\n2️⃣  Attribute Performance Analytics');
    const attrCount = await db.select({ count: count() }).from(attributePerformanceAnalytics);
    console.log(`   Records: ${attrCount[0].count}`);
    
    if (attrCount[0].count > 0) {
      const sample = await db.select().from(attributePerformanceAnalytics).limit(3);
      console.log('   Sample data:');
      sample.forEach(row => {
        console.log(`     ${row.attributeType}: ${row.attributeValue} (${row.totalAuctions} auctions)`);
      });
    }
    
    // 3. Geographic Patterns
    console.log('\n3️⃣  Geographic Patterns Analytics');
    const geoCount = await db.select({ count: count() }).from(geographicPatternsAnalytics);
    console.log(`   Records: ${geoCount[0].count}`);
    
    if (geoCount[0].count > 0) {
      const sample = await db.select().from(geographicPatternsAnalytics).limit(5);
      console.log('   Sample regions:');
      sample.forEach(row => {
        console.log(`     ${row.region || 'NULL'}: ${row.totalAuctions} auctions`);
      });
    }
    
    // 4. Vendor Segments
    console.log('\n4️⃣  Vendor Segments');
    const vendorCount = await db.select({ count: count() }).from(vendorSegments);
    console.log(`   Records: ${vendorCount[0].count}`);
    
    if (vendorCount[0].count > 0) {
      const sample = await db.select().from(vendorSegments).limit(3);
      console.log('   Sample segments:');
      sample.forEach(row => {
        console.log(`     ${row.priceSegment}_${row.activitySegment}: Win rate ${row.overallWinRate}`);
      });
    }
    
    // 5. Session Analytics
    console.log('\n5️⃣  Session Analytics');
    const sessionCount = await db.select({ count: count() }).from(sessionAnalytics);
    console.log(`   Records: ${sessionCount[0].count}`);
    
    if (sessionCount[0].count > 0) {
      const sample = await db.select().from(sessionAnalytics).limit(3);
      console.log('   Sample sessions:');
      sample.forEach(row => {
        console.log(`     Duration: ${row.durationSeconds}s, Pages: ${row.pagesViewed}`);
      });
    }
    
    // 6. Conversion Funnel
    console.log('\n6️⃣  Conversion Funnel Analytics');
    const conversionCount = await db.select({ count: count() }).from(conversionFunnelAnalytics);
    console.log(`   Records: ${conversionCount[0].count}`);
    
    if (conversionCount[0].count > 0) {
      const sample = await db.select().from(conversionFunnelAnalytics).limit(1);
      console.log('   Sample data:');
      sample.forEach(row => {
        console.log(`     Views: ${row.totalViews}, Bids: ${row.totalBids}, Wins: ${row.totalWins}`);
      });
    }
    
    // 7. ML Datasets
    console.log('\n7️⃣  ML Training Datasets');
    const mlCount = await db.select({ count: count() }).from(mlTrainingDatasets);
    console.log(`   Records: ${mlCount[0].count}`);
    
    if (mlCount[0].count > 0) {
      const sample = await db.select().from(mlTrainingDatasets).limit(3);
      console.log('   Sample datasets:');
      sample.forEach(row => {
        console.log(`     ${row.datasetType}: ${row.recordCount} records`);
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    const issues = [
      { name: 'Asset Performance', count: assetCount[0].count, status: assetCount[0].count > 0 ? '✅' : '❌' },
      { name: 'Attribute Performance', count: attrCount[0].count, status: attrCount[0].count > 0 ? '✅' : '❌' },
      { name: 'Geographic Patterns', count: geoCount[0].count, status: geoCount[0].count > 0 ? '✅' : '❌' },
      { name: 'Vendor Segments', count: vendorCount[0].count, status: vendorCount[0].count > 0 ? '✅' : '❌' },
      { name: 'Session Analytics', count: sessionCount[0].count, status: sessionCount[0].count > 0 ? '✅' : '❌' },
      { name: 'Conversion Funnel', count: conversionCount[0].count, status: conversionCount[0].count > 0 ? '✅' : '❌' },
      { name: 'ML Datasets', count: mlCount[0].count, status: mlCount[0].count > 0 ? '✅' : '❌' },
    ];
    
    issues.forEach(issue => {
      console.log(`${issue.status} ${issue.name}: ${issue.count} records`);
    });
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    throw error;
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
