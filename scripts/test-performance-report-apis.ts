/**
 * Test Performance Report APIs
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

async function testAPIs() {
  console.log('=== Testing Performance Report APIs ===\n');

  const startDate = '2026-03-16';
  const endDate = '2026-04-15';

  const reports = [
    {
      name: 'My Performance',
      url: `/api/reports/user-performance/my-performance?startDate=${startDate}&endDate=${endDate}`,
    },
    {
      name: 'Vendor Performance',
      url: `/api/reports/operational/vendor-performance?startDate=${startDate}&endDate=${endDate}`,
    },
    {
      name: 'Auction Performance',
      url: `/api/reports/operational/auction-performance?startDate=${startDate}&endDate=${endDate}`,
    },
  ];

  for (const report of reports) {
    console.log(`\n${report.name}:`);
    console.log(`URL: ${BASE_URL}${report.url}`);
    
    try {
      const response = await fetch(`${BASE_URL}${report.url}`, {
        headers: {
          'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN_HERE',
        },
      });

      console.log(`Status: ${response.status}`);
      
      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

testAPIs()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
