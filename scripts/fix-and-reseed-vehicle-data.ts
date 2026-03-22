/**
 * Fix Vehicle Data Seeding Issue
 * 
 * Problem: Seed scripts use old condition categories (nig_used_low, tokunbo_low)
 * but migration 0009 converted them to new 4-tier system (excellent, good, fair, poor)
 * 
 * Solution: Update all seed scripts and re-run them with correct categories
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function fixAndReseedVehicleData() {
  console.log('🔧 FIXING VEHICLE DATA SEEDING ISSUE');
  console.log('='.repeat(60));
  
  try {
    // 1. Clear existing vehicle valuations (they're empty anyway)
    console.log('1️⃣ Clearing existing vehicle valuations...');
    await db.execute(sql`DELETE FROM vehicle_valuations`);
    console.log('✅ Cleared vehicle_valuations table');
    
    // 2. Clear seed registry for valuation scripts so they can re-run
    console.log('\n2️⃣ Clearing seed registry for valuation scripts...');
    const valuationScripts = [
      'toyota-valuations',
      'mercedes-valuations', 
      'audi-valuations',
      'hyundai-valuations',
      'kia-valuations',
      'lexus-valuations',
      'nissan-valuations'
    ];
    
    for (const script of valuationScripts) {
      await db.execute(sql`DELETE FROM seed_registry WHERE script_name = ${script}`);
      console.log(`   ✅ Cleared registry for ${script}`);
    }
    
    console.log('\n3️⃣ Now run the updated seed scripts...');
    console.log('   Run: npx tsx scripts/seeds/run-all-seeds.ts');
    console.log('\n✅ Fix preparation complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAndReseedVehicleData();