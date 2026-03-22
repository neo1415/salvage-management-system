/**
 * Mercedes-Benz Damage Deduction Seed Script
 * 
 * Source: Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)
 *         Section 11 - DAMAGE DEDUCTION TABLE — Mercedes-Benz Specific (Nigeria 2026)
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/mercedes/mercedes-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/mercedes/mercedes-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/mercedes/mercedes-damage-deductions.seed.ts --force
 * 
 * Features:
 * - Idempotent: Safe to run multiple times
 * - Registry tracking: Automatically skips if already executed
 * - Batch processing: Processes records in batches of 50
 * - Error isolation: One failure doesn't stop others
 * - Validation: Checks required fields and ranges before insertion
 * - Audit logging: All changes tracked in valuation_audit_logs
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { batchProcessor, type BatchResult } from '@/features/seeds/services/batch-processor.service';
import { validationService, type DeductionRecord } from '@/features/seeds/services/validation.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = 'mercedes-damage-deductions';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Mercedes-Benz damage deductions from official guide
 * Based on the official Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide
 * Source: Section 11 - DAMAGE DEDUCTION TABLE — Mercedes-Benz Specific (Nigeria 2026)
 */
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

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 * 
 * Handles damage deduction data with unique constraint: (make, component, damageLevel)
 * Each row in rawData produces one database record.
 */
function transformToDbRecords(rawData: any[]): DeductionRecord[] {
  const records: DeductionRecord[] = [];
  
  for (const item of rawData) {
    // Validate that basic fields exist
    if (!item.make || !item.component || !item.damageLevel) {
      console.warn('⚠️  Skipping invalid record (missing make, component, or damageLevel):', item);
      continue;
    }

    // Validate damageLevel enum
    if (!['minor', 'moderate', 'severe'].includes(item.damageLevel)) {
      console.warn(`⚠️  Skipping invalid record (damageLevel must be minor, moderate, or severe):`, item);
      continue;
    }

    records.push({
      make: item.make,
      component: item.component,
      damageLevel: item.damageLevel as 'minor' | 'moderate' | 'severe',
      repairCostLow: item.repairCostLow,
      repairCostHigh: item.repairCostHigh,
      valuationDeductionLow: item.valuationDeductionLow,
      valuationDeductionHigh: item.valuationDeductionHigh,
      notes: item.notes,
    });
  }
  
  return records;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main seed execution function
 */
async function executeSeed() {
  const startTime = Date.now();
  const scriptName = SCRIPT_NAME;
  
  console.log('\n' + '='.repeat(60));
  console.log('🌱 SEED SCRIPT: ' + scriptName);
  console.log('='.repeat(60));
  console.log(`📊 Total raw records: ${mercedesDamageDeductions.length}\n`);
  
  // Parse command-line flags
  const forceRun = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  
  // Check if already executed (unless --force or --dry-run)
  if (!forceRun && !dryRun) {
    const hasRun = await seedRegistryService.hasBeenExecuted(scriptName);
    if (hasRun) {
      console.log('⏭️  Seed already executed. Use --force to re-run.');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    }
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  if (forceRun) {
    console.log('🔄 FORCE MODE - Re-running seed\n');
  }
  
  // Record start in registry (skip for dry-run)
  let registryId: string | null = null;
  if (!dryRun) {
    registryId = await seedRegistryService.recordStart(scriptName);
    console.log(`📝 Registry entry created: ${registryId}\n`);
  }
  
  try {
    // Transform raw data to database records
    console.log('🔄 Transforming raw data...');
    const records = transformToDbRecords(mercedesDamageDeductions);
    console.log(`✅ Transformed ${records.length} records\n`);
    
    if (records.length === 0) {
      console.log('⚠️  No records to process. Check rawData array.');
      if (!dryRun && registryId) {
        await seedRegistryService.recordSuccess(registryId, {
          recordsImported: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          executionTimeMs: Date.now() - startTime,
        });
      }
      process.exit(0);
    }
    
    // Process records in batches
    console.log('📦 Processing records in batches...\n');
    const stats = await batchProcessor.processBatch(
      records,
      BATCH_SIZE,
      async (batch) => {
        const result: BatchResult = {
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [],
        };
        
        for (const record of batch) {
          try {
            // Validate record
            const validation = validationService.validateDeduction(record);
            if (!validation.valid) {
              console.error(
                `   ⚠️  Validation failed for ${record.make} ${record.component} (${record.damageLevel}):`
              );
              validation.errors.forEach(err => {
                console.error(`      - ${err.field}: ${err.message}`);
              });
              result.errors.push({
                record,
                error: new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`),
              });
              result.skipped++;
              continue;
            }
            
            // Dry-run mode: just log what would happen
            if (dryRun) {
              console.log(
                `   [DRY RUN] Would upsert: ${record.make} ${record.component} (${record.damageLevel})`
              );
              result.imported++;
            } else {
              // Perform idempotent upsert
              const upsertResult = await idempotentUpsert.upsertDeduction(record);
              
              if (upsertResult.error) {
                console.error(
                  `   ❌ Error upserting ${record.make} ${record.component} (${record.damageLevel}):`,
                  upsertResult.error.message
                );
                result.errors.push({ record, error: upsertResult.error });
                result.skipped++;
              } else {
                if (upsertResult.action === 'inserted') result.imported++;
                if (upsertResult.action === 'updated') result.updated++;
                if (upsertResult.action === 'skipped') result.skipped++;
              }
            }
          } catch (error) {
            console.error(
              `   ❌ Unexpected error processing ${record.make} ${record.component} (${record.damageLevel}):`,
              error
            );
            result.errors.push({
              record,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            result.skipped++;
          }
        }
        
        return result;
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    // Record success in registry (skip for dry-run)
    if (!dryRun && registryId) {
      await seedRegistryService.recordSuccess(registryId, {
        recordsImported: stats.totalImported,
        recordsUpdated: stats.totalUpdated,
        recordsSkipped: stats.totalSkipped,
        executionTimeMs: executionTime,
      });
    }
    
    // Print comprehensive summary report
    console.log('\n' + '='.repeat(60));
    console.log('📈 SEED EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Script:           ${scriptName}`);
    console.log(`Mode:             ${dryRun ? 'DRY RUN' : forceRun ? 'FORCE' : 'NORMAL'}`);
    console.log(`Total Records:    ${stats.totalRecords}`);
    console.log(`✅ Imported:      ${stats.totalImported}`);
    console.log(`🔄 Updated:       ${stats.totalUpdated}`);
    console.log(`⏭️  Skipped:       ${stats.totalSkipped}`);
    console.log(`❌ Errors:        ${stats.totalErrors}`);
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));
    
    // Print error details if any
    if (stats.errors.length > 0) {
      console.log('\n❌ ERROR DETAILS:');
      console.log('-'.repeat(60));
      stats.errors.forEach(({ record, error }, index) => {
        console.log(`${index + 1}. ${record.make} ${record.component} (${record.damageLevel})`);
        console.log(`   Error: ${error.message}`);
      });
      console.log('-'.repeat(60));
    }
    
    console.log('\n✅ Seed execution completed successfully\n');
    process.exit(0);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    // Record failure in registry (skip for dry-run)
    if (!dryRun && registryId) {
      await seedRegistryService.recordFailure(
        registryId,
        error as Error,
        executionTime
      );
    }
    
    console.error('\n' + '='.repeat(60));
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(60));
    console.error(error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Execute seed script
executeSeed();
