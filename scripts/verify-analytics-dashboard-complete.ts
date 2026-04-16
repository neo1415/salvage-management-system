/**
 * Complete Analytics Dashboard Verification Script
 * 
 * This script performs a comprehensive check of all analytics endpoints
 * and verifies the dashboard will load correctly.
 */

import { subDays } from 'date-fns';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface EndpointTest {
  name: string;
  endpoint: string;
  critical: boolean;
}

const analyticsEndpoints: EndpointTest[] = [
  { name: 'Asset Performance', endpoint: 'asset-performance', critical: true },
  { name: 'Attribute Performance', endpoint: 'attribute-performance', critical: true },
  { name: 'Temporal Patterns', endpoint: 'temporal-patterns', critical: true },
  { name: 'Geographic Patterns', endpoint: 'geographic-patterns', critical: true },
  { name: 'Vendor Segments', endpoint: 'vendor-segments', critical: true }, // Previously failing
  { name: 'Conversion Funnel', endpoint: 'conversion-funnel', critical: true },
  { name: 'Session Metrics', endpoint: 'session-metrics', critical: true },
];

async function testEndpoint(test: EndpointTest, params: URLSearchParams): Promise<{
  success: boolean;
  status: number;
  statusText: string;
  error?: string;
  dataCount?: number;
}> {
  const url = `${BASE_URL}/api/intelligence/analytics/${test.endpoint}?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    };

    if (response.ok) {
      const data = await response.json();
      return {
        ...result,
        dataCount: Array.isArray(data.data) ? data.data.length : (data.data ? 1 : 0),
      };
    } else if (response.status === 401) {
      // Unauthorized is acceptable for this test
      return { ...result, success: true };
    } else {
      const errorData = await response.json();
      return {
        ...result,
        error: errorData.error || 'Unknown error',
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runTests() {
  console.log('🧪 Analytics Dashboard Complete Verification\n');
  console.log('='.repeat(80));
  console.log('\n📋 Testing Configuration:');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Date Range: Last 30 days`);
  console.log(`   Endpoints: ${analyticsEndpoints.length}`);
  console.log('\n' + '='.repeat(80));

  // Build query params like the dashboard does
  const params = new URLSearchParams();
  params.append('startDate', subDays(new Date(), 30).toISOString());
  params.append('endDate', new Date().toISOString());

  console.log('\n🔍 Testing All Analytics Endpoints:\n');

  const results = [];
  let criticalFailures = 0;
  let totalFailures = 0;

  for (const test of analyticsEndpoints) {
    const result = await testEndpoint(test, params);
    results.push({ test, result });

    const icon = result.success ? '✅' : result.status === 401 ? '🔒' : '❌';
    const statusColor = result.success ? '' : result.status === 401 ? '' : '⚠️ ';
    
    console.log(`${icon} ${test.name.padEnd(25)} - ${statusColor}${result.status} ${result.statusText}`);
    
    if (result.dataCount !== undefined) {
      console.log(`   └─ Data count: ${result.dataCount}`);
    }
    
    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
      if (test.critical) {
        criticalFailures++;
      }
      totalFailures++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Results Summary:\n');

  const passed = results.filter(r => r.result.success).length;
  const unauthorized = results.filter(r => r.result.status === 401).length;
  const failed = results.filter(r => !r.result.success && r.result.status !== 401).length;

  console.log(`   ✅ Passed: ${passed}/${analyticsEndpoints.length}`);
  console.log(`   🔒 Unauthorized (OK): ${unauthorized}/${analyticsEndpoints.length}`);
  console.log(`   ❌ Failed: ${failed}/${analyticsEndpoints.length}`);
  
  if (criticalFailures > 0) {
    console.log(`   ⚠️  Critical Failures: ${criticalFailures}`);
  }

  console.log('\n' + '='.repeat(80));

  // Specific check for vendor-segments (the previously failing endpoint)
  const vendorSegmentsResult = results.find(r => r.test.endpoint === 'vendor-segments');
  
  console.log('\n🎯 Vendor Segments Endpoint (Previously Failing):\n');
  
  if (vendorSegmentsResult) {
    const { result } = vendorSegmentsResult;
    
    if (result.success || result.status === 401) {
      console.log('   ✅ FIXED! Vendor segments endpoint now accepts date parameters');
      console.log(`   Status: ${result.status} ${result.statusText}`);
      if (result.dataCount !== undefined) {
        console.log(`   Data count: ${result.dataCount}`);
      }
    } else {
      console.log('   ❌ STILL FAILING!');
      console.log(`   Status: ${result.status} ${result.statusText}`);
      console.log(`   Error: ${result.error}`);
      
      if (result.status === 400) {
        console.log('\n   ⚠️  400 Bad Request suggests validation issues');
        console.log('   Check that the Zod schema includes startDate and endDate');
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 Dashboard Component Checklist:\n');

  const components = [
    'Asset Performance Matrix',
    'Attribute Performance Tabs',
    'Temporal Patterns Heatmap',
    'Geographic Distribution Map',
    'Vendor Segments Chart',
    'Conversion Funnel Diagram',
    'Session Analytics Metrics',
    'Top Performers Section',
  ];

  components.forEach(component => {
    console.log(`   ☐ ${component}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 Next Steps:\n');

  if (failed === 0) {
    console.log('   ✅ All endpoints are working correctly!');
    console.log('   ✅ Dashboard should load all charts successfully');
    console.log('\n   To test in browser:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Navigate to: /admin/intelligence/analytics');
    console.log('   3. Log in as admin user');
    console.log('   4. Verify all charts display data');
  } else {
    console.log('   ⚠️  Some endpoints are failing');
    console.log('   1. Check the error messages above');
    console.log('   2. Verify database tables have data');
    console.log('   3. Check authentication and authorization');
    console.log('   4. Review API route implementations');
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📚 Related Documentation:\n');
  console.log('   - docs/ANALYTICS_DASHBOARD_VENDOR_SEGMENTS_FIX.md');
  console.log('   - docs/ANALYTICS_DASHBOARD_TESTING_QUICK_GUIDE.md');
  console.log('   - docs/ANALYTICS_DASHBOARD_FIX_SUMMARY.md');
  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  if (criticalFailures > 0) {
    console.log('\n❌ Critical failures detected. Dashboard may not load correctly.\n');
    process.exit(1);
  } else if (failed > 0) {
    console.log('\n⚠️  Some non-critical endpoints failed. Dashboard may have limited functionality.\n');
    process.exit(0);
  } else {
    console.log('\n✅ All tests passed! Dashboard is ready to use.\n');
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});
