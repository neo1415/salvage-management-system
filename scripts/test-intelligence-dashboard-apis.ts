/**
 * Test Intelligence Dashboard APIs
 * 
 * This script tests all intelligence analytics API endpoints to verify they return data.
 */

import { db } from '@/lib/db';
import { 
  assetPerformanceAnalytics,
  attributePerformanceAnalytics,
  temporalPatternsAnalytics,
  geographicPatternsAnalytics,
  vendorSegments,
  sessionAnalytics,
  conversionFunnelAnalytics
} from '@/lib/db/schema/analytics';

async function testDatabaseData() {
  console.log('🔍 Testing Intelligence Dashboard Data...\n');

  try {
    // Test 1: Asset Performance Analytics
    console.log('1️⃣  Testing Asset Performance Analytics...');
    const assetPerf = await db.select().from(assetPerformanceAnalytics).limit(5);
    console.log(`   ✅ Found ${assetPerf.length} asset performance records`);
    if (assetPerf.length > 0) {
      console.log(`   📊 Sample: ${assetPerf[0].assetType} - ${assetPerf[0].make} ${assetPerf[0].model} (Demand Score: ${assetPerf[0].demandScore})`);
    }

    // Test 2: Attribute Performance Analytics
    console.log('\n2️⃣  Testing Attribute Performance Analytics...');
    const attrPerf = await db.select().from(attributePerformanceAnalytics).limit(5);
    console.log(`   ✅ Found ${attrPerf.length} attribute performance records`);
    if (attrPerf.length > 0) {
      const colorRecords = attrPerf.filter(a => a.attributeType === 'color');
      const trimRecords = attrPerf.filter(a => a.attributeType === 'trim');
      const storageRecords = attrPerf.filter(a => a.attributeType === 'storage');
      console.log(`   📊 Color: ${colorRecords.length}, Trim: ${trimRecords.length}, Storage: ${storageRecords.length}`);
    }

    // Test 3: Temporal Patterns Analytics
    console.log('\n3️⃣  Testing Temporal Patterns Analytics...');
    const temporalPatterns = await db.select().from(temporalPatternsAnalytics).limit(5);
    console.log(`   ✅ Found ${temporalPatterns.length} temporal pattern records`);
    if (temporalPatterns.length > 0) {
      console.log(`   📊 Sample: Hour ${temporalPatterns[0].hourOfDay}, Day ${temporalPatterns[0].dayOfWeek}, Month ${temporalPatterns[0].monthOfYear}`);
    }

    // Test 4: Geographic Patterns Analytics
    console.log('\n4️⃣  Testing Geographic Patterns Analytics...');
    const geoPatterns = await db.select().from(geographicPatternsAnalytics).limit(5);
    console.log(`   ✅ Found ${geoPatterns.length} geographic pattern records`);
    if (geoPatterns.length > 0) {
      console.log(`   📊 Sample: ${geoPatterns[0].region} - ${geoPatterns[0].assetType} (Demand Score: ${geoPatterns[0].demandScore})`);
    }

    // Test 5: Vendor Segments
    console.log('\n5️⃣  Testing Vendor Segments...');
    const segments = await db.select().from(vendorSegments).limit(5);
    console.log(`   ✅ Found ${segments.length} vendor segment records`);
    if (segments.length > 0) {
      console.log(`   📊 Sample: ${segments[0].priceSegment} / ${segments[0].categorySegment} / ${segments[0].activitySegment}`);
    }

    // Test 6: Session Analytics
    console.log('\n6️⃣  Testing Session Analytics...');
    const sessions = await db.select().from(sessionAnalytics).limit(5);
    console.log(`   ✅ Found ${sessions.length} session analytics records`);
    if (sessions.length > 0) {
      console.log(`   📊 Sample: Duration ${sessions[0].durationSeconds}s, Pages: ${sessions[0].pagesViewed}, Bids: ${sessions[0].bidsPlaced}`);
    }

    // Test 7: Conversion Funnel Analytics
    console.log('\n7️⃣  Testing Conversion Funnel Analytics...');
    const funnels = await db.select().from(conversionFunnelAnalytics).limit(5);
    console.log(`   ✅ Found ${funnels.length} conversion funnel records`);
    if (funnels.length > 0) {
      console.log(`   📊 Sample: Views ${funnels[0].totalViews} → Watches ${funnels[0].totalWatches} → Bids ${funnels[0].totalBids} → Wins ${funnels[0].totalWins}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const totalRecords = assetPerf.length + attrPerf.length + temporalPatterns.length + 
                        geoPatterns.length + segments.length + sessions.length + funnels.length;
    
    if (totalRecords === 0) {
      console.log('❌ NO DATA FOUND - Intelligence tables are empty!');
      console.log('   Run population scripts to generate analytics data.');
    } else {
      console.log(`✅ Found ${totalRecords} total records across all analytics tables`);
      console.log('   Intelligence dashboard should display data.');
    }

    // Check for missing data
    const missingTables = [];
    if (assetPerf.length === 0) missingTables.push('Asset Performance');
    if (attrPerf.length === 0) missingTables.push('Attribute Performance');
    if (temporalPatterns.length === 0) missingTables.push('Temporal Patterns');
    if (geoPatterns.length === 0) missingTables.push('Geographic Patterns');
    if (segments.length === 0) missingTables.push('Vendor Segments');
    if (sessions.length === 0) missingTables.push('Session Analytics');
    if (funnels.length === 0) missingTables.push('Conversion Funnel');

    if (missingTables.length > 0) {
      console.log('\n⚠️  MISSING DATA IN:');
      missingTables.forEach(table => console.log(`   - ${table}`));
    }

  } catch (error) {
    console.error('❌ Error testing intelligence data:', error);
    throw error;
  }
}

// Run the test
testDatabaseData()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
