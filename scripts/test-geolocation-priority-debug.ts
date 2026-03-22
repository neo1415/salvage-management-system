#!/usr/bin/env node

/**
 * Debug script to test geolocation priority and see exactly what's happening
 */

import { config } from 'dotenv';

// Load environment variables
config();

async function testGeolocationPriority() {
  console.log('🧪 Testing Geolocation Priority Debug');
  console.log('==================================================');
  
  // Simulate browser environment
  const mockNavigator = {
    onLine: true,
    geolocation: {
      getCurrentPosition: (success: any, error: any, options: any) => {
        console.log('📍 Browser geolocation.getCurrentPosition called with options:', options);
        // Simulate permission denied or timeout
        setTimeout(() => {
          error({
            code: 1, // PERMISSION_DENIED
            message: 'User denied the request for Geolocation.'
          });
        }, 100);
      }
    }
  };
  
  // Mock global navigator
  (global as any).navigator = mockNavigator;
  (global as any).fetch = require('node-fetch');
  
  console.log('🌍 Environment Check:');
  console.log('- API Key configured:', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  console.log('- Online status:', mockNavigator.onLine);
  console.log('- Browser geolocation available:', 'geolocation' in mockNavigator);
  
  try {
    // Import and test the function
    const { getAccurateGeolocation } = await import('../src/lib/integrations/google-geolocation');
    
    console.log('\n🎯 Testing getAccurateGeolocation()...');
    const result = await getAccurateGeolocation();
    
    console.log('\n✅ Result:', result);
    console.log('📊 Source:', result.source);
    console.log('📍 Accuracy:', result.accuracy + 'm');
    console.log('🗺️ Location:', result.locationName);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
  
  console.log('\n==================================================');
  console.log('🧪 Geolocation Priority Debug complete');
}

testGeolocationPriority().catch(console.error);