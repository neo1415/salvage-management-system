/**
 * Test Intelligence Dashboard APIs
 * 
 * This script tests all the intelligence dashboard API endpoints
 * to ensure they return data correctly.
 */

import { db } from '../src/lib/db/index.js';
import { AssetAnalyticsService } from '../src/features/intelligence/services/asset-analytics.service.js';
import { TemporalAnalyticsService } from '../src/features/intelligence/services/temporal-analytics.service.js';
import { GeographicAnalyticsService } from '../src/features/intelligence/services/geographic-analytics.service.js';

async function testAPIs() {
  console.log('🧪 Testing Intelligence Dashboard APIs...\n');

  // Test dates (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  console.log(`📅 Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

  // Test Asset Performance API
  console.log('1️⃣  Testing Asset Performance Service...');
  try {
    const assetService = new AssetAnalyticsService();
    const assetData = await assetService.getAssetPerformance({
      startDate,
      endDate,
      limit: 10,
    });
    console.log(`   ✅ Found ${assetData.length} asset performance records`);
    if (assetData.length > 0) {
      console.log(`   Sample: ${assetData[0].assetType} - Demand Score: ${assetData[0].demandScore}`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  // Test Temporal Patterns API
  console.log('\n2️⃣  Testing Temporal Patterns Service...');
  try {
    const temporalService = new TemporalAnalyticsService();
    const temporalData = await temporalService.getTemporalPatterns({
      startDate,
      endDate,
    });
    console.log(`   ✅ Found ${temporalData.length} temporal pattern records`);
    if (temporalData.length > 0) {
      const sample = temporalData[0];
      console.log(`   Sample: Hour ${sample.hourOfDay}, Day ${sample.dayOfWeek} - Peak Score: ${sample.peakActivityScore}`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  // Test Geographic Patterns API
  console.log('\n3️⃣  Testing Geographic Patterns Service...');
  try {
    const geoService = new GeographicAnalyticsService();
    const geoData = await geoService.getGeographicPatterns({
      startDate,
      endDate,
    });
    console.log(`   ✅ Found ${geoData.length} geographic pattern records`);
    if (geoData.length > 0) {
      console.log(`   Sample: ${geoData[0].region} - Demand Score: ${geoData[0].demandScore}`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  console.log('\n✅ API Testing Complete!');
  process.exit(0);
}

testAPIs();
