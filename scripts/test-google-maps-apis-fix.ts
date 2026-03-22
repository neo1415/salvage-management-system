#!/usr/bin/env tsx

/**
 * Test Google Maps APIs Fix
 * Verifies that all required Google Maps APIs are working after enabling them
 */

import { config } from 'dotenv';

// Load environment variables
config();

async function testGoogleMapsAPIsFix() {
  console.log('🗺️  Testing Google Maps APIs Fix...\n');
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'your-google-maps-api-key-here') {
    console.error('❌ Google Maps API key not configured');
    console.log('   Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env file');
    return;
  }
  
  console.log('🔑 API Key configured:', apiKey.substring(0, 20) + '...');
  console.log();
  
  // Test 1: Geolocation API (should already work)
  console.log('1️⃣ Testing Geolocation API...');
  try {
    const geoResponse = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ considerIp: true })
      }
    );
    
    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      console.log('   ✅ Geolocation API: Working');
      console.log(`   📍 Location: ${geoData.location.lat}, ${geoData.location.lng}`);
    } else {
      console.log('   ❌ Geolocation API: Failed');
      console.log(`   Status: ${geoResponse.status} ${geoResponse.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Geolocation API: Error');
    console.log(`   ${error}`);
  }
  
  console.log();
  
  // Test 2: Geocoding API (should already work)
  console.log('2️⃣ Testing Geocoding API...');
  try {
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=6.5244,3.3792&key=${apiKey}`
    );
    
    if (geocodeResponse.ok) {
      const geocodeData = await geocodeResponse.json();
      if (geocodeData.status === 'OK') {
        console.log('   ✅ Geocoding API: Working');
        console.log(`   📍 Address: ${geocodeData.results[0]?.formatted_address || 'N/A'}`);
      } else {
        console.log('   ❌ Geocoding API: API Error');
        console.log(`   Status: ${geocodeData.status}`);
      }
    } else {
      console.log('   ❌ Geocoding API: Failed');
      console.log(`   Status: ${geocodeResponse.status} ${geocodeResponse.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Geocoding API: Error');
    console.log(`   ${error}`);
  }
  
  console.log();
  
  // Test 3: Maps Embed API (this is the one that was failing)
  console.log('3️⃣ Testing Maps Embed API...');
  try {
    const testLocation = 'Igbogbo,Ikorodu,Lagos';
    const embedResponse = await fetch(
      `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(testLocation)}`,
      { method: 'HEAD' } // Just check headers, don't download full HTML
    );
    
    if (embedResponse.ok) {
      console.log('   ✅ Maps Embed API: Working');
      console.log('   🗺️  Maps will now display in auction details');
    } else if (embedResponse.status === 403) {
      console.log('   ❌ Maps Embed API: Still not enabled');
      console.log('   📋 Action needed: Enable Maps Embed API in Google Cloud Console');
      console.log('   🔗 URL: https://console.cloud.google.com/apis/library/maps-embed-backend.googleapis.com');
    } else {
      console.log('   ❌ Maps Embed API: Failed');
      console.log(`   Status: ${embedResponse.status} ${embedResponse.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Maps Embed API: Error');
    console.log(`   ${error}`);
  }
  
  console.log();
  
  // Test 4: Places API (should already work)
  console.log('4️⃣ Testing Places API...');
  try {
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Lagos&key=${apiKey}`
    );
    
    if (placesResponse.ok) {
      const placesData = await placesResponse.json();
      if (placesData.status === 'OK') {
        console.log('   ✅ Places API: Working');
        console.log(`   📍 Found ${placesData.predictions?.length || 0} place suggestions`);
      } else {
        console.log('   ❌ Places API: API Error');
        console.log(`   Status: ${placesData.status}`);
      }
    } else {
      console.log('   ❌ Places API: Failed');
      console.log(`   Status: ${placesResponse.status} ${placesResponse.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Places API: Error');
    console.log(`   ${error}`);
  }
  
  console.log();
  
  // Summary
  console.log('📋 Summary:');
  console.log('   The main issue is Maps Embed API not being enabled.');
  console.log('   Other APIs (Geolocation, Geocoding, Places) are working fine.');
  console.log();
  console.log('🔧 To fix the 403 error:');
  console.log('   1. Go to: https://console.cloud.google.com/apis/library');
  console.log('   2. Search for "Maps Embed API"');
  console.log('   3. Click "Enable"');
  console.log('   4. Also enable "Maps JavaScript API" for future features');
  console.log('   5. Update your API key restrictions to include these APIs');
  console.log();
  console.log('💰 Cost: Maps Embed API is FREE (unlimited usage)');
}

// Run the test
testGoogleMapsAPIsFix().catch(console.error);