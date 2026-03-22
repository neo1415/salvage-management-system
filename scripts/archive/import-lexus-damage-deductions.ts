/**
 * Import Lexus-Specific Damage Deductions
 * Based on the official Lexus Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 8 - DAMAGE DEDUCTION TABLE — Lexus Specific (Nigeria 2025/2026)
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

// Lexus damage deductions from official guide
const lexusDamageDeductions = [
  // Front Bumper
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 35000,
    repairCostHigh: 80000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 250000,
    notes: 'Respray + minor repair. Lexus bumper paint match harder than Toyota — metallic finishes common. Workshop: ₦50–80k.',
  },
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 220000,
    valuationDeductionLow: 250000,
    valuationDeductionHigh: 600000,
    notes: 'Genuine Lexus bumper ₦120–300k. Local copy ₦50–100k. Parking sensors embedded — verify function after repair.',
  },
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 500000,
    valuationDeductionLow: 550000,
    valuationDeductionHigh: 1300000,
    notes: 'Full replacement. Airbag/pre-collision sensors check. Lexus Spindle Grille replacement ₦80–250k extra.',
  },
  
  // Rear Bumper
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 200000,
    notes: 'Touch-up. Rear camera/sensor check — common failure point on Lexus after impact. Recalibration ₦30–60k.',
  },
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 180000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 500000,
    notes: 'Full panel. Boot alignment check. Genuine Lexus rear sensors: ₦20–50k each.',
  },
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 420000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1200000,
    notes: 'Full replacement. Exhaust/tow hitch check. LX/GX tow bars: ₦80–200k replacement.',
  },
  
  // Bonnet/Hood
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 65000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 180000,
    notes: 'Panel beating + respray. Lexus hood metallic paint: colour matching critical. Allow 2–3 days.',
  },
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 65000,
    repairCostHigh: 180000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 500000,
    notes: 'Multiple dents or hinge damage. New hood from Toyota network: ₦100–200k.',
  },
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 450000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1400000,
    notes: 'Full replacement. Radiator/intercooler check on RX350/LX570.',
  },
  
  // Front Wing/Fender
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 55000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 160000,
    notes: 'Pull + paint. Lexus fenders share Toyota platform — widely available at Berger/Apapa.',
  },
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 420000,
    notes: 'Panel replacement. Camera in fender mirror (on some GX/LX) — verify function.',
  },
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 380000,
    valuationDeductionLow: 420000,
    valuationDeductionHigh: 1100000,
    notes: 'Chassis rail check critical. GX/LX body-on-frame check frame straightness.',
  },
  
  // Door Panel (per door)
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 50000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 150000,
    notes: 'Dent pull + spot repair. Lexus door panels share Toyota platforms — repair routine for good workshops.',
  },
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 160000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 420000,
    notes: 'Full respray. Soft-close door mechanism (on LS/LX): verify function ₦50–200k fix if damaged.',
  },
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 500000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1400000,
    notes: 'Door replacement. Side curtain airbag sensor check. Lexus doors: ₦150–400k replacement.',
  },
  
  // Roof Panel
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 45000,
    repairCostHigh: 120000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 300000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (very common on Lexus ES/RX/GX).',
  },
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 320000,
    valuationDeductionLow: 340000,
    valuationDeductionHigh: 850000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair.',
  },
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 1800000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 6000000,
    notes: 'Major structural. A-pillar inspection essential. Write-off territory for older models.',
  },
  
  // Windscreen
  {
    make: 'Lexus',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 100000,
    notes: 'Resin injection. ADAS/Pre-Collision System recalibration required on 2016+ Lexus: ₦50–100k.',
  },
  {
    make: 'Lexus',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 80000,
    repairCostHigh: 300000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 750000,
    notes: 'Genuine Lexus glass: ₦150–350k. ADAS recalibration adds ₦50–120k. Higher deduction for newer models.',
  },
  
  // Side Windows
  {
    make: 'Lexus',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 25000,
    repairCostHigh: 100000,
    valuationDeductionLow: 65000,
    valuationDeductionHigh: 250000,
    notes: 'Per window. Power regulator check. Lexus windows: power close function common — verify operation.',
  },
  
  // Headlights (LED/HID)
  {
    make: 'Lexus',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 60000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 160000,
    notes: 'Polish/restore. Lexus LED headlights sharper than Toyota — lens replacement ₦60–120k (local).',
  },
  {
    make: 'Lexus',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 900000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 2500000,
    notes: 'Genuine Lexus LED adaptive unit: ₦500k–1.5M. Used from Cotonou: ₦200–600k. Very expensive on LX/GX.',
  },
  
  // Tail Lights
  {
    make: 'Lexus',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 400000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 1000000,
    notes: 'Lexus sequential LED tail lights (RX350, ES): ₦150–500k replacement. Very visual — deduction reflects perception.',
  },
  
  // Spindle Grille
  {
    make: 'Lexus',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 600000,
    notes: 'Unique to Lexus. Replacement grille ₦80–300k. Parking/radar sensors embedded in some — verify.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Lexus',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 100000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 600000,
    notes: 'Valve cover gasket: ₦15–40k part + labour. Lexus engines Toyota-grade reliability — higher deduction still signals neglect.',
  },
  {
    make: 'Lexus',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 600000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 2500000,
    valuationDeductionHigh: 8000000,
    notes: 'Toyota-based engine from Apapa: ₦400k–1.5M (RX/ES). LX570 5.7L used engine: ₦800k–2.5M. Skilled mechanics available.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Lexus',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 300000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3000000,
    notes: 'Lexus auto trans Toyota-grade. If failing: service ₦100–250k or rebuild ₦400k–1.2M. GX/LX transfer case extra.',
  },
  {
    make: 'Lexus',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 700000,
    repairCostHigh: 2500000,
    valuationDeductionLow: 2500000,
    valuationDeductionHigh: 6000000,
    notes: 'Replacement from Apapa: ₦500k–1.8M (RX/ES); ₦1M–2.5M (LX570 V8). More available than Audi/BMW.',
  },
  
  // Suspension (per axle)
  {
    make: 'Lexus',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 600000,
    notes: 'Lexus hydraulic/air suspension (LS460, GX460): air strut ₦200–600k per corner. Toyota coil-spring models cheaper.',
  },
  {
    make: 'Lexus',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 150000,
    repairCostHigh: 500000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 1200000,
    notes: 'GX/LX body-on-frame: robust but KDSS (Kinetic Dynamic Suspension) check needed after hard impacts.',
  },
  
  // Interior — Mark Levinson
  {
    make: 'Lexus',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 600000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 1200000,
    notes: 'Lexus infotainment screen: ₦200–500k. Dashboard crack repair: ₦80–200k. Dual-screen (LX600): extremely expensive.',
  },
  
  // Interior — Seats
  {
    make: 'Lexus',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 500000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 1000000,
    notes: 'Lexus leather re-trim ₦250–600k (full). Heated/cooled seat element repair: ₦50–150k. Semi-aniline leather on LS: deduct more.',
  },
  
  // AC System
  {
    make: 'Lexus',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 350000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 800000,
    notes: 'Compressor: ₦120–350k. Condenser: ₦100–250k. 4-zone climate control (LS/LX) more complex — add ₦50–150k.',
  },
  
  // Frame/Chassis
  {
    make: 'Lexus',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 12000000,
    notes: 'Body-on-frame (GX/LX): frame rails straightening required. Certified shops: Lagos Island, Surulere, Wuse Abuja.',
  },
  
  // Mileage Tampering
  {
    make: 'Lexus',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 6000000,
    notes: 'Common on imported Lexus. Deduct per verified mileage. Carfax/VIN history check essential for all Lexus buys.',
  },
];

async function importLexusDamageDeductions() {
  console.log('🔧 Starting Lexus damage deductions import...\n');
  console.log('📋 Source: Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    // First, delete all existing Lexus deductions
    console.log('🗑️  Deleting old Lexus deductions (if any)...');
    await db
      .delete(damageDeductions)
      .where(eq(damageDeductions.make, 'Lexus'));
    console.log(`   ✅ Deleted old records\n`);

    let importedCount = 0;
    let errorCount = 0;

    console.log('📥 Importing Lexus deductions from official guide...\n');

    for (const deduction of lexusDamageDeductions) {
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
    console.log(`   📊 Total processed: ${lexusDamageDeductions.length} deductions`);
    console.log('\n✅ Lexus damage deductions import complete!');
    console.log('📋 All data sourced from official Lexus Nigeria guide (Section 8)');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importLexusDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Lexus damage deductions have been imported from official guide.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
