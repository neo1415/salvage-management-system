import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running migration: Make auction_id nullable in payments table...');

    // Read the migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0031_make_auction_id_nullable_in_payments.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!');
    console.log('   - auction_id column in payments table is now nullable');
    console.log('   - Registration fee payments can now be created without an auction_id');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
