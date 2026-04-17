/**
 * Supabase Connection Health Check
 * 
 * Tests database connectivity and query performance
 */

import { config } from 'dotenv';
config();

import { db, checkDatabaseConnection } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function checkConnection() {
  console.log('🔍 Checking Supabase connection...\n');

  // Test 1: Basic health check
  console.log('Test 1: Basic health check');
  const startHealth = Date.now();
  const health = await checkDatabaseConnection();
  const healthTime = Date.now() - startHealth;
  
  if (health.healthy) {
    console.log(`✅ Database is healthy (${healthTime}ms)`);
  } else {
    console.log(`❌ Database health check failed: ${health.error}`);
    process.exit(1);
  }

  // Test 2: Simple query
  console.log('\nTest 2: Simple SELECT query');
  const startSimple = Date.now();
  try {
    const result = await db.select().from(users).limit(1);
    const simpleTime = Date.now() - startSimple;
    console.log(`✅ Simple query successful (${simpleTime}ms)`);
    console.log(`   Found ${result.length} user(s)`);
  } catch (error) {
    const simpleTime = Date.now() - startSimple;
    console.log(`❌ Simple query failed after ${simpleTime}ms:`, error);
  }

  // Test 3: Query with WHERE clause (like the failing query)
  console.log('\nTest 3: Query with WHERE clause');
  const startWhere = Date.now();
  try {
    // Get first user to test with
    const [firstUser] = await db.select().from(users).limit(1);
    
    if (firstUser) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, firstUser.id))
        .limit(1);
      
      const whereTime = Date.now() - startWhere;
      console.log(`✅ WHERE query successful (${whereTime}ms)`);
      console.log(`   Found user: ${user.email}`);
    } else {
      console.log('⚠️  No users in database to test with');
    }
  } catch (error) {
    const whereTime = Date.now() - startWhere;
    console.log(`❌ WHERE query failed after ${whereTime}ms:`, error);
  }

  // Test 4: Multiple concurrent queries
  console.log('\nTest 4: Concurrent queries (simulating load)');
  const startConcurrent = Date.now();
  try {
    const promises = Array(5).fill(null).map(() => 
      db.select().from(users).limit(1)
    );
    
    await Promise.all(promises);
    const concurrentTime = Date.now() - startConcurrent;
    console.log(`✅ 5 concurrent queries successful (${concurrentTime}ms)`);
  } catch (error) {
    const concurrentTime = Date.now() - startConcurrent;
    console.log(`❌ Concurrent queries failed after ${concurrentTime}ms:`, error);
  }

  console.log('\n✅ All connection tests completed');
  process.exit(0);
}

checkConnection().catch((error) => {
  console.error('❌ Connection check failed:', error);
  process.exit(1);
});
