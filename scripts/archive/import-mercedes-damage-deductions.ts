/**
 * Import Mercedes-Benz-Specific Damage Deductions
 * Based on the official Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 11 - DAMAGE DEDUCTION TABLE — Mercedes-Benz Specific (Nigeria 2026)
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

// Mercedes-Benz damage deductions from official guide
const mercedesDamageDeductions = [
  // Front Bumper
  {
    make: 'Mercedes-Benz',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 150000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 400000,
    notes: 'Respray + minor repair. Mercedes paint match extremely difficult — metallic/pearl finishes. Workshop: ₦80–150k. Higher than Toyota/Lexus.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 150000,
    repairCostHigh: 500000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 1200000,
    notes: 'Genuine Mercedes bumper ₦250–800k. Local copy ₦100–250k. Parking sensors/radar embedded — verify function after repair. Recalibration ₦50–150k.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 400000,
    repairCostHigh: 1500000,
    valuationDeductionLow: 1200000,
    valuationDeductionHigh: 4000000,
    notes: 'Full replacement. Airbag/pre-collision sensors check. Mercedes Panamericana grille (AMG) replacement ₦200–600k extra. Most expensive bumper repairs in Nigeria.',
  },
  
  // Rear Bumper
  {
    make: 'Mercedes-Benz',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 120000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 350000,
    notes: 'Touch-up. Rear camera/sensor check — common failure point on Mercedes after impact. Recalibration ₦50–100k. Higher than Japanese brands.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 400000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 1000000,
    notes: 'Full panel. Boot alignment check. Genuine Mercedes rear sensors: ₦30–80k each. Parking assist module: ₦100–300k.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 350000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3500000,
    notes: 'Full replacement. Exhaust/tow hitch check. GLE/GLS tow bars: ₦150–400k replacement. AMG exhaust tips: ₦100–350k.',
  },
  
  // Bonnet/Hood
  {
    make: 'Mercedes-Benz',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 120000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 350000,
    notes: 'Panel beating + respray. Mercedes hood metallic paint: colour matching extremely critical. Allow 3–5 days. Higher cost than Toyota/Lexus.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 400000,
    valuationDeductionLow: 350000,
    valuationDeductionHigh: 1000000,
    notes: 'Multiple dents or hinge damage. New hood from Mercedes network: ₦200–500k. Aluminum hoods (AMG models): ₦300–800k.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 350000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3500000,
    notes: 'Full replacement. Radiator/intercooler check on GLE/GLS/AMG models. Most expensive hood repairs in Nigeria.',
  },
  
  // Front Wing/Fender
  {
    make: 'Mercedes-Benz',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 35000,
    repairCostHigh: 100000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 300000,
    notes: 'Pull + paint. Mercedes fenders less available than Toyota/Lexus — Berger/Apapa stock limited. Higher repair cost.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 350000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 900000,
    notes: 'Panel replacement. Camera in fender mirror (on some GLE/GLS) — verify function. Blind spot assist module: ₦80–250k.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 300000,
    repairCostHigh: 1000000,
    valuationDeductionLow: 900000,
    valuationDeductionHigh: 2800000,
    notes: 'Chassis rail check critical. G-Class body-on-frame check frame straightness. Most expensive fender repairs in Nigeria.',
  },
  
  // Door Panel (per door)
  {
    make: 'Mercedes-Benz',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 35000,
    repairCostHigh: 100000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 300000,
    notes: 'Dent pull + spot repair. Mercedes door panels less available than Japanese brands — repair more complex.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 350000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 900000,
    notes: 'Full respray. Soft-close door mechanism (on S-Class/GLS/Maybach): verify function ₦100–400k fix if damaged. Higher than Lexus.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 350000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3500000,
    notes: 'Door replacement. Side curtain airbag sensor check. Mercedes doors: ₦300–1M replacement. Most expensive door repairs in Nigeria.',
  },
  
  // Roof Panel
  {
    make: 'Mercedes-Benz',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 80000,
    repairCostHigh: 250000,
    valuationDeductionLow: 250000,
    valuationDeductionHigh: 700000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (extremely common on Mercedes). Higher cost than Japanese brands.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 250000,
    repairCostHigh: 800000,
    valuationDeductionLow: 700000,
    valuationDeductionHigh: 2000000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair. Mercedes sunroof repairs: ₦150–500k.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 1000000,
    repairCostHigh: 3500000,
    valuationDeductionLow: 3500000,
    valuationDeductionHigh: 10000000,
    notes: 'Major structural. A-pillar inspection essential. Write-off territory for most models. Most expensive roof repairs in Nigeria.',
  },
  
  // Windscreen
  {
    make: 'Mercedes-Benz',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 60000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 180000,
    notes: 'Resin injection. ADAS/Pre-Collision System recalibration required on 2016+ Mercedes: ₦80–200k. Higher than Lexus.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 600000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 1500000,
    notes: 'Genuine Mercedes glass: ₦300–800k. ADAS recalibration adds ₦80–250k. Most expensive windscreen repairs in Nigeria.',
  },
  
  // Side Windows
  {
    make: 'Mercedes-Benz',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 40000,
    repairCostHigh: 200000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 500000,
    notes: 'Per window. Power regulator check. Mercedes windows: power close function common — verify operation. Higher cost than Japanese brands.',
  },
  
  // Headlights (Multibeam LED)
  {
    make: 'Mercedes-Benz',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 100000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 300000,
    notes: 'Polish/restore. Mercedes Multibeam LED headlights most advanced in Nigeria — lens replacement ₦100–250k (local).',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 300000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 800000,
    valuationDeductionHigh: 5000000,
    notes: 'Genuine Mercedes Multibeam LED adaptive unit: ₦1M–3M. Used from Cotonou: ₦400k–1.2M. MOST EXPENSIVE headlights in Nigeria — higher than any other brand.',
  },
  
  // Tail Lights
  {
    make: 'Mercedes-Benz',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 800000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 2000000,
    notes: 'Mercedes OLED tail lights (S-Class, EQS): ₦300k–1M replacement. Very visual — deduction reflects perception. Most expensive tail lights in Nigeria.',
  },
  
  // Star Emblem (Hood/Grille)
  {
    make: 'Mercedes-Benz',
    component: 'Star Emblem',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 80000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 200000,
    notes: 'Mercedes star emblem theft extremely common in Nigeria. Replacement: ₦20–100k. Illuminated star (S-Class): ₦50–150k. Deduction reflects theft risk perception.',
  },
  
  // Radiator Grille
  {
    make: 'Mercedes-Benz',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 500000,
    valuationDeductionLow: 250000,
    valuationDeductionHigh: 1200000,
    notes: 'Mercedes grille design varies by model. Replacement grille ₦150–600k. Parking/radar sensors embedded in some — verify. AMG Panamericana grille: ₦200–800k.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Mercedes-Benz',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 1000000,
    notes: 'Valve cover gasket: ₦30–80k part + labour. Balance shaft module failure (M272 engine): ₦200–600k fix. Higher deduction than Japanese brands — signals neglect.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 1500000,
    repairCostHigh: 6000000,
    valuationDeductionLow: 5000000,
    valuationDeductionHigh: 15000000,
    notes: 'Used Mercedes engine from Apapa: ₦800k–3M (C/E-Class). GLE/GLS V6: ₦1.5M–4M. AMG V8: ₦3M–8M. MOST EXPENSIVE engine replacements in Nigeria.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Mercedes-Benz',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 500000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 1500000,
    valuationDeductionHigh: 5000000,
    notes: 'Mercedes 7G-Tronic/9G-Tronic. If failing: service ₦150–400k or rebuild ₦600k–2M. 4MATIC transfer case extra. Higher cost than Japanese brands.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 1500000,
    repairCostHigh: 5000000,
    valuationDeductionLow: 5000000,
    valuationDeductionHigh: 12000000,
    notes: 'Replacement from Apapa: ₦1M–3M (C/E-Class); ₦2M–5M (GLE/GLS); ₦3M–6M (AMG). MOST EXPENSIVE transmission replacements in Nigeria.',
  },
  
  // AIRMATIC Air Suspension (CRITICAL)
  {
    make: 'Mercedes-Benz',
    component: 'AIRMATIC Suspension',
    damageLevel: 'moderate',
    repairCostLow: 400000,
    repairCostHigh: 1500000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3500000,
    notes: 'AIRMATIC air suspension (GLE/GLS/S-Class): air strut ₦400k–1.2M per corner. Compressor: ₦300–800k. #1 MOST EXPENSIVE failure point on Mercedes in Nigeria. Higher than any other brand.',
  },
  {
    make: 'Mercedes-Benz',
    component: 'AIRMATIC Suspension',
    damageLevel: 'severe',
    repairCostLow: 1500000,
    repairCostHigh: 5000000,
    valuationDeductionLow: 4000000,
    valuationDeductionHigh: 12000000,
    notes: 'Full AIRMATIC system replacement: ₦2M–6M. All 4 corners + compressor + control module. MOST EXPENSIVE suspension repairs in Nigeria — 3-6x Toyota cost.',
  },
  
  // MBUX Screen (CRITICAL)
  {
    make: 'Mercedes-Benz',
    component: 'MBUX Screen',
    damageLevel: 'severe',
    repairCostLow: 400000,
    repairCostHigh: 2000000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 5000000,
    notes: 'MBUX infotainment screen: ₦400k–2M replacement. Dual-screen (S-Class/EQS): ₦1M–3M. Hyperscreen (EQS): ₦2M–5M. MOST EXPENSIVE screen repairs in Nigeria.',
  },
  
  // Interior Dashboard
  {
    make: 'Mercedes-Benz',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 200000,
    repairCostHigh: 1500000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 3000000,
    notes: 'Mercedes dashboard crack repair: ₦150–400k. MBUX screen replacement: ₦400k–2M. Burmester sound system: ₦300k–1M. Most expensive dashboard repairs in Nigeria.',
  },
  
  // Interior Seats
  {
    make: 'Mercedes-Benz',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 200000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 2500000,
    notes: 'Mercedes Nappa leather re-trim ₦400k–1.2M (full). Heated/cooled/massage seat element repair: ₦100–350k. Maybach seats: ₦500k–2M per seat. Most expensive seat repairs in Nigeria.',
  },
  
  // AC System
  {
    make: 'Mercedes-Benz',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 150000,
    repairCostHigh: 800000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 2000000,
    notes: 'Compressor: ₦200–800k. Condenser: ₦150–500k. 4-zone climate control (S-Class/GLS) more complex — add ₦100–300k. Higher cost than Japanese brands.',
  },
  
  // Frame/Chassis
  {
    make: 'Mercedes-Benz',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 1000000,
    repairCostHigh: 6000000,
    valuationDeductionLow: 6000000,
    valuationDeductionHigh: 20000000,
    notes: 'Body-on-frame (G-Class): frame rails straightening required. Unibody (C/E/S-Class): structural damage write-off territory. Most expensive chassis repairs in Nigeria.',
  },
  
  // Mileage Tampering
  {
    make: 'Mercedes-Benz',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 10000000,
    notes: 'Extremely common on imported Mercedes. Deduct per verified mileage. Carfax/VIN history check essential for all Mercedes buys. Higher deduction than Japanese brands due to higher repair costs.',
  },
];

async function importMercedesDamageDeductions() {
  console.log('🔧 Starting Mercedes-Benz damage deductions import...\n');
  console.log('📋 Source: Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    // First, delete all existing Mercedes-Benz deductions
    console.log('🗑️  Deleting old Mercedes-Benz deductions (if any)...');
    await db
      .delete(damageDeductions)
      .where(eq(damageDeductions.make, 'Mercedes-Benz'));
    console.log(`   ✅ Deleted old records\n`);

    let importedCount = 0;
    let errorCount = 0;

    console.log('📥 Importing Mercedes-Benz deductions from official guide...\n');

    for (const deduction of mercedesDamageDeductions) {
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
    console.log(`   📊 Total processed: ${mercedesDamageDeductions.length} deductions`);
    console.log('\n✅ Mercedes-Benz damage deductions import complete!');
    console.log('📋 All data sourced from official Mercedes-Benz in Nigeria guide (Section 11)');
    console.log('\n⚠️  CRITICAL NOTES:');
    console.log('   - AIRMATIC suspension: #1 most expensive failure point (₦400k–3.5M per corner)');
    console.log('   - MBUX screens: ₦400k–2M replacement (Hyperscreen: ₦2M–5M)');
    console.log('   - Multibeam LED headlights: ₦1M–3M (most expensive of any brand)');
    console.log('   - Parts cost 3-6x more than Toyota, 1.5-2x more than Audi');
    console.log('   - Star emblem theft extremely common — verify on all inspections');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importMercedesDamageDeductions()
  .then(() => {
    console.log('\n🎉 All done! Mercedes-Benz damage deductions have been imported from official guide.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
