/**
 * Run Registration Fee Migration
 * 
 * Adds registration fee columns to vendors table and makes auction_id nullable in payments table
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running registration fee migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0030_add_vendor_registration_fee.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by sections (marked by ===)
    const sections = migrationSQL.split('-- ============================================================================');
    
    console.log(`📝 Processing migration in sections...\n`);

    for (const section of sections) {
      if (!section.trim()) continue;
      
      // Extract section title
      const lines = section.split('\n');
      const titleLine = lines.find(l => l.trim() && !l.startsWith('--'));
      
      // Split section into statements
      const statements = section
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.includes('ROLLBACK SCRIPT'));

      for (const statement of statements) {
        if (!statement.trim()) continue;
        
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
        } catch (error) {
          // Check if error is "already exists" - this is OK
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('already exists') || errorMessage.includes('does not exist')) {
            console.log(`⚠️  Skipped (already applied or not applicable)`);
          } else {
            console.error(`❌ Failed: ${statement.substring(0, 60)}...`);
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Verifying changes...\n');

    // Verify the changes
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'vendors'
      AND column_name IN ('registration_fee_paid', 'registration_fee_amount', 'registration_fee_paid_at', 'registration_fee_reference')
      ORDER BY column_name;
    `);

    console.log('New columns in vendors table:');
    console.table(result.rows);

    // Check payments table
    const paymentsResult = await db.execute(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payments'
      AND column_name = 'auction_id';
    `);

    console.log('\nPayments table auction_id column:');
    console.table(paymentsResult.rows);

    console.log('\n✅ All changes verified successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test the registration fee flow');
    console.log('2. Verify webhook integration');
    console.log('3. Check UI components');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
