/**
 * Run the unique constraint migration for release_forms table
 * This prevents duplicate document generation
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running unique constraint migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0026_add_unique_constraint_release_forms.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added unique index: idx_release_forms_unique_document');
    console.log('   - Constraint: (auction_id, vendor_id, document_type)');
    console.log('   - Duplicate documents are now impossible');
    
    process.exit(0);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('✅ Unique constraint already exists - migration already applied');
      process.exit(0);
    }
    
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
