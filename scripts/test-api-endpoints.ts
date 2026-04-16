/**
 * Test Intelligence Dashboard API Endpoints
 * 
 * This script tests the API endpoints to ensure they return data correctly
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name: string, url: string) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`   ❌ Error: ${response.status} - ${data.error || 'Unknown error'}`);
      return false;
    }
    
    if (data.success && data.data) {
      const count = Array.isArray(data.data) ? data.data.length : (data.data.metrics ? 'metrics object' : 'single record');
      console.log(`   ✅ Success: ${count} records`);
      console.log(`   📊 Sample:`, JSON.stringify(data.data[0] || data.data, null, 2).substring(0, 200));
      return true;
    } else {
      console.log(`   ⚠️  No data returned`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Request failed:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Intelligence Dashboard API Endpoints\n');
  console.log('⚠️  Note: This requires the dev server to be running and authentication');
  console.log('   If you see 401 errors, the endpoints are working but need auth\n');
  
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const tests = [
    {
      name: 'Asset Performance',
      url: `${BASE_URL}/api/intelligence/analytics/asset-performance?startDate=${startDate}&endDate=${endDate}`
    },
    {
      name: 'Attribute Performance',
      url: `${BASE_URL}/api/intelligence/analytics/attribute-performance?startDate=${startDate}&endDate=${endDate}`
    },
    {
      name: 'Temporal Patterns',
      url: `${BASE_URL}/api/intelligence/analytics/temporal-patterns?startDate=${startDate}&endDate=${endDate}`
    },
    {
      name: 'Geographic Patterns',
      url: `${BASE_URL}/api/intelligence/analytics/geographic-patterns?startDate=${startDate}&endDate=${endDate}`
    },
    {
      name: 'Vendor Segments',
      url: `${BASE_URL}/api/intelligence/analytics/vendor-segments`
    },
    {
      name: 'Session Metrics',
      url: `${BASE_URL}/api/intelligence/analytics/session-metrics?startDate=${startDate}&endDate=${endDate}`
    },
    {
      name: 'Conversion Funnel',
      url: `${BASE_URL}/api/intelligence/analytics/conversion-funnel?startDate=${startDate}&endDate=${endDate}`
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url);
    if (result) passed++;
    else failed++;
  }
  
  console.log('\n============================================================');
  console.log('📊 SUMMARY');
  console.log('============================================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('\n💡 If you see 401 errors, the APIs are working but require authentication');
  console.log('   Test them in the browser after logging in as admin/manager');
}

main().catch(console.error);
