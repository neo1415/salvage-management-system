/**
 * Kia Damage Deduction Seed Script
 * 
 * Source: Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
 * Extracted from: scripts/import-hyundai-kia-damage-deductions.ts (Kia portion)
 * Note: Kia and Hyundai share platform engineering under Hyundai Motor Group
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/kia/kia-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/kia/kia-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/kia/kia-damage-deductions.seed.ts --force
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
const SCRIPT_NAME = 'kia-damage-deductions';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Kia damage deduction data from official Hyundai & Kia guide (Feb 2026)
 * These deductions are shared between Kia and Hyundai due to platform engineering
 * Data is identical to Hyundai but with make='Kia'
 */
const kiaRawData = [
  // Front Bumper
  {
    make: 'Kia',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 200000,
    notes: 'Respray + minor repair. Hyundai/Kia bumpers share design language. Workshop: ₦40–70k.',
  },
  {
    make: 'Kia',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 180000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 500000,
    notes: 'Genuine bumper ₦100–250k. Local copy ₦40–80k. Parking sensors common — verify function.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 60000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 180000,
    notes: 'Touch-up. Rear camera/sensor check — common on both brands. Recalibration ₦25–50k.',
  },
  {
    make: 'Kia',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 150000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 450000,
    notes: 'Full panel. Boot alignment check. Genuine rear sensors: ₦15–40k each.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 55000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 160000,
    notes: 'Panel beating + respray. Colour matching routine for good workshops. Allow 2 days.',
  },
  {
    make: 'Kia',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 450000,
    notes: 'Multiple dents or hinge damage. New hood from Berger/Apapa: ₦80–180k.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 50000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 150000,
    notes: 'Pull + paint. Hyundai/Kia fenders widely available at Berger/Apapa.',
  },
  {
    make: 'Kia',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 130000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 380000,
    notes: 'Panel replacement. Camera in fender mirror (on some Palisade/Telluride) — verify function.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 45000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 140000,
    notes: 'Dent pull + spot repair. Routine repair for good workshops.',
  },
  {
    make: 'Kia',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 140000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 380000,
    notes: 'Full respray. Power window mechanism check — common failure point.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 40000,
    repairCostHigh: 100000,
    valuationDeductionLow: 110000,
    valuationDeductionHigh: 280000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (common on Tucson/Sportage/Santa Fe/Sorento).',
  },
  {
    make: 'Kia',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 280000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 800000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 12000,
    repairCostHigh: 35000,
    valuationDeductionLow: 35000,
    valuationDeductionHigh: 90000,
    notes: 'Resin injection. ADAS recalibration required on 2018+ models: ₦40–80k.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 18000,
    repairCostHigh: 50000,
    valuationDeductionLow: 45000,
    valuationDeductionHigh: 140000,
    notes: 'Polish/restore. LED headlights common on 2016+ models — lens replacement ₦50–100k (local).',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 80000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 550000,
    notes: 'Valve cover gasket: ₦12–35k part + labour. WARNING: Theta II GDI engines (2011-2019) prone to oil consumption — check carefully.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 250000,
    repairCostHigh: 1000000,
    valuationDeductionLow: 900000,
    valuationDeductionHigh: 2800000,
    notes: 'WARNING: 7-speed DCT (2015-2019) known for shuddering/failure. Service ₦80–200k or rebuild ₦350k–1M.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 50000,
    repairCostHigh: 200000,
    valuationDeductionLow: 130000,
    valuationDeductionHigh: 550000,
    notes: 'Standard coil-spring suspension. Strut ₦150–450k per corner. Parts widely available.',
  },
  {
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
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
    make: 'Kia',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 900000,
    valuationDeductionHigh: 5500000,
    notes: 'Common on imported Hyundai/Kia. Deduct per verified mileage. Carfax/VIN history check essential for all buys.',
  },
];

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
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
  console.log(`📊 Total raw records: ${kiaRawData.length}\n`);
  
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
    const records = transformToDbRecords(kiaRawData);
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
