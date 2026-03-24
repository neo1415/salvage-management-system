/**
 * List All Indexes
 * Simple script to see what indexes exist in the database
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function listAllIndexes() {
  console.log('📊 Listing all indexes in the database...\n');

  try {
    // Try different queries to find indexes
    console.log('Method 1: pg_indexes view (all schemas)\n');
    const indexes1 = await db.execute(sql.raw(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
      LIMIT 20
    `));

    if (indexes1.rows && indexes1.rows.length > 0) {
      console.log(`Found ${indexes1.rows.length} custom indexes:\n`);
      console.table(indexes1.rows);
    } else {
      console.log('No custom indexes found in pg_indexes\n');
    }

    console.log('\nMethod 2: pg_stat_user_indexes view\n');
    const indexes2 = await db.execute(sql.raw(`
      SELECT *
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      LIMIT 5
    `));

    if (indexes2.rows && indexes2.rows.length > 0) {
      console.log('Sample pg_stat_user_indexes columns:');
      console.log(Object.keys(indexes2.rows[0]));
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

listAllIndexes()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
