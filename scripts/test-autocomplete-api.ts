/**
 * Test autocomplete API endpoint and Redis connection
 */

import 'dotenv/config';

async function testAutocompleteAPI() {
  console.log('🧪 Testing Autocomplete API and Redis Connection\n');

  try {
    // Test 1: Check Redis connection
    console.log('1️⃣ Testing Redis/KV connection...');
    const { redis } = await import('@/lib/redis/client');
    
    try {
      await redis.set('test:connection', 'ok', { ex: 10 });
      const value = await redis.get('test:connection');
      console.log(`   ✅ Redis connected: ${value === 'ok' ? 'OK' : 'FAILED'}`);
      await redis.del('test:connection');
    } catch (error) {
      console.error('   ❌ Redis connection failed:', error);
    }

    // Test 2: Check database connection
    console.log('\n2️⃣ Testing database connection...');
    const { db } = await import('@/lib/db/drizzle');
    const { vehicleValuations } = await import('@/lib/db/schema/vehicle-valuations');
    
    const result = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make);
    
    console.log(`   ✅ Database connected: ${result.length} makes found`);
    console.log(`   Makes: ${result.map(r => r.make).join(', ')}`);

    // Test 3: Test autocomplete cache
    console.log('\n3️⃣ Testing autocomplete cache...');
    const { autocompleteCache } = await import('@/lib/cache/autocomplete-cache');
    
    try {
      // Clear cache first
      console.log('   Clearing cache...');
      await autocompleteCache.clearAll();
      
      // Test getMakes (should be null)
      const cachedMakes = await autocompleteCache.getMakes();
      console.log(`   Cache before set: ${cachedMakes === null ? 'Empty (OK)' : 'Has data (unexpected)'}`);
      
      // Test setMakes
      const testMakes = ['Toyota', 'Honda', 'Lexus'];
      await autocompleteCache.setMakes(testMakes);
      console.log('   ✅ Set makes in cache');
      
      // Test getMakes again
      const retrievedMakes = await autocompleteCache.getMakes();
      console.log(`   Retrieved from cache: ${retrievedMakes ? retrievedMakes.join(', ') : 'null'}`);
      
      if (retrievedMakes && retrievedMakes.length === testMakes.length) {
        console.log('   ✅ Cache working correctly');
      } else {
        console.log('   ❌ Cache not working as expected');
      }
    } catch (error) {
      console.error('   ❌ Cache test failed:', error);
    }

    // Test 4: Simulate API endpoint logic
    console.log('\n4️⃣ Simulating /api/valuations/makes endpoint...');
    const startTime = Date.now();
    
    try {
      // Check cache
      const cachedMakes = await autocompleteCache.getMakes();
      
      if (cachedMakes) {
        const responseTime = Date.now() - startTime;
        console.log(`   ✅ Cache HIT - Response time: ${responseTime}ms`);
        console.log(`   Makes: ${cachedMakes.join(', ')}`);
      } else {
        console.log('   Cache MISS - Querying database...');
        
        const result = await db
          .selectDistinct({ make: vehicleValuations.make })
          .from(vehicleValuations)
          .orderBy(vehicleValuations.make);
        
        const makes = result.map((row) => row.make);
        
        // Cache the results
        await autocompleteCache.setMakes(makes);
        
        const responseTime = Date.now() - startTime;
        console.log(`   ✅ Database query - Response time: ${responseTime}ms`);
        console.log(`   Makes: ${makes.join(', ')}`);
        
        if (responseTime > 500) {
          console.warn(`   ⚠️ SLOW RESPONSE - Exceeded 500ms threshold`);
        }
      }
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`   ❌ Endpoint simulation failed (${errorTime}ms):`, error);
    }

    console.log('\n✅ All tests complete!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testAutocompleteAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
