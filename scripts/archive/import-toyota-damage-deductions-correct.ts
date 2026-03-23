/**
 * Import Toyota-Specific Damage Deductions - CORRECT DATA
 * Based on the official Toyota Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 10 - DAMAGE DEDUCTION TABLE — Toyota Specific (Nigeria 2025/2026)
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq, and } from 'drizzle-orm';

async function getSystemUserId(): Promise<string> {
  const result = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);
  
  if (result.length === 0) {
    throw new Error('No system_admin user found. Please create a system admin user first.');
  }
  
  return result[0].id;
}

// CORRECT Toyota damage deductions from official guide
const toyotaDamageDeductions = [
  // Front Bumper
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 60000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 160000,
    notes: 'Respray + minor repair. Toyota panel spray: ₦25–50k most workshops. Very affordable.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 380000,
    notes: 'Replace or bond. Genuine Toyota bumper ₦80–180k. Local copy ₦35–80k. Very available.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 900000,
    notes: 'Full replacement. Check airbag sensors. Toyota parts available at Ladipo/Apapa markets.',
  },
  
  // Rear Bumper
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 50000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 130000,
    notes: 'Touch-up/small repair. Rear sensors check. Toyota reverse camera: ₦15–40k replacement.',
  },
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 130000,
    valuationDeductionLow: 140000,
    valuationDeductionHigh: 330000,
    notes: 'Full panel repair. Check boot/trunk alignment.',
  },
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 130000,
    repairCostHigh: 300000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 800000,
    notes: 'Full replacement. Rear impact: check exhaust, tow hitch if fitted.',
  },
  
  // Bonnet/Hood
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 55000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 150000,
    notes: 'Panel beating + respray. Toyota hood paint match easy at Berger market.',
  },
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 140000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 380000,
    notes: 'Multiple dents, possible hinge damage. New hood available easily.',
  },
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 140000,
    repairCostHigh: 320000,
    valuationDeductionLow: 380000,
    valuationDeductionHigh: 1000000,
    notes: 'Usually replaced. Check radiator and fan. Toyota hood replacement widely stocked.',
  },
  
  // Front Wing/Fender
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 50000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 140000,
    notes: 'Pull + paint. Very common road debris impact in Nigeria. Quick fix.',
  },
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 130000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 350000,
    notes: 'Replace panel. Toyota fenders cheapest of all brands in Nigeria.',
  },
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 130000,
    repairCostHigh: 300000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 900000,
    notes: 'Possible chassis impact. Inspect frame rails.',
  },
  
  // Door Panel (per door)
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 45000,
    valuationDeductionHigh: 110000,
    notes: 'Dent pull + spot repair. Nigerian panel beaters very skilled with Toyota.',
  },
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 120000,
    valuationDeductionLow: 130000,
    valuationDeductionHigh: 320000,
    notes: 'Full respray. Check door seal rubber (₦5–15k replacement). Power window motor check.',
  },
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 380000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 1100000,
    notes: 'Full door replacement. Toyota doors widely available in Apapa/Berger markets.',
  },
  
  // Roof Panel
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 100000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 250000,
    notes: 'PDR possible if paint intact. Toyota roofs straightforward to repair.',
  },
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 250000,
    valuationDeductionLow: 280000,
    valuationDeductionHigh: 700000,
    notes: 'Body filler + respray. Sunroof alignment check if fitted.',
  },
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 400000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1500000,
    valuationDeductionHigh: 4000000,
    notes: 'Major structural. A-pillar check critical. May be write-off for older model.',
  },
  
  // Windscreen
  {
    make: 'Toyota',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 10000,
    repairCostHigh: 30000,
    valuationDeductionLow: 30000,
    valuationDeductionHigh: 80000,
    notes: 'Resin injection. Toyota windscreen crack very common from road debris. Quick fix.',
  },
  {
    make: 'Toyota',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 50000,
    repairCostHigh: 180000,
    valuationDeductionLow: 130000,
    valuationDeductionHigh: 450000,
    notes: 'Genuine Toyota glass: ₦100–250k. Local glass: ₦50–120k. Toyota Safety Sense recalib: +₦50k.',
  },
  
  // Side Windows
  {
    make: 'Toyota',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 20000,
    repairCostHigh: 80000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 200000,
    notes: 'Per window. Power regulator: ₦8–20k. Very available Toyota parts.',
  },
  
  // Headlights
  {
    make: 'Toyota',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 45000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 120000,
    notes: 'Polish/restore ₦10–20k. Toyota headlight lens ₦40–80k (local). Projector upgrade popular.',
  },
  {
    make: 'Toyota',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 60000,
    repairCostHigh: 300000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 800000,
    notes: 'Toyota OEM LED headlight affordable vs Audi/BMW. Used from Apapa: ₦50–150k. Widely available.',
  },
  
  // Tail Lights
  {
    make: 'Toyota',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 30000,
    repairCostHigh: 150000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 380000,
    notes: 'Toyota tail lights very affordable. Camry, Corolla, Highlander all well stocked at Ladipo.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Toyota',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 80000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 450000,
    notes: 'Valve cover gasket: ₦10–30k part + labour. Higher deduction = maintenance neglect signal.',
  },
  {
    make: 'Toyota',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 400000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 6000000,
    notes: 'Toyota used engine from Apapa: ₦250k–₦900k. Cheapest in Nigeria. Mechanics skilled with Toyota.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Toyota',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 200000,
    repairCostHigh: 900000,
    valuationDeductionLow: 800000,
    valuationDeductionHigh: 2500000,
    notes: 'Toyota auto trans very reliable. If failing: service at ₦80–200k or rebuild ₦300–800k.',
  },
  {
    make: 'Toyota',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 1800000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 5000000,
    notes: 'Replacement gearbox from Apapa: ₦300k–1.2M. Far cheaper than Audi/BMW equivalent.',
  },
  
  // Suspension (per axle)
  {
    make: 'Toyota',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 180000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 450000,
    notes: 'Toyota shock absorbers: ₦15–60k each (local brands). Monroe/KYB: ₦40–100k. Very available.',
  },
  {
    make: 'Toyota',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 400000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 1000000,
    notes: 'Control arms, tie rods. Toyota parts readily available at all major markets.',
  },
  
  // Interior (seats)
  {
    make: 'Toyota',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 500000,
    notes: 'Fabric re-trim: ₦60–150k. Leather: ₦150–400k. Toyota seat components widely available.',
  },
  
  // Interior (dashboard)
  {
    make: 'Toyota',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 180000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 400000,
    notes: 'Dashboard re-pad: ₦50–150k. Display screen replacement: ₦50–200k depending on model.',
  },
  
  // AC System
  {
    make: 'Toyota',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 500000,
    notes: 'Compressor: ₦80–250k. Condenser: ₦60–180k. Regas: ₦15–40k. Very affordable Toyota AC repairs.',
  },
  
  // Frame/Chassis
  {
    make: 'Toyota',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 300000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 8000000,
    notes: 'Frame straightening. Toyota body shops more experienced with this than any other brand.',
  },
  
  // Mileage Tampering
  {
    make: 'Toyota',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 4000000,
    notes: 'Odometer rolled back. Deduct per true mileage calculation. VIN check recommended. Illegal — common in used market.',
  },
];

async function importCorrectToyotaDamageDeductions() {
  console.log('🔧 Starting CORRECT Toyota damage deductions import...\n');
  console.log('📋 Source: Toyota Nigeria Comprehensive Price & Valuation Guide (Feb 2026)\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    // First, delete all existing Toyota deductions
    console.log('🗑️  Deleting old estimated Toyota deductions...');
    const deleted = await db
      .delete(damageDeductions)
      .where(eq(damageDeductions.make, 'Toyota'));
    console.log(`   ✅ Deleted old records\n`);

    let importedCount = 0;
    let errorCount = 0;

    console.log('📥 Importing correct Toyota deductions from official guide...\n');

    for (const deduction of toyotaDamageDeductions) {
      try {
        await db.insert(damageDeductions).values({
          make: deduction.make,
          component: deduction.component,
          damageLevel: deduction.damageLevel as 'minor' | 'moderate' | 'severe',
          repairCostLow: deduction.repairCostLow.toString(),
          repairCostHigh: deduction.repairCostHigh.toString(),
          valuationDeductionLow: deduction.valuationDeductionLow.toString(),
          valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
          notes: deduction.notes,
          createdBy: systemUserId,
        });
        importedCount++;
        console.log(`   ✅ ${deduction.component} (${deduction.damageLevel})`);
      } catch (error) {
        console.error(`   ❌ Error importing ${deduction.component} (${deduction.damageLevel}):`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`   ✅ Imported: ${importedCount} CORRECT deductions from official guide`);
    console.log(`   ❌ Errors: ${errorCount} deductions`);
    console.log(`   📊 Total processed: ${toyotaDamageDeductions.length} deductions`);
    console.log('\n✅ CORRECT Toyota damage deductions import complete!');
    console.log('📋 All data sourced from official Toyota Nigeria guide (Section 10)');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importCorrectToyotaDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! CORRECT Toyota damage deductions have been imported from official guide.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
