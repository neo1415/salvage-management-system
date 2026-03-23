/**
 * Import Hyundai & Kia Shared Damage Deductions
 * Based on the official Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 18 - DAMAGE DEDUCTION TABLE — Hyundai & Kia Shared (Nigeria 2025/2026)
 * Note: Both brands share platform engineering under Hyundai Motor Group
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq, or } from 'drizzle-orm';

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

// Shared Hyundai & Kia damage deductions from official guide
// These apply to BOTH brands since they share platform engineering
const sharedDamageDeductions = [
  // Front Bumper
  {
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 200000,
    notes: 'Respray + minor repair. Hyundai/Kia bumpers share design language. Workshop: ₦40–70k.',
  },
  {
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 180000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 500000,
    notes: 'Genuine bumper ₦100–250k. Local copy ₦40–80k. Parking sensors common — verify function.',
  },
  {
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 420000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1200000,
    notes: 'Full replacement. Airbag sensor check. Tiger Nose grille (Kia) or Cascading grille (Hyundai) ₦60–180k extra.',
  },
  
  // Rear Bumper
  {
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 60000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 180000,
    notes: 'Touch-up. Rear camera/sensor check — common on both brands. Recalibration ₦25–50k.',
  },
  {
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 450000,
    notes: 'Full panel. Boot alignment check. Genuine rear sensors: ₦15–40k each.',
  },
  {
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 380000,
    valuationDeductionLow: 450000,
    valuationDeductionHigh: 1100000,
    notes: 'Full replacement. Exhaust check. Palisade/Telluride tow bars: ₦70–180k replacement.',
  },
  
  // Bonnet/Hood
  {
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 55000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 160000,
    notes: 'Panel beating + respray. Colour matching routine for good workshops. Allow 2 days.',
  },
  {
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 450000,
    notes: 'Multiple dents or hinge damage. New hood from Berger/Apapa: ₦80–180k.',
  },
  {
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 400000,
    valuationDeductionLow: 450000,
    valuationDeductionHigh: 1300000,
    notes: 'Full replacement. Radiator/intercooler check on turbocharged models (Tucson/Sportage).',
  },
  
  // Front Wing/Fender
  {
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 50000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 150000,
    notes: 'Pull + paint. Hyundai/Kia fenders widely available at Berger/Apapa.',
  },
  {
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 130000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 380000,
    notes: 'Panel replacement. Camera in fender mirror (on some Palisade/Telluride) — verify function.',
  },
  {
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 130000,
    repairCostHigh: 350000,
    valuationDeductionLow: 380000,
    valuationDeductionHigh: 1000000,
    notes: 'Chassis rail check critical. Unibody construction — frame straightness check essential.',
  },
  
  // Door Panel (per door)
  {
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 45000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 140000,
    notes: 'Dent pull + spot repair. Routine repair for good workshops.',
  },
  {
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 140000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 380000,
    notes: 'Full respray. Power window mechanism check — common failure point.',
  },
  {
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 160000,
    repairCostHigh: 450000,
    valuationDeductionLow: 450000,
    valuationDeductionHigh: 1300000,
    notes: 'Door replacement. Side curtain airbag sensor check. Doors: ₦130–350k replacement.',
  },
  
  // Roof Panel
  {
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 100000,
    valuationDeductionLow: 110000,
    valuationDeductionHigh: 280000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (common on Tucson/Sportage/Santa Fe/Sorento).',
  },
  {
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 280000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 800000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair.',
  },
  {
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 450000,
    repairCostHigh: 1600000,
    valuationDeductionLow: 1800000,
    valuationDeductionHigh: 5500000,
    notes: 'Major structural. A-pillar inspection essential. Write-off territory for older models.',
  },
  
  // Windscreen
  {
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 12000,
    repairCostHigh: 35000,
    valuationDeductionLow: 35000,
    valuationDeductionHigh: 90000,
    notes: 'Resin injection. ADAS recalibration required on 2018+ models: ₦40–80k.',
  },
  {
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 70000,
    repairCostHigh: 250000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 650000,
    notes: 'Genuine glass: ₦120–300k. ADAS recalibration adds ₦40–100k. Higher deduction for newer models.',
  },
  
  // Side Windows
  {
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 20000,
    repairCostHigh: 80000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 220000,
    notes: 'Per window. Power regulator check. Common failure on both brands.',
  },
  
  // Headlights (LED/HID)
  {
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 50000,
    valuationDeductionLow: 45000,
    valuationDeductionHigh: 140000,
    notes: 'Polish/restore. LED headlights common on 2016+ models — lens replacement ₦50–100k (local).',
  },
  {
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 120000,
    repairCostHigh: 700000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 2000000,
    notes: 'Genuine LED adaptive unit: ₦400k–1.2M. Used from Cotonou: ₦150–500k. Very expensive on Palisade/Telluride.',
  },
  
  // Tail Lights
  {
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 40000,
    repairCostHigh: 350000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 900000,
    notes: 'LED tail lights (Tucson, Sportage, Santa Fe, Sorento): ₦120–450k replacement. Very visual — deduction reflects perception.',
  },
  
  // Radiator Grille
  {
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 130000,
    valuationDeductionHigh: 550000,
    notes: 'Tiger Nose (Kia) or Cascading (Hyundai) grille. Replacement grille ₦60–250k. Parking/radar sensors embedded in some — verify.',
  },
  
  // Engine (Oil leak)
  {
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 80000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 550000,
    notes: 'Valve cover gasket: ₦12–35k part + labour. WARNING: Theta II GDI engines (2011-2019) prone to oil consumption — check carefully.',
  },
  {
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 2500000,
    valuationDeductionLow: 2200000,
    valuationDeductionHigh: 7000000,
    notes: 'Used engine from Apapa: ₦350k–1.2M (Elantra/Cerato). Tucson/Sportage: ₦600k–2M. Theta II GDI recall history — verify.',
  },
  
  // Gearbox/Transmission
  {
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 250000,
    repairCostHigh: 1000000,
    valuationDeductionLow: 900000,
    valuationDeductionHigh: 2800000,
    notes: 'WARNING: 7-speed DCT (2015-2019) known for shuddering/failure. Service ₦80–200k or rebuild ₦350k–1M.',
  },
  {
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 600000,
    repairCostHigh: 2200000,
    valuationDeductionLow: 2200000,
    valuationDeductionHigh: 5500000,
    notes: 'Replacement from Apapa: ₦400k–1.5M (sedans); ₦800k–2.2M (SUVs). DCT replacement very expensive.',
  },
  
  // Suspension (per axle)
  {
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 130000,
    valuationDeductionHigh: 550000,
    notes: 'Standard coil-spring suspension. Strut ₦150–450k per corner. Parts widely available.',
  },
  {
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 130000,
    repairCostHigh: 450000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 1100000,
    notes: 'Unibody construction: check subframe integrity after hard impacts. Common rust on older models.',
  },
  
  // Interior — Dashboard
  {
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 500000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 1100000,
    notes: 'Infotainment screen: ₦150–450k. Dashboard crack repair: ₦60–180k. Dual-screen (Palisade/Telluride): expensive.',
  },
  
  // Interior — Seats
  {
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 450000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 900000,
    notes: 'Leather re-trim ₦200–550k (full). Heated/cooled seat element repair: ₦40–130k. Nappa leather on Stinger: deduct more.',
  },
  
  // AC System
  {
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 300000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 750000,
    notes: 'Compressor: ₦100–300k. Condenser: ₦80–220k. 3-zone climate control (Palisade/Telluride) more complex — add ₦40–120k.',
  },
  
  // Frame/Chassis
  {
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 450000,
    repairCostHigh: 2800000,
    valuationDeductionLow: 2800000,
    valuationDeductionHigh: 11000000,
    notes: 'Unibody construction: frame rails straightening required. Certified shops: Lagos Island, Surulere, Wuse Abuja.',
  },
  
  // Mileage Tampering
  {
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 900000,
    valuationDeductionHigh: 5500000,
    notes: 'Common on imported Hyundai/Kia. Deduct per verified mileage. Carfax/VIN history check essential for all buys.',
  },
];

async function importHyundaiKiaDamageDeductions() {
  console.log('🔧 Starting Hyundai & Kia shared damage deductions import...\n');
  console.log('📋 Source: Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)\n');
  console.log('ℹ️  Note: Both brands share platform engineering under Hyundai Motor Group\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    // First, delete all existing Hyundai and Kia deductions
    console.log('🗑️  Deleting old Hyundai & Kia deductions (if any)...');
    await db
      .delete(damageDeductions)
      .where(
        or(
          eq(damageDeductions.make, 'Hyundai'),
          eq(damageDeductions.make, 'Kia')
        )
      );
    console.log(`   ✅ Deleted old records\n`);

    let importedCount = 0;
    let errorCount = 0;

    console.log('📥 Importing shared Hyundai & Kia deductions from official guide...\n');

    // Import for Hyundai
    console.log('📦 Importing Hyundai deductions...\n');
    for (const deduction of sharedDamageDeductions) {
      try {
        await db.insert(damageDeductions).values({
          make: 'Hyundai',
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
        console.log(`   ✅ Hyundai - ${deduction.component} (${deduction.damageLevel})`);
      } catch (error) {
        console.error(`   ❌ Error importing Hyundai ${deduction.component} (${deduction.damageLevel}):`, error);
        errorCount++;
      }
    }

    // Import for Kia
    console.log('\n📦 Importing Kia deductions...\n');
    for (const deduction of sharedDamageDeductions) {
      try {
        await db.insert(damageDeductions).values({
          make: 'Kia',
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
        console.log(`   ✅ Kia - ${deduction.component} (${deduction.damageLevel})`);
      } catch (error) {
        console.error(`   ❌ Error importing Kia ${deduction.component} (${deduction.damageLevel}):`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`   ✅ Imported: ${importedCount} deductions from official guide`);
    console.log(`   ❌ Errors: ${errorCount} deductions`);
    console.log(`   📊 Total processed: ${sharedDamageDeductions.length * 2} deductions (both brands)`);
    console.log('\n✅ Hyundai & Kia shared damage deductions import complete!');
    console.log('📋 All data sourced from official Hyundai & Kia guide (Section 18)');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importHyundaiKiaDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Hyundai & Kia shared damage deductions have been imported from official guide.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
