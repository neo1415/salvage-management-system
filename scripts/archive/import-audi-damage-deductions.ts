/**
 * Import Audi-Specific Damage Deductions
 * Based on the comprehensive Audi Nigeria valuation guide
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

const audiDamageDeductions = [
  // Front Bumper
  {
    make: 'Audi',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 80000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 200000,
    notes: 'Respray + plastic weld. Deduct more than repair cost = labour + inconvenience.',
  },
  {
    make: 'Audi',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 200000,
    valuationDeductionLow: 250000,
    valuationDeductionHigh: 500000,
    notes: 'Replace + paint match. Genuine Audi bumper ₦200–450k, local copy ₦60–120k.',
  },
  {
    make: 'Audi',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 250000,
    repairCostHigh: 500000,
    valuationDeductionLow: 600000,
    valuationDeductionHigh: 1200000,
    notes: 'Full replacement. Airbag deployment likely — inspect crash sensors.',
  },
  
  // Rear Bumper
  {
    make: 'Audi',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 35000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 180000,
    notes: 'Touch-up + small repair. Less structural than front.',
  },
  {
    make: 'Audi',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 180000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 450000,
    notes: 'Panel replacement. Check reverse sensors/camera.',
  },
  {
    make: 'Audi',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 450000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1000000,
    notes: 'Full rear impact check needed. Boot/trunk alignment.',
  },
  
  // Bonnet/Hood
  {
    make: 'Audi',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 200000,
    notes: 'Panel beating + respray. No structural concern.',
  },
  {
    make: 'Audi',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 180000,
    valuationDeductionLow: 220000,
    valuationDeductionHigh: 500000,
    notes: 'Multiple dents, possible hinge damage.',
  },
  {
    make: 'Audi',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 450000,
    valuationDeductionLow: 600000,
    valuationDeductionHigh: 1500000,
    notes: 'Usually replaced. Check radiator/fan damage too.',
  },
  
  // Front Wing/Fender
  {
    make: 'Audi',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 60000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 180000,
    notes: 'Pull + paint. Common road debris impact.',
  },
  {
    make: 'Audi',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 160000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 450000,
    notes: 'Replace panel. Check headlight alignment.',
  },
  {
    make: 'Audi',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 400000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1200000,
    notes: 'Possible chassis rail impact. Structural inspection critical.',
  },
  
  // Door Panel (per door)
  {
    make: 'Audi',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 50000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 150000,
    notes: 'Dent pull + spot repair. Common car park damage.',
  },
  {
    make: 'Audi',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 400000,
    notes: 'Full respray of panel. Check door seal.',
  },
  {
    make: 'Audi',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 500000,
    valuationDeductionLow: 600000,
    valuationDeductionHigh: 1500000,
    notes: 'Door replacement. Check side airbag sensor, hinge integrity.',
  },
  
  // Roof Panel
  {
    make: 'Audi',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 120000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 300000,
    notes: 'PDR (paintless dent repair) if no paint break.',
  },
  {
    make: 'Audi',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 900000,
    notes: 'Body filler + full respray. Sunroof check if equipped.',
  },
  {
    make: 'Audi',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 1500000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 5000000,
    notes: 'Major structural. A-pillar check. May be write-off territory.',
  },
  
  // Windscreen
  {
    make: 'Audi',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 100000,
    notes: 'Resin injection. Windscreen ADAS recalibration needed (newer Audis).',
  },
  {
    make: 'Audi',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 80000,
    repairCostHigh: 250000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 600000,
    notes: 'Genuine Audi glass ₦200–400k. Local glass ₦80–150k. ADAS recalib adds ₦50k+.',
  },
  
  // Side Windows
  {
    make: 'Audi',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 30000,
    repairCostHigh: 100000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 250000,
    notes: 'Per window. Power regulator check if stuck. Genuine glass preferred.',
  },
  
  // Headlights
  {
    make: 'Audi',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 60000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 150000,
    notes: 'Polish/restore ₦20k. Lens replacement ₦60k. OEM Audi LED headlight ₦400k–1M.',
  },
  {
    make: 'Audi',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 800000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 2000000,
    notes: 'Genuine Audi LED/Matrix unit extremely expensive. Used unit ₦200–500k.',
  },
  
  // Tail Lights
  {
    make: 'Audi',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 300000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 700000,
    notes: 'OLED taillights on newer Audi very expensive. Used from Cotonou: ₦150–400k.',
  },
  
  // Radiator Grille
  {
    make: 'Audi',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 30000,
    repairCostHigh: 150000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 350000,
    notes: 'Genuine Audi grille ₦80–250k. Sensors/cameras embedded in some models.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Audi',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 100000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 600000,
    notes: 'Valve cover gasket most common. Higher deduction — signals maintenance neglect.',
  },
  {
    make: 'Audi',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 800000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 8000000,
    notes: 'Repair or source used Audi engine from Cotonou (₦600k–2M). Critical deduction.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Audi',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 400000,
    repairCostHigh: 1500000,
    valuationDeductionLow: 1500000,
    valuationDeductionHigh: 4000000,
    notes: 'Audi DSG/S-Tronic service-intensive. "Untampered gear" = major premium in Nigeria.',
  },
  {
    make: 'Audi',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 1000000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 7000000,
    notes: 'Replacement gearbox from Cotonou ₦800k–2.5M. Highest deduction category.',
  },
  
  // Suspension (per axle)
  {
    make: 'Audi',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 80000,
    repairCostHigh: 250000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 600000,
    notes: 'Air suspension (Q7, A6, A8) replacement: ₦300k–800k per strut (OEM).',
  },
  {
    make: 'Audi',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 200000,
    repairCostHigh: 600000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1500000,
    notes: 'Control arms, tie rods. Check wheel alignment after any impact.',
  },
  
  // Interior (seats)
  {
    make: 'Audi',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 400000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 800000,
    notes: 'Audi full leather re-trim ₦250–600k. Partial repair ₦100–200k.',
  },
  
  // Interior (dashboard)
  {
    make: 'Audi',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 300000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 600000,
    notes: 'MMI screen replacement: ₦200–600k. Dashboard re-pad: ₦100–250k.',
  },
  
  // AC System
  {
    make: 'Audi',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 300000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 700000,
    notes: 'Compressor: ₦150–350k. Condenser: ₦100–250k. Regas: ₦30–60k.',
  },
  
  // Frame/Chassis
  {
    make: 'Audi',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 10000000,
    notes: 'Major structural. Frame straightening + certification. Near total-loss territory for older cars.',
  },
];

async function importAudiDamageDeductions() {
  console.log('🔧 Starting Audi damage deductions import...\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const deduction of audiDamageDeductions) {
      try {
        // Check if record exists
        const existing = await db
          .select()
          .from(damageDeductions)
          .where(
            and(
              eq(damageDeductions.make, deduction.make),
              eq(damageDeductions.component, deduction.component),
              eq(damageDeductions.damageLevel, deduction.damageLevel as 'minor' | 'moderate' | 'severe')
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(damageDeductions)
            .set({
              repairCostLow: deduction.repairCostLow.toString(),
              repairCostHigh: deduction.repairCostHigh.toString(),
              valuationDeductionLow: deduction.valuationDeductionLow.toString(),
              valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
              notes: deduction.notes,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(damageDeductions.make, deduction.make),
                eq(damageDeductions.component, deduction.component),
                eq(damageDeductions.damageLevel, deduction.damageLevel as 'minor' | 'moderate' | 'severe')
              )
            );
          updatedCount++;
        } else {
          // Insert new
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
        }
      } catch (error) {
        console.error(`❌ Error importing ${deduction.component} (${deduction.damageLevel}):`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`   ✅ Imported: ${importedCount} new deductions`);
    console.log(`   ♻️  Updated: ${updatedCount} existing deductions`);
    console.log(`   ❌ Errors: ${errorCount} deductions`);
    console.log(`   📊 Total processed: ${audiDamageDeductions.length} deductions`);
    console.log('\n✅ Audi damage deductions import complete!');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importAudiDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Audi damage deductions have been imported.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
