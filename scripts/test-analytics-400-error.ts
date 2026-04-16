/**
 * Test Analytics 400 Error - Capture actual validation error
 */

const testUrl = 'http://localhost:3000/api/intelligence/analytics/asset-performance';
const params = new URLSearchParams({
  startDate: '2026-03-07T23:40:16.150Z',
  endDate: '2026-04-06T23:40:16.150Z'
});

console.log('🧪 Testing Analytics API with exact parameters from browser...\n');
console.log(`URL: ${testUrl}?${params.toString()}\n`);

fetch(`${testUrl}?${params.toString()}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
  .then(async (response) => {
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('\nResponse Body:');
    console.log(text);
    
    try {
      const json = JSON.parse(text);
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('(Not JSON)');
    }
  })
  .catch((error) => {
    console.error('❌ Fetch error:', error);
  });
