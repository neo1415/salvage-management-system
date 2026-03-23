/**
 * Nissan Damage Deduction Seed Script
 * 
 * Source: Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)
 *         Section 15 - DAMAGE DEDUCTION TABLE — Nissan Specific (Nigeria 2025/2026)
 * 
 * Usage:
 * - Test: tsx scripts/seeds/nissan/nissan-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/nissan/nissan-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/nissan/nissan-damage-deductions.seed.ts --force
 * 
 * Requirements: 6.2, 6.3, 6.6
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
const SCRIPT_NAME = 'nissan-damage-deductions';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

// Nissan damage deductions from official guide
const rawData = [
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

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 * 
 * Handles damage deduction data with unique constraint: (make, component, damageLevel)
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

async function executeSeed() {
  const startTime = Date.now();
  const scriptName = SCRIPT_NAME;
  
  console.log('\n' + '='.repeat(60));
  console.log('🌱 SEED SCRIPT: ' + scriptName);
  console.log('='.repeat(60));
  console.log(`📊 Total raw records: ${rawData.length}\n`);
  
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
    const records = transformToDbRecords(rawData);
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
