/**
 * Debug Redis cache storage format
 */

import 'dotenv/config';
import { redis } from '@/lib/redis/client';

async function debugRedisCache() {
  console.log('🔍 Debugging Redis Cache Storage\n');

  try {
    // Clear old cache
    console.log('1️⃣ Clearing old cache...');
    await redis.del('autocomplete:makes');
    console.log('   ✅ Cleared\n');

    // Test different storage methods
    console.log('2️⃣ Testing storage methods...\n');

    // Method 1: Direct array storage
    console.log('   Method 1: Direct array storage');
    await redis.set('test:array', ['Toyota', 'Honda', 'Lexus'], { ex: 60 });
    const array1 = await redis.get('test:array');
    console.log('   Stored:', ['Toyota', 'Honda', 'Lexus']);
    console.log('   Retrieved:', array1);
    console.log('   Type:', typeof array1);
    console.log();

    // Method 2: JSON.stringify
    console.log('   Method 2: JSON.stringify');
    await redis.set('test:json', JSON.stringify(['Toyota', 'Honda', 'Lexus']), { ex: 60 });
    const json1 = await redis.get('test:json');
    console.log('   Stored:', JSON.stringify(['Toyota', 'Honda', 'Lexus']));
    console.log('   Retrieved:', json1);
    console.log('   Type:', typeof json1);
    if (typeof json1 === 'string') {
      console.log('   Parsed:', JSON.parse(json1));
    }
    console.log();

    // Method 3: What Vercel KV actually does
    console.log('   Method 3: Testing actual behavior');
    const testMakes = ['Toyota', 'Honda', 'Lexus'];
    await redis.set('autocomplete:makes', JSON.stringify(testMakes), { ex: 60 });
    
    // Try different retrieval methods
    const raw = await redis.get('autocomplete:makes');
    console.log('   Raw get():', raw);
    console.log('   Type:', typeof raw);
    
    const typed = await redis.get<string>('autocomplete:makes');
    console.log('   Typed get<string>():', typed);
    console.log('   Type:', typeof typed);
    
    const arrayTyped = await redis.get<string[]>('autocomplete:makes');
    console.log('   Typed get<string[]>():', arrayTyped);
    console.log('   Type:', typeof arrayTyped);
    console.log();

    // Cleanup
    await redis.del('test:array');
    await redis.del('test:json');
    await redis.del('autocomplete:makes');

    console.log('✅ Debug complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugRedisCache()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
