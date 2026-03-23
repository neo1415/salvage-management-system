/**
 * Migration Script: 0016 - Add Release Forms and Document Management System
 * 
 * Creates release_forms and document_downloads tables for legal document management.
 * Supports bill of sale, liability waivers, pickup authorizations, and salvage certificates.
 * 
 * Usage: npx tsx scripts/run-migration-0016.ts
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting migration 0016: Add Release Forms and Document Management System...\n');

  try {
    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0016_add_release_forms_documents.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Execute migration
    console.log('📝 Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!\n');

    // Verify table creation
    console.log('🔍 Verifying release_forms table...');
    const releaseFormsResult = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'release_forms'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Release Forms table structure:');
    console.table(releaseFormsResult.rows);

    console.log('\n🔍 Verifying document_downloads table...');
    const downloadsResult = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'document_downloads'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Document Downloads table structure:');
    console.table(downloadsResult.rows);

    // Verify indexes
    console.log('\n🔍 Verifying indexes...');
    const indexes = await db.execute(sql`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('release_forms', 'document_downloads')
      ORDER BY tablename, indexname;
    `);

    console.log('\n📊 Indexes created:');
    console.table(indexes.rows);

    // Verify enums
    console.log('\n🔍 Verifying enums...');
    const enums = await db.execute(sql`
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname IN ('document_type', 'document_status')
      ORDER BY t.typname, e.enumsortorder;
    `);

    console.log('\n📊 Enums created:');
    console.table(enums.rows);

    console.log('\n✅ Migration 0016 verification complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Install required packages: npm install jspdf qrcode react-signature-canvas');
    console.log('2. Create document service (src/features/documents/services/document.service.ts)');
    console.log('3. Create signature service (src/features/documents/services/signature.service.ts)');
    console.log('4. Create API endpoints');
    console.log('5. Create UI components');
    console.log('6. Integrate into auction flow');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
