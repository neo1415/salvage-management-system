/**
 * Import Toyota-Specific Damage Deductions
 * Based on Nigerian market repair costs for Toyota vehicles
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

const toyotaDamageDeductions = [
  // Front Bumper
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 60000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 150000,
    notes: 'Respray + minor repair. Toyota parts widely available in Nigeria.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 350000,
    notes: 'Replace + paint. Genuine Toyota bumper ₦120–250k, local copy ₦50–100k.',
  },
  {
    make: 'Toyota',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 400000,
    valuationDeductionLow: 450000,
    valuationDeductionHigh: 900000,
    notes: 'Full replacement. Check airbag sensors and radiator support.',
  },
  
  // Rear Bumper
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 50000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 120000,
    notes: 'Touch-up + small repair. Less critical than front.',
  },
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 120000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 300000,
    notes: 'Panel replacement. Check reverse sensors if equipped.',
  },
  {
    make: 'Toyota',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 800000,
    notes: 'Full rear impact check. Boot/trunk alignment critical.',
  },
  
  // Bonnet/Hood
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 50000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 150000,
    notes: 'Panel beating + respray. Common repair.',
  },
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 120000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 350000,
    notes: 'Multiple dents or hinge damage. May need replacement.',
  },
  {
    make: 'Toyota',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 450000,
    valuationDeductionHigh: 1000000,
    notes: 'Usually replaced. Check radiator/fan damage.',
  },
  
  // Front Wing/Fender
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 45000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 120000,
    notes: 'Pull + paint. Common road debris damage.',
  },
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 120000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 300000,
    notes: 'Replace panel. Check headlight alignment.',
  },
  {
    make: 'Toyota',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 120000,
    repairCostHigh: 300000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 800000,
    notes: 'Possible chassis impact. Structural inspection needed.',
  },
  
  // Door Panel (per door)
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 45000,
    valuationDeductionHigh: 100000,
    notes: 'Dent pull + spot repair. Very common damage.',
  },
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 45000,
    repairCostHigh: 100000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 250000,
    notes: 'Full respray of panel. Check door seal and alignment.',
  },
  {
    make: 'Toyota',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 350000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 900000,
    notes: 'Door replacement. Check side airbag sensor and hinge.',
  },
  
  // Roof Panel
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 80000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 200000,
    notes: 'PDR (paintless dent repair) if no paint break.',
  },
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 250000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 600000,
    notes: 'Body filler + full respray. Sunroof check if equipped.',
  },
  {
    make: 'Toyota',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 350000,
    repairCostHigh: 1000000,
    valuationDeductionLow: 1500000,
    valuationDeductionHigh: 3500000,
    notes: 'Major structural damage. A-pillar check. May be write-off.',
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
    notes: 'Resin injection for small chips. Quick repair.',
  },
  {
    make: 'Toyota',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 50000,
    repairCostHigh: 150000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 350000,
    notes: 'Genuine Toyota glass ₦100–200k. Local glass ₦50–100k.',
  },
  
  // Side Windows
  {
    make: 'Toyota',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 20000,
    repairCostHigh: 60000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 150000,
    notes: 'Per window. Power regulator check if stuck.',
  },
  
  // Headlights
  {
    make: 'Toyota',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 100000,
    notes: 'Polish/restore ₦15k. Lens replacement ₦40k.',
  },
  {
    make: 'Toyota',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 80000,
    repairCostHigh: 300000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 700000,
    notes: 'Genuine Toyota headlight ₦150–400k. Used from Cotonou: ₦80–200k.',
  },
  
  // Tail Lights
  {
    make: 'Toyota',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 30000,
    repairCostHigh: 120000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 300000,
    notes: 'Genuine Toyota ₦80–150k. Used from Cotonou: ₦30–80k.',
  },
  
  // Radiator Grille
  {
    make: 'Toyota',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 20000,
    repairCostHigh: 80000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 200000,
    notes: 'Genuine Toyota grille ₦50–120k. Aftermarket widely available.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Toyota',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 80000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 450000,
    notes: 'Valve cover gasket common. Signals maintenance neglect.',
  },
  {
    make: 'Toyota',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 5000000,
    notes: 'Used Toyota engine from Cotonou ₦400k–1.5M. Critical deduction.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Toyota',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 250000,
    repairCostHigh: 800000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 2500000,
    notes: 'Toyota automatic transmission service. "Untampered gear" = premium.',
  },
  {
    make: 'Toyota',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 600000,
    repairCostHigh: 1800000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 4500000,
    notes: 'Replacement gearbox from Cotonou ₦500k–1.5M. Major deduction.',
  },
  
  // Suspension (per axle)
  {
    make: 'Toyota',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 150000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 350000,
    notes: 'Shock absorbers ₦40–100k per pair. Common wear item.',
  },
  {
    make: 'Toyota',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 350000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 800000,
    notes: 'Control arms, tie rods, ball joints. Wheel alignment after repair.',
  },
  
  // Interior (seats)
  {
    make: 'Toyota',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 500000,
    notes: 'Toyota leather re-trim ₦150–400k. Partial repair ₦60–150k.',
  },
  
  // Interior (dashboard)
  {
    make: 'Toyota',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 400000,
    notes: 'Dashboard re-pad: ₦80–200k. Cracked dash common in hot climate.',
  },
  
  // AC System
  {
    make: 'Toyota',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 200000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 450000,
    notes: 'Compressor: ₦100–250k. Condenser: ₦60–150k. Regas: ₦20–40k.',
  },
  
  // Frame/Chassis
  {
    make: 'Toyota',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 350000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 6000000,
    notes: 'Major structural damage. Frame straightening + certification. Near total-loss.',
  },
];

async function importToyotaDamageDeductions() {
  console.log('🔧 Starting Toyota damage deductions import...\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const deduction of toyotaDamageDeductions) {
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
    console.log(`   📊 Total processed: ${toyotaDamageDeductions.length} deductions`);
    console.log('\n✅ Toyota damage deductions import complete!');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importToyotaDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Toyota damage deductions have been imported.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
