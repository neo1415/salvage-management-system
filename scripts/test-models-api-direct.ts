/**
 * Test models API with different make values
 */

import 'dotenv/config';

async function testModelsAPI() {
  console.log('🧪 Testing Models API Directly\n');
  console.log('='.repeat(80));

  const testMakes = [
    'Audi',
    'Hyundai', 
    'Kia',
    'Lexus',
    'Mercedes-Benz',
    'Nissan',
    'Toyota'
  ];

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  for (const make of testMakes) {
    console.log(`\n📊 Testing: ${make}`);
    console.log('-'.repeat(80));
    
    try {
      const url = `${baseUrl}/api/valuations/models?make=${encodeURIComponent(make)}`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Status: ${response.status}`);
        console.log(`   Models found: ${data.models?.length || 0}`);
        if (data.models && data.models.length > 0) {
          console.log(`   First 3: ${data.models.slice(0, 3).join(', ')}`);
        } else {
          console.log(`   ⚠️ NO MODELS RETURNED!`);
        }
        console.log(`   Cached: ${data.cached}`);
      } else {
        console.log(`❌ Status: ${response.status}`);
        console.log(`   Error: ${data.error || data.message}`);
      }
    } catch (error) {
      console.log(`❌ Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!\n');
}

testModelsAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
