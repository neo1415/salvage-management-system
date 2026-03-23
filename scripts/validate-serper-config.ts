/**
 * Validate Serper.dev API Configuration
 * 
 * This script validates the Serper API setup and tests basic functionality
 */

import 'dotenv/config';
import { serperApi } from '@/lib/integrations/serper-api';

async function validateSerperConfig() {
  console.log('🔍 Validating Serper.dev API Configuration...\n');

  try {
    // 1. Check environment variables
    console.log('1. Checking environment variables...');
    const apiKey = process.env.SERPER_API_KEY;
    const monthlyLimit = process.env.SERPER_RATE_LIMIT_PER_MONTH;
    const minuteLimit = process.env.SERPER_RATE_LIMIT_PER_MINUTE;

    if (!apiKey) {
      throw new Error('SERPER_API_KEY environment variable is missing');
    }
    
    console.log(`   ✅ API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`   ✅ Monthly Limit: ${monthlyLimit || '2500'}`);
    console.log(`   ✅ Minute Limit: ${minuteLimit || '100'}\n`);

    // 2. Test API key validation
    console.log('2. Validating API key...');
    const isValidKey = await serperApi.validateApiKey();
    
    if (!isValidKey) {
      throw new Error('API key validation failed');
    }
    
    console.log('   ✅ API key is valid\n');

    // 3. Test basic search functionality
    console.log('3. Testing basic search functionality...');
    const testResult = await serperApi.searchGoogle('Toyota Camry 2021 price Nigeria', {
      num: 5
    });
    
    console.log(`   ✅ Search successful`);
    console.log(`   📊 Results: ${testResult.organic.length} items`);
    console.log(`   💳 Credits used: ${testResult.credits}`);
    
    // Show sample results
    if (testResult.organic.length > 0) {
      console.log('\n   Sample results:');
      testResult.organic.slice(0, 2).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.title}`);
        console.log(`      ${result.snippet.substring(0, 80)}...`);
        if (result.price) {
          console.log(`      💰 Price: ${result.currency || ''}${result.price}`);
        }
      });
    }

    // 4. Check rate limit status
    console.log('\n4. Checking rate limit status...');
    const rateLimitInfo = serperApi.getRateLimitStatus();
    console.log(`   📈 Monthly usage: ${rateLimitInfo.monthlyUsage}/${rateLimitInfo.monthlyLimit}`);
    console.log(`   ⏱️  Minute usage: ${rateLimitInfo.minuteUsage}/${rateLimitInfo.minuteLimit}`);

    console.log('\n🎉 All validations passed! Serper.dev API is ready to use.');
    
  } catch (error: any) {
    console.error('\n❌ Validation failed:', error.message);
    
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    
    if (error.rateLimited) {
      console.error('   This is a rate limiting issue. Please wait and try again.');
    }
    
    process.exit(1);
  }
}

// Run validation
validateSerperConfig().catch(console.error);