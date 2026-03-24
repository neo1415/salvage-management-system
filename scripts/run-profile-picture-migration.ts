/**
 * Run Profile Picture Migration
 * Adds profile_picture_url column to users table
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Running profile picture migration...');
    
    // Add column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500)
    `);
    console.log('✓ Added profile_picture_url column');
    
    // Add index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_profile_picture 
      ON users(profile_picture_url) 
      WHERE profile_picture_url IS NOT NULL
    `);
    console.log('✓ Created index on profile_picture_url');
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
