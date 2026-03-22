/**
 * Check what data exists in both vehicle_valuations and damage_deductions tables
 * for all makes (Toyota, Audi, Lexus, etc.)
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, sql } from 'drizzle-orm';

async function checkAllMakes() {
  console.log('🔍 Checking data in both tables for all makes...\n');

  try {
    // Get all unique makes from both tables
    const valuationMakes = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations);
    
    const deductionMakes = await db
      .selectDistinct({ make: damageDeductions.make })
      .from(damageDeductions);
    
    const allMakes = new Set([
      ...valuationMakes.map(m => m.make),
      ...deductionMakes.map(m => m.make).filter(m => m !== null)
    ]);

    console.log('📊 VEHICLE VALUATIONS TABLE (Base Prices):');
    console.log('==========================================\n');
    
    for (const make of Array.from(allMakes).sort()) {
      const valuations = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, make));
      
      console.log(`${make}: ${valuations.length} records`);
      if (valuations.length > 0) {
        console.log(`  Sample models: ${valuations.slice(0, 3).map(v => `${v.model} (${v.year})`).join(', ')}`);
      }
      console.log();
    }

    console.log('\n🔧 DAMAGE DEDUCTIONS TABLE (Repair Cost Deductions):');
    console.log('====================================================\n');
    
    for (const make of Array.from(allMakes).sort()) {
      const deductions = await db
        .select()
        .from(damageDeductions)
        .where(eq(damageDeductions.make, make));
      
      console.log(`${make}: ${deductions.length} records`);
      if (deductions.length > 0) {
        console.log(`  Sample components: ${deductions.slice(0, 3).map(d => `${d.component} (${d.damageLevel})`).join(', ')}`);
      }
      console.log();
    }

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('===========\n');
    
    for (const make of Array.from(allMakes).sort()) {
      const valuations = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, make));
      
      const deductions = await db
        .select()
        .from(damageDeductions)
        .where(eq(damageDeductions.make, make));
      
      console.log(`${make}:`);
      console.log(`  ${valuations.length > 0 ? '✓' : '✗'} Vehicle Valuations: ${valuations.length} records`);
      console.log(`  ${deductions.length > 0 ? '✓' : '✗'} Damage Deductions: ${deductions.length} records`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
    process.exit(1);
  }
}

checkAllMakes()
  .then(() => {
    console.log('✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
