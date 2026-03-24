/**
 * Verify Indexes Exist
 * Direct check to see if our indexes were created
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verifyIndexes() {
  console.log('🔍 Verifying index creation...\n');

  try {
    // Check database connection
    console.log('1. Testing database connection...');
    const dbTest = await db.execute(sql.raw('SELECT current_database(), current_schema()'));
    if (dbTest.rows && dbTest.rows.length > 0) {
      console.log('   Database:', (dbTest.rows[0] as any).current_database);
      console.log('   Schema:', (dbTest.rows[0] as any).current_schema);
      console.log('   ✅ Connected\n');
    } else {
      console.log('   ❌ No connection info\n');
      return;
    }

    // Try to use one of the indexes
    console.log('2. Testing if idx_bids_auction_amount works...');
    const testQuery = await db.execute(sql.raw(`
      EXPLAIN (FORMAT JSON) 
      SELECT * FROM bids 
      WHERE auction_id = 'test-id' 
      ORDER BY amount DESC 
      LIMIT 1
    `));
    
    const plan = JSON.stringify(testQuery.rows[0], null, 2);
    console.log('   Query plan:', plan.substring(0, 500));
    
    if (plan.includes('idx_bids_auction_amount')) {
      console.log('   ✅ Index is being used!\n');
    } else {
      console.log('   ⚠️  Index might not be used (could be due to empty table)\n');
    }

    // List all indexes on bids table
    console.log('3. Checking indexes on bids table...');
    const bidsIndexes = await db.execute(sql.raw(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'bids'
    `));
    
    if (bidsIndexes.rows && bidsIndexes.rows.length > 0) {
      console.log(`   Found ${bidsIndexes.rows.length} indexes on bids table:`);
      bidsIndexes.rows.forEach((row: any) => {
        console.log(`   - ${row.indexname}`);
      });
    } else {
      console.log('   ⚠️  No indexes found on bids table');
    }

    // Check all tables
    console.log('\n4. Checking all tables in database...');
    const tables = await db.execute(sql.raw(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = current_schema()
      ORDER BY tablename
    `));
    
    if (tables.rows && tables.rows.length > 0) {
      console.log(`   Found ${tables.rows.length} tables:`);
      tables.rows.slice(0, 10).forEach((row: any) => {
        console.log(`   - ${row.tablename}`);
      });
      if (tables.rows.length > 10) {
        console.log(`   ... and ${tables.rows.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

verifyIndexes()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
