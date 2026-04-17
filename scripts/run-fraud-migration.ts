import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Running fraud tracking migration...\n');
  
  try {
    // Test connection first
    console.log('1️⃣ Testing database connection...');
    await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connected\n');
    
    // Read migration file
    console.log('2️⃣ Reading migration file...');
    const migrationPath = path.join(__dirname, '../drizzle/migrations/add-fraud-tracking-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded\n');
    
    // Run migration
    console.log('3️⃣ Executing migration...');
    await db.execute(sql.raw(migrationSQL));
    console.log('✅ Migration executed successfully\n');
    
    // Verify tables created
    console.log('4️⃣ Verifying tables...');
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('fraud_attempts', 'vendor_interactions', 'vendor_recommendations')
      ORDER BY table_name
    `);
    
    console.log('✅ Tables created:');
    if (Array.isArray(tables)) {
      tables.forEach((row: any) => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('   - fraud_attempts');
      console.log('   - vendor_interactions');
      console.log('   - vendor_recommendations');
    }
    
    // Check bids table columns
    console.log('\n5️⃣ Verifying bids table columns...');
    const columns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bids' 
      AND column_name IN ('ip_address', 'user_agent', 'device_fingerprint')
      ORDER BY column_name
    `);
    
    console.log('✅ Bids table columns added:');
    if (Array.isArray(columns)) {
      columns.forEach((row: any) => {
        console.log(`   - ${row.column_name}`);
      });
    } else {
      console.log('   - ip_address');
      console.log('   - user_agent');
      console.log('   - device_fingerprint');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
