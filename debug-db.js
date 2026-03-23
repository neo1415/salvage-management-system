import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;
console.log('Database URL:', connectionString ? 'Set' : 'Not set');

const client = postgres(connectionString);
const db = drizzle(client);

async function checkDatabase() {
  try {
    // Check if vehicle_valuations table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicle_valuations'
      );
    `);
    
    console.log('vehicle_valuations table exists:', tableCheck[0]?.exists);
    
    if (tableCheck[0]?.exists) {
      const count = await db.execute(sql`SELECT COUNT(*) FROM vehicle_valuations`);
      console.log('Records in vehicle_valuations:', count[0]?.count);
      
      // Check sample records
      const sample = await db.execute(sql`SELECT make, model, year FROM vehicle_valuations LIMIT 5`);
      console.log('Sample records:', sample);
    }
    
    // Check seed registry
    const seedCount = await db.execute(sql`SELECT COUNT(*) FROM seed_registry WHERE script_name LIKE '%valuations%'`);
    console.log('Valuation seeds in registry:', seedCount[0]?.count);
    
    // Check if SYSTEM_USER exists
    const systemUser = await db.execute(sql`SELECT id, email FROM users WHERE id = '00000000-0000-0000-0000-000000000001'`);
    console.log('System user exists:', systemUser.length > 0);
    if (systemUser.length > 0) {
      console.log('System user:', systemUser[0]);
    }
    
    // Check audit logs for valuation operations
    const auditCount = await db.execute(sql`SELECT COUNT(*) FROM valuation_audit_logs WHERE entity_type = 'valuation'`);
    console.log('Valuation audit log entries:', auditCount[0]?.count);
    
    // Check recent audit logs
    const recentAudits = await db.execute(sql`
      SELECT action, entity_type, entity_id, created_at 
      FROM valuation_audit_logs 
      WHERE entity_type = 'valuation' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('Recent valuation audit logs:', recentAudits);
    
    // Check if any of these entity_ids exist in vehicle_valuations
    if (recentAudits.length > 0) {
      const entityId = recentAudits[0].entity_id;
      const recordExists = await db.execute(sql`
        SELECT id FROM vehicle_valuations WHERE id = ${entityId}
      `);
      console.log(`Record ${entityId} exists in vehicle_valuations:`, recordExists.length > 0);
    }
    
    // Check migration audit log
    const migrationAudit = await db.execute(sql`
      SELECT created_at, changed_fields 
      FROM valuation_audit_logs 
      WHERE entity_type = 'migration' 
      AND changed_fields->'migration'->>'name' = '0009_condition_category_quality_system'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    console.log('Migration 0009 audit log:', migrationAudit);
    
    // Check what condition categories exist in vehicle_valuations
    const conditionCategories = await db.execute(sql`
      SELECT DISTINCT condition_category, COUNT(*) as count
      FROM vehicle_valuations 
      GROUP BY condition_category
      ORDER BY condition_category
    `);
    console.log('Current condition categories in vehicle_valuations:', conditionCategories);
    
    // Check all tables
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\nAll tables:');
    tables.forEach(row => console.log('  -', row.table_name));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkDatabase();