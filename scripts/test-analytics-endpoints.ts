/**
 * Test Analytics Endpoints
 * 
 * Tests all 7 analytics endpoints to verify they're working after fixing
 * the deprecated .datetime() validation issue.
 */

const BASE_URL = 'http://localhost:3000';

// Test dates (last 30 days)
const endDate = new Date().toISOString();
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const endpoints = [
  {
    name: 'Asset Performance',
    url: `/api/intelligence/analytics/asset-performance?startDate=${startDate}&endDate=${endDate}`,
  },
  {
    name: 'Attribute Performance',
    url: `/api/intelligence/analytics/attribute-performance?startDate=${startDate}&endDate=${endDate}`,
  },
  {
    name: 'Temporal Patterns',
    url: `/api/intelligence/analytics/temporal-patterns?startDate=${startDate}&endDate=${endDate}`,
  },
  {
    name: 'Geographic Patterns',
    url: `/api/intelligence/analytics/geographic-patterns?startDate=${startDate}&endDate=${endDate}`,
  },
  {
    name: 'Vendor Segments',
    url: `/api/intelligence/analytics/vendor-segments`,
  },
  {
    name: 'Conversion Funnel',
    url: `/api/intelligence/analytics/conversion-funnel?startDate=${startDate}&endDate=${endDate}`,
  },
  {
    name: 'Session Metrics',
    url: `/api/intelligence/analytics/session-metrics?startDate=${startDate}&endDate=${endDate}`,
  },
];

async function testEndpoints() {
  console.log('🧪 Testing Analytics Endpoints\n');
  console.log(`Date Range: ${startDate.split('T')[0]} to ${endDate.split('T')[0]}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint.url}`, {
        credentials: 'include', // Include cookies for authentication
      });

      const status = response.status;
      const statusText = response.statusText;

      if (status === 200) {
        const data = await response.json();
        const hasData = data.data && (Array.isArray(data.data) ? data.data.length > 0 : data.data !== null);
        const count = Array.isArray(data.data) ? data.data.length : (data.data ? 1 : 0);

        console.log(`✅ ${endpoint.name}`);
        console.log(`   Status: ${status} ${statusText}`);
        console.log(`   Has Data: ${hasData ? 'Yes' : 'No'}`);
        console.log(`   Count: ${count}`);
        successCount++;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.log(`❌ ${endpoint.name}`);
        console.log(`   Status: ${status} ${statusText}`);
        console.log(`   Error: ${JSON.stringify(errorData, null, 2)}`);
        failCount++;
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${endpoint.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('');
      failCount++;
    }
  }

  console.log('\n📊 Summary');
  console.log(`   Total: ${endpoints.length}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All endpoints are working!');
  } else {
    console.log('\n⚠️  Some endpoints failed. Check the errors above.');
  }
}

testEndpoints().catch(console.error);
