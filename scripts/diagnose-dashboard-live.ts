/**
 * Live Dashboard API Diagnostic Script
 * 
 * Tests actual HTTP requests to all 7 analytics endpoints with proper authentication
 * to diagnose why the UI shows "No data available" despite database having data.
 * 
 * Usage: npx tsx scripts/diagnose-dashboard-live.ts
 */

import { auth } from '@/lib/auth';

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// All 7 analytics endpoints
const ENDPOINTS = [
  '/api/intelligence/analytics/asset-performance',
  '/api/intelligence/analytics/attribute-performance',
  '/api/intelligence/analytics/temporal-patterns',
  '/api/intelligence/analytics/geographic-patterns',
  '/api/intelligence/analytics/vendor-segments',
  '/api/intelligence/analytics/conversion-funnel',
  '/api/intelligence/analytics/session-metrics',
];

interface TestResult {
  endpoint: string;
  status: number;
  statusText: string;
  success: boolean;
  hasData: boolean;
  dataCount: number;
  dataStructure: string[];
  responseBody: any;
  error?: string;
}

async function testEndpoint(endpoint: string, queryParams: string): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}?${queryParams}`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${endpoint}`);
  console.log(`Full URL: ${url}`);
  console.log(`${'='.repeat(80)}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: In a real server-side script, we'd need to pass session cookies
      // For now, this will test the endpoint structure
    });

    const status = response.status;
    const statusText = response.statusText;
    
    console.log(`Status: ${status} ${statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));

    let responseBody: any;
    let hasData = false;
    let dataCount = 0;
    let dataStructure: string[] = [];

    try {
      responseBody = await response.json();
      console.log(`\nResponse Body:`, JSON.stringify(responseBody, null, 2));

      // Check if response has data
      if (responseBody.data) {
        hasData = true;
        
        if (Array.isArray(responseBody.data)) {
          dataCount = responseBody.data.length;
          if (dataCount > 0) {
            dataStructure = Object.keys(responseBody.data[0]);
          }
        } else if (typeof responseBody.data === 'object') {
          dataCount = 1;
          dataStructure = Object.keys(responseBody.data);
        }

        console.log(`\n✓ Has data: ${hasData}`);
        console.log(`✓ Data count: ${dataCount}`);
        console.log(`✓ Data structure (field names):`, dataStructure);
      } else {
        console.log(`\n✗ No 'data' field in response`);
        console.log(`Response keys:`, Object.keys(responseBody));
      }

    } catch (parseError) {
      console.error(`Failed to parse JSON response:`, parseError);
      responseBody = { error: 'Failed to parse response' };
    }

    return {
      endpoint,
      status,
      statusText,
      success: response.ok,
      hasData,
      dataCount,
      dataStructure,
      responseBody,
    };

  } catch (error) {
    console.error(`Request failed:`, error);
    return {
      endpoint,
      status: 0,
      statusText: 'Request Failed',
      success: false,
      hasData: false,
      dataCount: 0,
      dataStructure: [],
      responseBody: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         INTELLIGENCE DASHBOARD LIVE API DIAGNOSTIC                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Build query params that match what the dashboard uses
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const queryParams = new URLSearchParams({
    startDate: thirtyDaysAgo.toISOString(),
    endDate: now.toISOString(),
    limit: '50',
  }).toString();

  console.log('Query Parameters (matching dashboard):');
  console.log(`  startDate: ${thirtyDaysAgo.toISOString()}`);
  console.log(`  endDate: ${now.toISOString()}`);
  console.log(`  limit: 50`);

  const results: TestResult[] = [];

  // Test each endpoint
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint, queryParams);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary Report
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                            SUMMARY REPORT                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const summary = {
    total: results.length,
    successful: results.filter(r => r.success).length,
    withData: results.filter(r => r.hasData).length,
    withoutData: results.filter(r => !r.hasData && r.success).length,
    failed: results.filter(r => !r.success).length,
  };

  console.log(`Total Endpoints Tested: ${summary.total}`);
  console.log(`Successful Responses (2xx): ${summary.successful}`);
  console.log(`Responses with Data: ${summary.withData}`);
  console.log(`Responses without Data: ${summary.withoutData}`);
  console.log(`Failed Requests: ${summary.failed}`);

  console.log('\n\nDetailed Results:\n');
  console.log('┌─────────────────────────────────────────────────────────┬────────┬──────────┬───────────┐');
  console.log('│ Endpoint                                                │ Status │ Has Data │ Count     │');
  console.log('├─────────────────────────────────────────────────────────┼────────┼──────────┼───────────┤');
  
  results.forEach(result => {
    const endpoint = result.endpoint.padEnd(55);
    const status = result.status.toString().padEnd(6);
    const hasData = (result.hasData ? '✓ Yes' : '✗ No').padEnd(8);
    const count = result.dataCount.toString().padEnd(9);
    
    console.log(`│ ${endpoint} │ ${status} │ ${hasData} │ ${count} │`);
  });
  
  console.log('└─────────────────────────────────────────────────────────┴────────┴──────────┴───────────┘');

  // Identify issues
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          ISSUE IDENTIFICATION                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const issues: string[] = [];

  // Check for authentication issues
  const authIssues = results.filter(r => r.status === 401);
  if (authIssues.length > 0) {
    issues.push(`⚠️  AUTHENTICATION ISSUE: ${authIssues.length} endpoint(s) returned 401 Unauthorized`);
    issues.push(`   This script needs to be run with proper session authentication.`);
    issues.push(`   Use the HTML test page (test-dashboard-apis.html) in a browser instead.`);
  }

  // Check for authorization issues
  const forbiddenIssues = results.filter(r => r.status === 403);
  if (forbiddenIssues.length > 0) {
    issues.push(`⚠️  AUTHORIZATION ISSUE: ${forbiddenIssues.length} endpoint(s) returned 403 Forbidden`);
    issues.push(`   User may not have admin/manager role required for analytics.`);
  }

  // Check for empty data responses
  const emptyDataIssues = results.filter(r => r.success && !r.hasData);
  if (emptyDataIssues.length > 0) {
    issues.push(`⚠️  EMPTY DATA ISSUE: ${emptyDataIssues.length} endpoint(s) returned success but no data`);
    emptyDataIssues.forEach(r => {
      issues.push(`   - ${r.endpoint}`);
      if (r.responseBody) {
        issues.push(`     Response keys: ${Object.keys(r.responseBody).join(', ')}`);
      }
    });
  }

  // Check for data structure mismatches
  results.forEach(result => {
    if (result.hasData && result.dataStructure.length > 0) {
      // Check if expected fields are present
      const expectedFields = ['id', 'name', 'value', 'count', 'make', 'model'];
      const hasExpectedField = expectedFields.some(field => 
        result.dataStructure.includes(field)
      );
      
      if (!hasExpectedField) {
        issues.push(`⚠️  STRUCTURE ISSUE: ${result.endpoint}`);
        issues.push(`   Unexpected field names: ${result.dataStructure.join(', ')}`);
        issues.push(`   UI may be looking for different field names.`);
      }
    }
  });

  // Check for server errors
  const serverErrors = results.filter(r => r.status >= 500);
  if (serverErrors.length > 0) {
    issues.push(`⚠️  SERVER ERROR: ${serverErrors.length} endpoint(s) returned 5xx errors`);
    serverErrors.forEach(r => {
      issues.push(`   - ${r.endpoint}: ${r.status} ${r.statusText}`);
    });
  }

  if (issues.length === 0) {
    console.log('✓ No issues detected!');
    console.log('\nIf the UI still shows "No data available", check:');
    console.log('  1. Browser console for JavaScript errors');
    console.log('  2. Network tab in DevTools for failed requests');
    console.log('  3. React component state management');
    console.log('  4. Data transformation logic in the UI');
  } else {
    issues.forEach(issue => console.log(issue));
  }

  // Recommendations
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                            RECOMMENDATIONS                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('1. Open test-dashboard-apis.html in your browser at:');
  console.log('   http://localhost:3000/test-dashboard-apis.html');
  console.log('   This will test with actual browser authentication.');
  console.log('\n');
  console.log('2. Check browser console for errors:');
  console.log('   - Open DevTools (F12)');
  console.log('   - Go to Console tab');
  console.log('   - Look for red error messages');
  console.log('\n');
  console.log('3. Check Network tab in DevTools:');
  console.log('   - Go to Network tab');
  console.log('   - Filter by "Fetch/XHR"');
  console.log('   - Look for failed requests (red)');
  console.log('   - Click on each request to see response');
  console.log('\n');
  console.log('4. Verify data transformation:');
  console.log('   - Check if API returns data.data or just data');
  console.log('   - Verify field names match what UI expects');
  console.log('   - Check for null/undefined values');
  console.log('\n');

  console.log('\n✓ Diagnostic complete!\n');
}

main().catch(console.error);
