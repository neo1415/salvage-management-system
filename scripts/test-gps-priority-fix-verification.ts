#!/usr/bin/env tsx

/**
 * Test the GPS priority fix to verify it's working correctly
 * This should show browser GPS being tried first, then Google API fallback
 */

import dotenv from 'dotenv';
import { getAccurateGeolocation } from '../src/lib/integrations/google-geolocation';

// Load environment variables
dotenv.config();

async function testGPSPriorityFix() {
  console.log('🧪 Testing GPS Priority Fix');
  console.log('=' .repeat(50));
  
  console.log('📋 Expected Behavior:');
  console.log('   1. Try browser GPS first (more accurate, FREE)');
  console.log('   2. Fall back to Google API only if GPS fails');
  console.log('   3. Show detailed logging of which method is used');
  
  console.log('\n🌍 Testing getAccurateGeolocation()...');
  console.log('   (Check the console logs below for the priority order)');
  
  try {
    const result = await getAccurateGeolocation();
    
    console.log('\n✅ Geolocation Result:');
    console.log(`   📍 Latitude: ${result.latitude}`);
    console.log(`   📍 Longitude: ${result.longitude}`);
    console.log(`   🎯 Accuracy: ${Math.round(result.accuracy)}m`);
    console.log(`   🔧 Source: ${result.source}`);
    console.log(`   📍 Location: ${result.locationName || 'Not available'}`);
    
    // Analyze the result
    console.log('\n📊 Analysis:');
    if (result.source === 'browser') {
      console.log('   🎉 SUCCESS: Used browser GPS (FREE, more accurate)');
      if (result.accuracy <= 100) {
        console.log('   🎯 EXCELLENT: High accuracy GPS location');
      } else if (result.accuracy <= 1000) {
        console.log('   👍 GOOD: Moderate accuracy (WiFi/cell towers)');
      } else {
        console.log('   ⚠️ FAIR: Lower accuracy but still better than IP-based');
      }
    } else if (result.source === 'google-api') {
      console.log('   ⚠️ FALLBACK: Used Google API (browser GPS failed)');
      console.log('   💰 COST: This request cost money ($5/1K requests)');
      if (result.accuracy > 100000) {
        console.log('   📍 IP-BASED: City-level accuracy (expected for API)');
      }
    }
    
    console.log('\n💰 Cost Analysis:');
    if (result.source === 'browser') {
      console.log('   💚 Cost: $0 (FREE browser GPS)');
      console.log('   📈 Savings: 100% vs Google API');
    } else {
      console.log('   💛 Cost: ~$0.005 (Google API)');
      console.log('   📈 Usage: 1 of 10,000 free requests this month');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure you allow location permissions');
    console.log('   2. Check that you\'re connected to the internet');
    console.log('   3. Verify your Google Maps API key is valid');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🧪 GPS Priority Fix test completed');
}

// Run the test
testGPSPriorityFix().catch(console.error);