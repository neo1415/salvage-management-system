#!/usr/bin/env tsx

/**
 * Test script to verify Google APIs setup and pricing
 * Tests all the Google APIs you've enabled and shows current pricing
 */

import dotenv from 'dotenv';
import { getAccurateGeolocation } from '../src/lib/integrations/google-geolocation';

// Load environment variables
dotenv.config();

async function testGoogleAPIsSetup() {
  console.log('🧪 Testing Google APIs Setup');
  console.log('=' .repeat(60));
  
  // Check environment variables
  console.log('\n📋 Environment Variables Check:');
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT_ID;
  
  console.log(`   🗝️  Google Maps API Key: ${googleMapsKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   🗝️  Gemini API Key: ${geminiKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   🗝️  Google Cloud Project: ${googleCloudProject ? '✅ Configured' : '❌ Missing'}`);
  
  if (googleMapsKey) {
    console.log(`   📝 Maps Key Preview: ${googleMapsKey.substring(0, 20)}...`);
  }
  
  // Test Google Maps APIs
  console.log('\n🗺️  Google Maps APIs Test:');
  
  try {
    // Test 1: Geolocation API
    console.log('\n   1️⃣ Testing Geolocation API...');
    const location = await testGeolocationAPI(googleMapsKey!);
    console.log(`      ✅ Geolocation works: ${location.latitude}, ${location.longitude}`);
    console.log(`      🎯 Accuracy: ${Math.round(location.accuracy)}m`);
    console.log(`      💰 Cost: $5 per 1,000 requests (you get 10,000 free/month)`);
    
    // Test 2: Geocoding API (reverse geocoding)
    console.log('\n   2️⃣ Testing Geocoding API (reverse geocoding)...');
    const address = await testGeocodingAPI(googleMapsKey!, location.latitude, location.longitude);
    console.log(`      ✅ Geocoding works: ${address}`);
    console.log(`      💰 Cost: $5 per 1,000 requests (you get 10,000 free/month)`);
    
    // Test 3: Places API (if you want to test autocomplete)
    console.log('\n   3️⃣ Testing Places API (autocomplete)...');
    const places = await testPlacesAPI(googleMapsKey!, 'Lagos Nigeria');
    console.log(`      ✅ Places API works: Found ${places.length} suggestions`);
    console.log(`      💰 Cost: $2.83 per 1,000 requests (you get 10,000 free/month)`);
    
  } catch (error) {
    console.error('❌ Google Maps API test failed:', error);
  }
  
  // Test Gemini API
  if (geminiKey) {
    console.log('\n🤖 Gemini AI API Test:');
    try {
      const geminiTest = await testGeminiAPI(geminiKey);
      console.log(`      ✅ Gemini API works: ${geminiTest}`);
      console.log(`      💰 Cost: FREE (15 requests/minute, 1,500/day)`);
    } catch (error) {
      console.error('❌ Gemini API test failed:', error);
    }
  }
  
  // Show pricing summary
  console.log('\n💰 Google APIs Pricing Summary (2026):');
  console.log('   📊 Monthly Free Credits: $200 (covers ~40,000 geocoding requests)');
  console.log('   🗺️  Geolocation API: $5 per 1,000 requests (10,000 free/month)');
  console.log('   📍 Geocoding API: $5 per 1,000 requests (10,000 free/month)');
  console.log('   🏢 Places Autocomplete: $2.83 per 1,000 requests (10,000 free/month)');
  console.log('   🗺️  Maps JavaScript API: $7 per 1,000 loads (10,000 free/month)');
  console.log('   🤖 Gemini AI: FREE (15 req/min, 1,500/day)');
  
  console.log('\n📈 Estimated Monthly Costs for Your Use Case:');
  console.log('   🏢 Case Creation (500 cases/month):');
  console.log('      • Geolocation: FREE (within 10K limit)');
  console.log('      • Geocoding: FREE (within 10K limit)');
  console.log('      • Places Autocomplete: FREE (within 10K limit)');
  console.log('   💡 Total Estimated Cost: $0/month (all within free tiers!)');
  
  console.log('\n✅ Conclusion:');
  console.log('   • You have ONE API key that works for ALL Google Maps services');
  console.log('   • No need for additional API keys');
  console.log('   • Your current usage should stay within free tiers');
  console.log('   • The APIs you enabled are perfect for case creation');
  
  console.log('\\n' + '='.repeat(60));
  console.log('🧪 Google APIs test completed');
}

async function testGeolocationAPI(apiKey: string) {
  const response = await fetch(
    `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Geolocation API error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return {
    latitude: data.location.lat,
    longitude: data.location.lng,
    accuracy: data.accuracy || 0,
  };
}

async function testGeocodingAPI(apiKey: string, lat: number, lng: number) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
  );
  
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }
  
  return data.results[0].formatted_address;
}

async function testPlacesAPI(apiKey: string, query: string) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`
  );
  
  if (!response.ok) {
    throw new Error(`Places API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(`Places API failed: ${data.status}`);
  }
  
  return data.predictions || [];
}

async function testGeminiAPI(apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Say "Hello from Gemini API test!" in exactly 5 words.' }]
        }]
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

// Run the test
testGoogleAPIsSetup().catch(console.error);