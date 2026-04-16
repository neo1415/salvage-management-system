/**
 * Live Analytics Dashboard API Testing
 * 
 * Tests the actual API endpoints to see what they return
 */

import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { TemporalAnalyticsService } from '@/features/intelligence/services/temporal-analytics.service';
import { GeographicAnalyticsService } from '@/features/intelligence/services/geographic-analytics.service';

async function testAPIs() {
  console.log('🧪 TESTING ANALYTICS DASHBOARD APIs\n');
  console.log('='.repeat(70));
  
  const startDate = new Date('2026-03-07');
  const endDate = new Date('2026-04-06');
  
  console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

  try {
    // Test 1: Asset Performance
    console.log('📊 TEST 1: Asset Performance API');
    const assetService = new AssetAnalyticsService();
    const assetPerformance = await assetService.getAssetPerformance({
      startDate,
      endDate,
      limit: 50,
    });
    
    // Transform like the API does
    const transformedAsset = assetPerformance.map(item => ({
      ...item,
      avgPrice: item.avgFinalPrice,
      sellThroughRate: Number(item.avgSellThroughRate || 0) * 100,
      avgDaysToSell: Math.round(Number(item.avgTimeToSell || 0) / 24),
    }));
    
    console.log(`   ✅ Result: ${transformedAsset.length} records`);
    console.log(`   Sample:`, JSON.stringify(transformedAsset[0], null, 2));
    console.log(`   avgPrice type: ${typeof transformedAsset[0]?.avgPrice}`);
    console.log(`   sellThroughRate type: ${typeof transformedAsset[0]?.sellThroughRate}`);
    console.log(`   sellThroughRate value: ${transformedAsset[0]?.sellThroughRate}`);
    console.log();

    // Test 2: Attribute Performance
    console.log('📊 TEST 2: Attribute Performance API');
    const attrService = new AssetAnalyticsService();
    const attrPerformance = await attrService.getAttributePerformance({
      startDate,
      endDate,
      limit: 50,
    });
    
    const colorData = attrPerformance.filter(a => a.attributeType === 'color');
    const trimData = attrPerformance.filter(a => a.attributeType === 'trim');
    const storageData = attrPerformance.filter(a => a.attributeType === 'storage');
    
    console.log(`   ✅ Color: ${colorData.length} records`);
    console.log(`   ✅ Trim: ${trimData.length} records`);
    console.log(`   ✅ Storage: ${storageData.length} records`);
    if (colorData[0]) {
      console.log(`   Sample:`, JSON.stringify(colorData[0], null, 2));
    }
    console.log();

    // Test 3: Temporal Patterns
    console.log('📊 TEST 3: Temporal Patterns API');
    const temporalService = new TemporalAnalyticsService();
    const temporalPatterns = await temporalService.getTemporalPatterns({
      startDate,
      endDate,
      limit: 50,
    });
    
    console.log(`   ✅ Result: ${temporalPatterns.length} records`);
    if (temporalPatterns[0]) {
      console.log(`   Sample:`, JSON.stringify(temporalPatterns[0], null, 2));
    }
    console.log();

    // Test 4: Geographic Patterns
    console.log('📊 TEST 4: Geographic Patterns API');
    const geoService = new GeographicAnalyticsService();
    const geoPatterns = await geoService.getGeographicPatterns({
      startDate,
      endDate,
      limit: 50,
    });
    
    console.log(`   ✅ Result: ${geoPatterns.length} records`);
    if (geoPatterns[0]) {
      console.log(`   Sample:`, JSON.stringify(geoPatterns[0], null, 2));
    }
    console.log();

    // Test 5: Vendor Segments
    console.log('📊 TEST 5: Vendor Segments API');
    const behavioralService = new BehavioralAnalyticsService();
    const vendorSegments = await behavioralService.getVendorSegments({
      startDate,
      endDate,
      limit: 50,
    });
    
    console.log(`   ✅ Result: ${vendorSegments.length} records`);
    if (vendorSegments[0]) {
      console.log(`   Sample:`, JSON.stringify(vendorSegments[0], null, 2));
    }
    console.log();

    // Test 6: Conversion Funnel
    console.log('📊 TEST 6: Conversion Funnel API');
    const conversionFunnel = await behavioralService.getConversionFunnel({
      startDate,
      endDate,
    });
    
    console.log(`   ✅ Result:`, conversionFunnel ? 'Data found' : 'No data');
    if (conversionFunnel) {
      console.log(`   Data:`, JSON.stringify(conversionFunnel, null, 2));
    }
    console.log();

    // Test 7: Session Metrics
    console.log('📊 TEST 7: Session Metrics API');
    const sessionMetrics = await behavioralService.getSessionMetrics({
      startDate,
      endDate,
      limit: 50,
    });
    
    console.log(`   ✅ Metrics:`, sessionMetrics.metrics ? 'Found' : 'Not found');
    console.log(`   ✅ Trends: ${sessionMetrics.trends?.length || 0} records`);
    console.log(`   Metrics data:`, JSON.stringify(sessionMetrics.metrics, null, 2));
    console.log();

    // Summary
    console.log('='.repeat(70));
    console.log('📋 SUMMARY\n');
    console.log(`✅ Asset Performance: ${transformedAsset.length} records`);
    console.log(`✅ Attribute Performance: ${attrPerformance.length} records`);
    console.log(`✅ Temporal Patterns: ${temporalPatterns.length} records`);
    console.log(`✅ Geographic Patterns: ${geoPatterns.length} records`);
    console.log(`✅ Vendor Segments: ${vendorSegments.length} records`);
    console.log(`✅ Conversion Funnel: ${conversionFunnel ? 'Has data' : 'No data'}`);
    console.log(`✅ Session Metrics: ${sessionMetrics.trends?.length || 0} trend records`);
    
    const totalRecords = transformedAsset.length + attrPerformance.length + 
                        temporalPatterns.length + geoPatterns.length + 
                        vendorSegments.length + (sessionMetrics.trends?.length || 0);
    
    console.log(`\n✅ SERVICES ARE WORKING! Total records: ${totalRecords}`);
    console.log('\nIf dashboard still shows "No data", the issue is likely:');
    console.log('1. API route validation (check for 400 errors in browser Network tab)');
    console.log('2. Frontend not handling response correctly');
    console.log('3. Date range mismatch between frontend and database');
    console.log('4. avgSellThroughRate is NULL in database (check sample above)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testAPIs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
