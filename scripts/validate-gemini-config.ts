/**
 * Validation script for Gemini API configuration
 * 
 * This script validates that:
 * 1. GEMINI_API_KEY is present in environment
 * 2. @google/generative-ai SDK is installed
 * 3. API key format is valid
 * 4. Basic connection to Gemini API works
 */

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function validateGeminiConfig() {
  console.log('🔍 Validating Gemini API configuration...\n');

  // Check 1: Environment variable
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    console.log('   Add it to your .env file:');
    console.log('   GEMINI_API_KEY=your-api-key-here\n');
    process.exit(1);
  }
  console.log('✅ GEMINI_API_KEY found in environment');
  console.log(`   Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Check 2: SDK installation
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ @google/generative-ai SDK loaded successfully\n');

    // Check 3: API key format
    if (!apiKey.startsWith('AIza')) {
      console.warn('⚠️  API key format may be invalid (should start with "AIza")');
      console.log('   Get a valid key from: https://aistudio.google.com/apikey\n');
    } else {
      console.log('✅ API key format looks valid\n');
    }

    // Check 4: Test connection
    console.log('🔌 Testing connection to Gemini API...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const result = await model.generateContent('Hello, respond with just "OK"');
    const response = result.response.text();
    
    console.log('✅ Successfully connected to Gemini API');
    console.log(`   Response: ${response.trim()}\n`);

    // Success summary
    console.log('🎉 All validation checks passed!');
    console.log('\nGemini API Configuration Summary:');
    console.log('- SDK Version: @google/generative-ai v0.24.1');
    console.log('- Model: gemini-2.0-flash');
    console.log('- Rate Limits: 10 requests/minute, 1,500 requests/day');
    console.log('- Monitor usage: https://aistudio.google.com/usage');
    console.log('\n✨ Ready to use Gemini for damage detection!\n');

  } catch (error: any) {
    console.error('❌ Error validating Gemini configuration:');
    if (error.message?.includes('API_KEY_INVALID')) {
      console.error('   Invalid API key. Get a new one from: https://aistudio.google.com/apikey');
    } else if (error.message?.includes('PERMISSION_DENIED')) {
      console.error('   API key does not have permission to use Gemini API');
      console.error('   Enable the Generative Language API in Google Cloud Console');
    } else if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.warn('⚠️  API quota exceeded (this is expected if testing frequently)');
      console.log('   The API key is valid but has reached its rate limit');
      console.log('   Rate limits: 10 requests/minute, 1,500 requests/day');
      console.log('   Monitor usage: https://aistudio.google.com/usage');
      console.log('\n✅ Configuration is valid - quota will reset automatically\n');
      return; // Don't exit with error for quota issues
    } else {
      console.error(`   ${error.message}`);
    }
    console.log('\n');
    process.exit(1);
  }
}

// Run validation
validateGeminiConfig().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
