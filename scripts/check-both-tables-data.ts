/**
 * Check what data exists in both vehicle_valuations and damage_deductions tables
 * for Toyota and Audi
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, sql } from 'drizzle-orm';

async function checkBothTables() {
  console.log('🔍 Checking data in both tables for Toyota and Audi...\n');

  try {
    // Check vehicle_valuations table
    console.log('📊 VEHICLE VALUATIONS TABLE (Base Prices):');
    console.log('==========================================\n');
    
    const toyotaValuations = await db
      .select()
      .from(vehicleValuations)
      .where(eq(vehicleValuations.make, 'Toyota'));
    
    const audiValuations = await db
      .select()
      .from(vehicleValuations)
      .where(eq(vehicleValuations.make, 'Audi'));
    
    console.log(`Toyota vehicle valuations: ${toyotaValuations.length} records`);
    if (toyotaValuations.length > 0) {
      console.log('Sample Toyota models:', toyotaValuations.slice(0, 5).map(v => `${v.model} (${v.year})`).join(', '));
    }
    
    console.log(`\nAudi vehicle valuations: ${audiValuations.length} records`);
    if (audiValuations.length > 0) {
      console.log('Sample Audi models:', audiValuations.slice(0, 5).map(v => `${v.model} (${v.year})`).join(', '));
    }

    // Check damage_deductions table
    console.log('\n\n🔧 DAMAGE DEDUCTIONS TABLE (Repair Cost Deductions):');
    console.log('====================================================\n');
    
    const toyotaDeductions = await db
      .select()
      .from(damageDeductions)
      .where(eq(damageDeductions.make, 'Toyota'));
    
    const audiDeductions = await db
      .select()
      .from(damageDeductions)
      .where(eq(damageDeductions.make, 'Audi'));
    
    console.log(`Toyota damage deductions: ${toyotaDeductions.length} records`);
    if (toyotaDeductions.length > 0) {
      console.log('Sample Toyota components:', toyotaDeductions.slice(0, 5).map(d => `${d.component} (${d.damageLevel})`).join(', '));
    }
    
    console.log(`\nAudi damage deductions: ${audiDeductions.length} records`);
    if (audiDeductions.length > 0) {
      console.log('Sample Audi components:', audiDeductions.slice(0, 5).map(d => `${d.component} (${d.damageLevel})`).join(', '));
    }

    // Summary
    console.log('\n\n📋 SUMMARY:');
    console.log('===========\n');
    console.log('Toyota:');
    console.log(`  ✓ Vehicle Valuations (base prices): ${toyotaValuations.length} records`);
    console.log(`  ${toyotaDeductions.length > 0 ? '✓' : '✗'} Damage Deductions: ${toyotaDeductions.length} records`);
    
    console.log('\nAudi:');
    console.log(`  ${audiValuations.length > 0 ? '✓' : '✗'} Vehicle Valuations (base prices): ${audiValuations.length} records`);
    console.log(`  ✓ Damage Deductions: ${audiDeductions.length} records`);

    console.log('\n\n🎯 WHAT\'S NEEDED:');
    console.log('=================\n');
    
    if (toyotaDeductions.length === 0) {
      console.log('❌ Toyota damage deductions are MISSING - need to import');
    } else {
      console.log('✅ Toyota damage deductions exist');
    }
    
    if (audiValuations.length === 0) {
      console.log('❌ Audi vehicle valuations are MISSING - need to import');
    } else {
      console.log('✅ Audi vehicle valuations exist');
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  }
}

checkBothTables()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
