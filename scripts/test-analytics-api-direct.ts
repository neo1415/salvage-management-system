/**
 * Test Analytics API Endpoints Directly
 * Simulates what the frontend does
 */

import { AssetAnalyticsService } from '../src/features/intelligence/services/asset-analytics.service';
import { TemporalAnalyticsService } from '../src/features/intelligence/services/temporal-analytics.service';
import { GeographicAnalyticsService } from '../src/features/intelligence/services/geographic-analytics.service';
import { BehavioralAnalyticsService } from '../src/features/intelligence/services/behavioral-analytics.service';

async function testAnalyticsServices() {
  console.log('🧪 TESTING ANALYTICS SERVICES DIRECTLY\n');
  console.log('='.repeat(80) + '\n');

  const startDate = new Date('2026-03-07');
  const endDate = new Date('2026-04-06');

  console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

  try {
    // 1. Test Asset Performance
    console.log('📊 TEST 1: Asset Performance Service\n');
    const assetService = new AssetAnalyticsService();
    const assetPerformance = await assetService.getAssetPerformance({
      startDate,
      endDate,
      limit: 50,
    });
    console.log(`   Result: ${assetPerformance.length} records`);
    if (assetPerformance.length > 0) {
      console.log(`   Sample: ${JSON.stringify(assetPerformance[0], null, 2)}`);
    }

    // 2. Test Attribute Performance
    console.log('\n📊 TEST 2: Attribute Performance Service\n');
    const attributePerformance = await assetService.getAttributePerformance({
      startDate,
      endDate,
      limit: 50,
    });
    console.log(`   Result: ${attributePerformance.length} records`);
    if (attributePerformance.length > 0) {
      console.log(`   Sample: ${JSON.stringify(attributePerformance[0], null, 2)}`);
    }

    // 3. Test Temporal Patterns
    console.log('\n📊 TEST 3: Temporal Patterns Service\n');
    const temporalService = new TemporalAnalyticsService();
    const temporalPatterns = await temporalService.getTemporalPatterns({
      startDate,
      endDate,
    });
    console.log(`   Result: ${temporalPatterns.length} records`);
    if (temporalPatterns.length > 0) {
      console.log(`   Sample: ${JSON.stringify(temporalPatterns[0], null, 2)}`);
    }

    // 4. Test Geographic Patterns
    console.log('\n📊 TEST 4: Geographic Patterns Service\n');
    const geoService = new GeographicAnalyticsService();
    const geoPatterns = await geoService.getGeographicPatterns({
      startDate,
      endDate,
    });
    console.log(`   Result: ${geoPatterns.length} records`);
    if (geoPatterns.length > 0) {
      console.log(`   Sample: ${JSON.stringify(geoPatterns[0], null, 2)}`);
    }

    // 5. Test Vendor Segments
    console.log('\n📊 TEST 5: Vendor Segments Service\n');
    const behavioralService = new BehavioralAnalyticsService();
    const vendorSegments = await behavioralService.getVendorSegments({
      limit: 50,
    });
    console.log(`   Result: ${vendorSegments.length} records`);
    if (vendorSegments.length > 0) {
      console.log(`   Sample: ${JSON.stringify(vendorSegments[0], null, 2)}`);
    }

    // 6. Test Conversion Funnel
    console.log('\n📊 TEST 6: Conversion Funnel Service\n');
    const conversionFunnel = await behavioralService.getConversionFunnel({
      startDate,
      endDate,
    });
    console.log(`   Result: ${conversionFunnel ? 'Data found' : 'No data'}`);
    if (conversionFunnel) {
      console.log(`   Data: ${JSON.stringify(conversionFunnel, null, 2)}`);
    }

    // 7. Test Session Metrics
    console.log('\n📊 TEST 7: Session Metrics Service\n');
    const sessionMetrics = await behavioralService.getSessionMetrics({
      startDate,
      endDate,
      limit: 50,
    });
    console.log(`   Metrics: ${sessionMetrics.metrics ? 'Found' : 'Not found'}`);
    console.log(`   Trends: ${sessionMetrics.trends.length} records`);
    if (sessionMetrics.metrics) {
      console.log(`   Metrics data: ${JSON.stringify(sessionMetrics.metrics, null, 2)}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY\n');
    console.log(`✅ Asset Performance: ${assetPerformance.length} records`);
    console.log(`✅ Attribute Performance: ${attributePerformance.length} records`);
    console.log(`✅ Temporal Patterns: ${temporalPatterns.length} records`);
    console.log(`✅ Geographic Patterns: ${geoPatterns.length} records`);
    console.log(`✅ Vendor Segments: ${vendorSegments.length} records`);
    console.log(`✅ Conversion Funnel: ${conversionFunnel ? 'Has data' : 'No data'}`);
    console.log(`✅ Session Metrics: ${sessionMetrics.trends.length} trend records`);

    const totalRecords = assetPerformance.length + attributePerformance.length + 
                        temporalPatterns.length + geoPatterns.length + 
                        vendorSegments.length + sessionMetrics.trends.length;

    if (totalRecords > 0) {
      console.log(`\n✅ SERVICES ARE WORKING! Total records: ${totalRecords}`);
      console.log('\nIf dashboard still shows "No data", the issue is likely:');
      console.log('1. API route validation (check for 400 errors in browser Network tab)');
      console.log('2. Frontend not handling response correctly');
      console.log('3. Date range mismatch between frontend and database');
    } else {
      console.log('\n⚠️  Services returned no data. Check date ranges and database content.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

testAnalyticsServices();
