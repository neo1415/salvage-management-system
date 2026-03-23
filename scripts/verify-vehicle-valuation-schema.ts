/**
 * Script to verify vehicle valuation schema was created correctly
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function verifySchema() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  try {
    console.log('🔍 Verifying vehicle valuation schema...\n');

    // Check if damage_level enum exists
    const enumCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'damage_level'
      ) as exists
    `;
    console.log(`✅ damage_level enum: ${enumCheck[0].exists ? 'EXISTS' : 'MISSING'}`);

    // Check if vehicle_valuations table exists
    const valuationsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'vehicle_valuations'
      ) as exists
    `;
    console.log(`✅ vehicle_valuations table: ${valuationsCheck[0].exists ? 'EXISTS' : 'MISSING'}`);

    // Check if damage_deductions table exists
    const deductionsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'damage_deductions'
      ) as exists
    `;
    console.log(`✅ damage_deductions table: ${deductionsCheck[0].exists ? 'EXISTS' : 'MISSING'}`);

    // Check if valuation_audit_logs table exists
    const auditLogsCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'valuation_audit_logs'
      ) as exists
    `;
    console.log(`✅ valuation_audit_logs table: ${auditLogsCheck[0].exists ? 'EXISTS' : 'MISSING'}`);

    // Check indexes for vehicle_valuations
    const valuationIndexes = await sql`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'vehicle_valuations'
      ORDER BY indexname
    `;
    console.log(`\n📊 vehicle_valuations indexes (${valuationIndexes.length}):`);
    valuationIndexes.forEach(idx => console.log(`   - ${idx.indexname}`));

    // Check indexes for damage_deductions
    const deductionIndexes = await sql`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'damage_deductions'
      ORDER BY indexname
    `;
    console.log(`\n📊 damage_deductions indexes (${deductionIndexes.length}):`);
    deductionIndexes.forEach(idx => console.log(`   - ${idx.indexname}`));

    // Check indexes for valuation_audit_logs
    const auditIndexes = await sql`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'valuation_audit_logs'
      ORDER BY indexname
    `;
    console.log(`\n📊 valuation_audit_logs indexes (${auditIndexes.length}):`);
    auditIndexes.forEach(idx => console.log(`   - ${idx.indexname}`));

    // Check constraints
    const constraints = await sql`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid IN (
        'vehicle_valuations'::regclass,
        'damage_deductions'::regclass,
        'valuation_audit_logs'::regclass
      )
      ORDER BY conname
    `;
    console.log(`\n🔒 Constraints (${constraints.length}):`);
    constraints.forEach(c => {
      const type = c.contype === 'u' ? 'UNIQUE' : 
                   c.contype === 'f' ? 'FOREIGN KEY' : 
                   c.contype === 'p' ? 'PRIMARY KEY' : c.contype;
      console.log(`   - ${c.conname} (${type})`);
    });

    console.log('\n✅ Schema verification completed successfully!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifySchema();
