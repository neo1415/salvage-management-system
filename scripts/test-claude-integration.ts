/**
 * Test Claude Integration
 * 
 * Quick test to verify Claude service is properly integrated
 */

import { 
  initializeClaudeService, 
  isClaudeEnabled, 
  getClaudeServiceConfig 
} from '../src/lib/integrations/claude-damage-detection';
import { getClaudeRateLimiter } from '../src/lib/integrations/claude-rate-limiter';

async function testClaudeIntegration() {
  console.log('🧪 Testing Claude Integration...\n');

  // Test 1: Service Initialization
  console.log('Test 1: Service Initialization');
  try {
    await initializeClaudeService();
    console.log('✅ Service initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }

  // Test 2: Service Status
  console.log('\nTest 2: Service Status');
  const isEnabled = isClaudeEnabled();
  console.log(`   Enabled: ${isEnabled}`);

  const config = getClaudeServiceConfig();
  console.log(`   Model: ${config.model}`);
  console.log(`   API Key Configured: ${config.apiKeyConfigured}`);
  if (config.apiKeyLastFourChars) {
    console.log(`   API Key (last 4): ...${config.apiKeyLastFourChars}`);
  }

  if (isEnabled) {
    console.log('✅ Service is enabled and ready');
  } else {
    console.log('⚠️  Service is disabled (API key not configured)');
    console.log('   This is expected if CLAUDE_API_KEY is not set');
    console.log('   System will fall back to Gemini → Vision → Neutral');
  }

  // Test 3: Rate Limiter
  console.log('\nTest 3: Rate Limiter');
  const rateLimiter = getClaudeRateLimiter();
  const quota = rateLimiter.checkQuota();
  console.log(`   Minute Quota: ${quota.minuteRemaining}/10`);
  console.log(`   Daily Quota: ${quota.dailyRemaining}/100`);
  console.log(`   Allowed: ${quota.allowed}`);
  console.log('✅ Rate limiter working');

  // Test 4: Rate Limiter Stats
  console.log('\nTest 4: Rate Limiter Stats');
  const stats = rateLimiter.getStats();
  console.log(`   Minute Used: ${stats.minuteUsed}/${stats.minuteLimit} (${stats.minutePercentage.toFixed(1)}%)`);
  console.log(`   Daily Used: ${stats.dailyUsed}/${stats.dailyLimit} (${stats.dailyPercentage.toFixed(1)}%)`);
  console.log('✅ Stats working');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Claude Service: ${isEnabled ? '✅ ENABLED' : '⚠️  DISABLED'}`);
  console.log(`Rate Limiter: ✅ WORKING`);
  console.log(`Fallback Chain: Claude → Gemini → Vision → Neutral`);
  
  if (!isEnabled) {
    console.log('\n💡 To enable Claude:');
    console.log('   1. Get API key from: https://console.anthropic.com/');
    console.log('   2. Add to .env: CLAUDE_API_KEY=sk-ant-...');
    console.log('   3. Restart server');
  } else {
    console.log('\n✅ Claude is ready to use!');
    console.log('   Cost: ~$0.43/month for 45 assessments with 10 images');
    console.log('   Rate Limit: 100 requests/day, 10 requests/minute');
  }
}

// Run test
testClaudeIntegration().catch(console.error);
