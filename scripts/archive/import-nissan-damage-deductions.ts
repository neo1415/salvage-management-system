/**
 * Import Nissan-Specific Damage Deductions
 * Based on the official Nissan Cars in Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 15 - DAMAGE DEDUCTION TABLE — Nissan Specific (Nigeria 2025/2026)
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

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

// Nissan damage deductions from official guide
const nissanDamageDeductions = [
  // Front Bumper
  {
    make: 'Nissan',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 28000,
    repairCostHigh: 65000,
    valuationDeductionLow: 75000,
    valuationDeductionHigh: 190000,
    notes: 'Respray + minor repair. Nissan bumpers widely available. Workshop: ₦35–65k.',
  },
  {
    make: 'Nissan',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 65000,
    repairCostHigh: 170000,
    valuationDeductionLow: 190000,
    valuationDeductionHigh: 480000,
    notes: 'Genuine Nissan bumper ₦90–240k. Local copy ₦35–75k. Parking sensors common — verify function.',
  },
  {
    make: 'Nissan',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 170000,
    repairCostHigh: 400000,
    valuationDeductionLow: 480000,
    valuationDeductionHigh: 1150000,
    notes: 'Full replacement. Airbag sensor check. V-Motion grille replacement ₦55–170k extra.',
  },
  
  // Rear Bumper
  {
    make: 'Nissan',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 23000,
    repairCostHigh: 55000,
    valuationDeductionLow: 65000,
    valuationDeductionHigh: 170000,
    notes: 'Touch-up. Rear camera/sensor check — common on Nissan. Recalibration ₦23–48k.',
  },
  {
    make: 'Nissan',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 140000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 430000,
    notes: 'Full panel. Boot alignment check. Genuine rear sensors: ₦14–38k each.',
  },
  {
    make: 'Nissan',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 140000,
    repairCostHigh: 360000,
    valuationDeductionLow: 430000,
    valuationDeductionHigh: 1050000,
    notes: 'Full replacement. Exhaust check. Pathfinder/Armada tow bars: ₦65–170k replacement.',
  },
  
  // Bonnet/Hood
  {
    make: 'Nissan',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 19000,
    repairCostHigh: 52000,
    valuationDeductionLow: 57000,
    valuationDeductionHigh: 150000,
    notes: 'Panel beating + respray. Colour matching routine for good workshops. Allow 2 days.',
  },
  {
    make: 'Nissan',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 52000,
    repairCostHigh: 140000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 430000,
    notes: 'Multiple dents or hinge damage. New hood from Berger/Apapa: ₦75–170k.',
  },
  {
    make: 'Nissan',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 140000,
    repairCostHigh: 380000,
    valuationDeductionLow: 430000,
    valuationDeductionHigh: 1250000,
    notes: 'Full replacement. Radiator/intercooler check on turbocharged models.',
  },
  
  // Front Wing/Fender
  {
    make: 'Nissan',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 17000,
    repairCostHigh: 48000,
    valuationDeductionLow: 52000,
    valuationDeductionHigh: 140000,
    notes: 'Pull + paint. Nissan fenders widely available at Berger/Apapa.',
  },
  {
    make: 'Nissan',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 48000,
    repairCostHigh: 125000,
    valuationDeductionLow: 140000,
    valuationDeductionHigh: 360000,
    notes: 'Panel replacement. Camera in fender mirror (on some Patrol/Armada) — verify function.',
  },
  {
    make: 'Nissan',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 125000,
    repairCostHigh: 330000,
    valuationDeductionLow: 360000,
    valuationDeductionHigh: 950000,
    notes: 'Chassis rail check critical. Unibody construction — frame straightness check essential.',
  },
  
  // Door Panel (per door)
  {
    make: 'Nissan',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 17000,
    repairCostHigh: 43000,
    valuationDeductionLow: 48000,
    valuationDeductionHigh: 130000,
    notes: 'Dent pull + spot repair. Routine repair for good workshops.',
  },
  {
    make: 'Nissan',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 52000,
    repairCostHigh: 130000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 360000,
    notes: 'Full respray. Power window mechanism check — common failure point.',
  },
  {
    make: 'Nissan',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 430000,
    valuationDeductionLow: 430000,
    valuationDeductionHigh: 1250000,
    notes: 'Door replacement. Side curtain airbag sensor check. Doors: ₦125–330k replacement.',
  },
  
  // Roof Panel
  {
    make: 'Nissan',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 38000,
    repairCostHigh: 95000,
    valuationDeductionLow: 105000,
    valuationDeductionHigh: 265000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (common on Murano/Rogue/Pathfinder).',
  },
  {
    make: 'Nissan',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 95000,
    repairCostHigh: 265000,
    valuationDeductionLow: 285000,
    valuationDeductionHigh: 760000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair.',
  },
  {
    make: 'Nissan',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 430000,
    repairCostHigh: 1520000,
    valuationDeductionLow: 1700000,
    valuationDeductionHigh: 5250000,
    notes: 'Major structural. A-pillar inspection essential. Write-off territory for older models.',
  },
  
  // Windscreen
  {
    make: 'Nissan',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 11000,
    repairCostHigh: 33000,
    valuationDeductionLow: 33000,
    valuationDeductionHigh: 85000,
    notes: 'Resin injection. ADAS recalibration required on 2017+ models: ₦38–76k.',
  },
  {
    make: 'Nissan',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 65000,
    repairCostHigh: 240000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 620000,
    notes: 'Genuine glass: ₦110–285k. ADAS recalibration adds ₦38–95k. Higher deduction for newer models.',
  },
  
  // Side Windows
  {
    make: 'Nissan',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 19000,
    repairCostHigh: 76000,
    valuationDeductionLow: 52000,
    valuationDeductionHigh: 210000,
    notes: 'Per window. Power regulator check. Common failure on Nissan models.',
  },
  
  // Headlights (LED/HID)
  {
    make: 'Nissan',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 17000,
    repairCostHigh: 48000,
    valuationDeductionLow: 43000,
    valuationDeductionHigh: 130000,
    notes: 'Polish/restore. LED headlights common on 2015+ models — lens replacement ₦48–95k (local).',
  },
  {
    make: 'Nissan',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 110000,
    repairCostHigh: 665000,
    valuationDeductionLow: 330000,
    valuationDeductionHigh: 1900000,
    notes: 'Genuine LED adaptive unit: ₦380k–1.1M. Used from Cotonou: ₦140–475k. Very expensive on Patrol/Armada.',
  },
  
  // Tail Lights
  {
    make: 'Nissan',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 38000,
    repairCostHigh: 330000,
    valuationDeductionLow: 95000,
    valuationDeductionHigh: 855000,
    notes: 'LED tail lights (Altima, Rogue, Pathfinder, Murano): ₦110–430k replacement. Very visual — deduction reflects perception.',
  },
  
  // Radiator Grille
  {
    make: 'Nissan',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 48000,
    repairCostHigh: 190000,
    valuationDeductionLow: 125000,
    valuationDeductionHigh: 525000,
    notes: 'V-Motion grille. Replacement grille ₦57–240k. Parking/radar sensors embedded in some — verify.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Nissan',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 23000,
    repairCostHigh: 76000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 525000,
    notes: 'Valve cover gasket: ₦11–33k part + labour. WARNING: VQ35DE V6 prone to valve cover gasket leaks — check carefully.',
  },
  {
    make: 'Nissan',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 475000,
    repairCostHigh: 2375000,
    valuationDeductionLow: 2100000,
    valuationDeductionHigh: 6650000,
    notes: 'Used engine from Apapa: ₦330k–1.1M (Altima/Sentra). Pathfinder/Murano: ₦570k–1.9M. VQ engines reliable but check gaskets.',
  },
  
  // CVT Transmission (CRITICAL NISSAN ISSUE)
  {
    make: 'Nissan',
    component: 'CVT Transmission',
    damageLevel: 'moderate',
    repairCostLow: 380000,
    repairCostHigh: 1425000,
    valuationDeductionLow: 1330000,
    valuationDeductionHigh: 3800000,
    notes: 'CRITICAL: CVT shudder/slip/overheating. #1 known weakness on Altima/Sentra/Rogue/Murano/Pathfinder in Nigeria. Service ₦95–240k or rebuild ₦380k–1.4M. Extended warranty recall history — verify.',
  },
  {
    make: 'Nissan',
    component: 'CVT Transmission',
    damageLevel: 'severe',
    repairCostLow: 855000,
    repairCostHigh: 3135000,
    valuationDeductionLow: 3135000,
    valuationDeductionHigh: 7600000,
    notes: 'CRITICAL: CVT failed/seized. Replacement from Apapa: ₦570k–2.1M (sedans); ₦1.1M–3.1M (SUVs). CVT replacement extremely expensive. Many Nissan owners convert to manual transmission.',
  },
  
  // Gearbox/Transmission (Non-CVT)
  {
    make: 'Nissan',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 240000,
    repairCostHigh: 950000,
    valuationDeductionLow: 855000,
    valuationDeductionHigh: 2660000,
    notes: 'Standard automatic transmission. Service ₦76–190k or rebuild ₦330k–950k. Patrol/Armada transfer case extra.',
  },
  {
    make: 'Nissan',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 570000,
    repairCostHigh: 2100000,
    valuationDeductionLow: 2100000,
    valuationDeductionHigh: 5250000,
    notes: 'Replacement from Apapa: ₦380k–1.4M (sedans); ₦760k–2.1M (SUVs). More available than CVT.',
  },
  
  // Suspension (per axle)
  {
    make: 'Nissan',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 48000,
    repairCostHigh: 190000,
    valuationDeductionLow: 125000,
    valuationDeductionHigh: 525000,
    notes: 'Standard coil-spring suspension. Strut ₦140–430k per corner. Parts widely available.',
  },
  {
    make: 'Nissan',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 125000,
    repairCostHigh: 430000,
    valuationDeductionLow: 330000,
    valuationDeductionHigh: 1050000,
    notes: 'Unibody construction: check subframe integrity after hard impacts. Common rust on older models.',
  },
  
  // Interior — Dashboard
  {
    make: 'Nissan',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 76000,
    repairCostHigh: 475000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 1050000,
    notes: 'Infotainment screen: ₦140–430k. Dashboard crack repair: ₦57–170k. Dual-screen (Patrol): expensive.',
  },
  
  // Interior — Seats
  {
    make: 'Nissan',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 76000,
    repairCostHigh: 430000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 855000,
    notes: 'Leather re-trim ₦190–525k (full). Heated/cooled seat element repair: ₦38–125k.',
  },
  
  // AC System
  {
    make: 'Nissan',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 65000,
    repairCostHigh: 285000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 715000,
    notes: 'Compressor: ₦95–285k. Condenser: ₦76–210k. 3-zone climate control (Pathfinder/Armada) more complex — add ₦38–110k.',
  },
  
  // Frame/Chassis
  {
    make: 'Nissan',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 430000,
    repairCostHigh: 2660000,
    valuationDeductionLow: 2660000,
    valuationDeductionHigh: 10450000,
    notes: 'Unibody construction: frame rails straightening required. Certified shops: Lagos Island, Surulere, Wuse Abuja.',
  },
  
  // Mileage Tampering
  {
    make: 'Nissan',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 855000,
    valuationDeductionHigh: 5250000,
    notes: 'Common on imported Nissan. Deduct per verified mileage. Carfax/VIN history check essential for all buys.',
  },
];

async function importNissanDamageDeductions() {
  console.log('🔧 Starting Nissan damage deductions import...\n');
  console.log('📋 Source: Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)\n');
  console.log('⚠️  CRITICAL: CVT transmission issues are the #1 known weakness on Nissan models in Nigeria\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    // First, delete all existing Nissan deductions
    console.log('🗑️  Deleting old Nissan deductions (if any)...');
    await db
      .delete(damageDeductions)
      .where(eq(damageDeductions.make, 'Nissan'));
    console.log(`   ✅ Deleted old records\n`);

    let importedCount = 0;
    let errorCount = 0;

    console.log('📥 Importing Nissan deductions from official guide...\n');

    for (const deduction of nissanDamageDeductions) {
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
    console.log(`   ✅ Imported: ${importedCount} deductions from official guide`);
    console.log(`   ❌ Errors: ${errorCount} deductions`);
    console.log(`   📊 Total processed: ${nissanDamageDeductions.length} deductions`);
    console.log('\n✅ Nissan damage deductions import complete!');
    console.log('📋 All data sourced from official Nissan guide (Section 15)');
    console.log('⚠️  CRITICAL: CVT transmission category included with special warnings');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importNissanDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Nissan damage deductions have been imported from official guide.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
