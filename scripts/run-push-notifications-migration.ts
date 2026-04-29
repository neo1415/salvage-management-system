/**
 * Run Push Notifications Migration
 * 
 * This script runs the migration to add push subscriptions and notification preferences tables.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running push notifications migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0031_add_push_subscriptions.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      await db.execute(sql.raw(statement));
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - push_subscriptions');
    console.log('  - notification_preferences');
    console.log('\nDefault preferences created for all existing users.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
