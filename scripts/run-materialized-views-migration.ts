/**
 * Run only the materialized views migration
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running Materialized Views Migration\n');
  console.log('='.repeat(60));
  
  try {
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0025_add_intelligence_materialized_views.sql'
    );
    
    console.log('📄 Reading migration file...');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('⚙️  Executing migration...\n');
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify
    console.log('🔍 Verifying materialized views...');
    const views = await db.execute(sql`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public' 
      AND matviewname IN ('vendor_bidding_patterns_mv', 'market_conditions_mv')
      ORDER BY matviewname
    `);
    const viewRows = Array.isArray(views) ? views : views.rows || [];
    console.log(`   Found ${viewRows.length}/2:`, viewRows.map((r: any) => r.matviewname).join(', '));
    
    if (viewRows.length === 2) {
      console.log('\n✅ All materialized views created successfully!');
    } else {
      console.log('\n⚠️  Some materialized views are missing');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();
