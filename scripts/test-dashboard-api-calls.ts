/**
 * Test Dashboard API Calls
 * 
 * This script tests the actual API calls that the dashboard makes
 * to diagnose why data isn't showing up in the UI
 */

async function testDashboardAPIs() {
  console.log('🔍 Testing Intelligence Dashboard API Calls...\n');

  const baseURL = 'http://localhost:3000';
  
  // Build query params like the dashboard does
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const params = new URLSearchParams();
  params.append('startDate', thirtyDaysAgo.toISOString());
  params.append('endDate', now.toISOString());

  const endpoints = [
    `/api/intelligence/analytics/asset-performance?${params.toString()}`,
    `/api/intelligence/analytics/attribute-performance?${params.toString()}`,
    `/api/intelligence/analytics/temporal-patterns?${params.toString()}`,
    `/api/intelligence/analytics/geographic-patterns?${params.toString()}`,
    `/api/intelligence/analytics/vendor-segments?${params.toString()}`,
    `/api/intelligence/analytics/conversion-funnel?${params.toString()}`,
    `/api/intelligence/analytics/session-metrics?${params.toString()}`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint}`);
      
      const response = await fetch(`${baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   Success: ${data.success}`);
        console.log(`   Data length: ${Array.isArray(data.data) ? data.data.length : (data.data ? 'object' : 'null')}`);
        
        if (Array.isArray(data.data) && data.data.length > 0) {
          console.log(`   ✅ First item keys:`, Object.keys(data.data[0]));
        } else if (data.data && typeof data.data === 'object') {
          console.log(`   ✅ Data keys:`, Object.keys(data.data));
        } else {
          console.log(`   ⚠️  No data returned`);
        }
      } else {
        const error = await response.text();
        console.log(`   ❌ Error:`, error);
      }
    } catch (error) {
      console.log(`   ❌ Exception:`, error);
    }
  }

  console.log('\n✅ API test complete');
}

testDashboardAPIs().catch(console.error);
