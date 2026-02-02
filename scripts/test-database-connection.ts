import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test simple query
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✓ Simple query successful:', result);
    
    // Test users table
    const userCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    console.log('✓ Users table accessible, count:', userCount[0].count);
    
    console.log('\n✓ Database connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Database connection failed:', error);
    process.exit(1);
  }
}

testDatabase();
