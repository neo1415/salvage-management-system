#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { serperApi } from '@/lib/integrations/serper-api';

async function testSerperApiDirect() {
  console.log('🧪 Testing Serper API Directly...\n');

  console.log('🔑 API Key:', process.env.SERPER_API_KEY ? `${process.env.SERPER_API_KEY.substring(0, 8)}...` : 'NOT SET');
  console.log('');

  try {
    console.log('🌐 Testing simple query: "Toyota Camry price Nigeria"');
    
    const result = await serperApi.search('Toyota Camry price Nigeria', {
      num: 5,
      gl: 'ng'
    });

    console.log('✅ API Response:', {
      success: !!result.organic,
      organicResults: result.organic?.length || 0,
      credits: result.credits,
      searchInformation: result.searchInformation
    });

    if (result.organic && result.organic.length > 0) {
      console.log('\n📋 First 3 Results:');
      result.organic.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title}`);
        console.log(`     ${item.link}`);
        console.log(`     ${item.snippet}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ API Test failed:', error);
  }
}

testSerperApiDirect().catch(console.error);