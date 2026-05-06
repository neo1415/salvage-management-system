/**
 * Run Tier 0 Migration
 * 
 * Adds 'tier0' to the vendor_tier enum to support vendors without BVN verification
 * 
 * Usage: npx tsx scripts/run-tier0-migration.ts
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting Tier 0 migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0031_add_tier0_to_vendor_tier_enum.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    await db.execute(sql.raw(migrationSQL));
    console.log('✅ Migration executed successfully!\n');

    // Verify the enum values
    console.log('🔍 Verifying enum values...');
    const result = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'vendor_tier'
      )
      ORDER BY enumsortorder;
    `);

    console.log('✅ Current vendor_tier enum values:');
    if (result && Array.isArray(result)) {
      result.forEach((row: any) => {
        console.log(`   - ${row.enumlabel}`);
      });
    } else {
      console.log('   (Unable to verify - but migration was successful)');
    }

    console.log('\n✅ Tier 0 migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Navigate to /manager/vendors');
    console.log('   3. Click on the "Tier 0" tab');
    console.log('   4. Verify that vendors without BVN can be displayed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
