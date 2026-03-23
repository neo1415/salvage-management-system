import { config } from 'dotenv';
config();

import { serperApi } from '../src/lib/integrations/serper-api';

async function testSerperApiDirectly() {
  console.log('🌐 Testing Serper API directly...');
  
  const query = "Lamborghini Revuelto 2023 supercar luxury brand new price Nigeria";
  
  try {
    console.log(`Query: "${query}"`);
    
    const result = await serperApi.search(query, { num: 10 });
    
    console.log('API Response:');
    console.log('- Success:', result.success);
    console.log('- Error:', result.error);
    console.log('- Organic results:', result.organic?.length || 0);
    console.log('- Credits used:', result.creditsUsed);
    console.log('- Response time:', result.responseTime);
    
    if (result.organic && result.organic.length > 0) {
      console.log('\n📊 First few results:');
      result.organic.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Snippet: ${item.snippet.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('❌ No organic results returned');
    }
    
    // Check if there are any API errors or rate limiting
    if (!result.success) {
      console.log('❌ API call failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Exception during API call:', error);
  }
}

testSerperApiDirectly().catch(console.error);