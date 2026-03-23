import { redis } from '@/lib/redis/client';

async function testRedis() {
  try {
    console.log('Testing Redis connection...');
    
    // Test set
    await redis.set('test-key', 'test-value', { ex: 60 });
    console.log('✓ Set test key');
    
    // Test get
    const value = await redis.get('test-key');
    console.log('✓ Get test key:', value);
    
    // Test delete
    await redis.del('test-key');
    console.log('✓ Delete test key');
    
    console.log('\n✓ Redis connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Redis connection failed:', error);
    process.exit(1);
  }
}

testRedis();
