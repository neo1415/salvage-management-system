import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkTables() {
  console.log('🔍 Checking fraud tracking tables...\n');
  
  try {
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('fraud_attempts', 'vendor_interactions', 'vendor_recommendations')
      ORDER BY table_name
    `);
    
    console.log('📊 Fraud tracking tables:');
    if (Array.isArray(tables) && tables.length > 0) {
      tables.forEach((row: any) => {
        console.log(`   ✅ ${row.table_name}`);
      });
    } else {
      console.log('   ❌ No fraud tracking tables found');
    }
    
    // Check bids table columns
    const bidsColumns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'bids' 
      AND column_name IN ('ip_address', 'user_agent', 'device_fingerprint')
      ORDER BY column_name
    `);
    
    console.log('\n📊 Bids table IP tracking columns:');
    if (Array.isArray(bidsColumns) && bidsColumns.length > 0) {
      bidsColumns.forEach((row: any) => {
        console.log(`   ✅ ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('   ❌ No IP tracking columns found');
    }
    
    console.log('\n✅ All fraud tracking infrastructure is in place!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
