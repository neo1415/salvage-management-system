/**
 * Toyota Damage Deduction Seed Script
 * 
 * Import Toyota-specific damage deductions based on Nigerian market repair costs.
 * 
 * Usage:
 * - Test: tsx scripts/seeds/toyota/toyota-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/toyota/toyota-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/toyota/toyota-damage-deductions.seed.ts --force
 * 
 * Features:
 * - Idempotent: Safe to run multiple times
 * - Registry tracking: Automatically skips if already executed (use --force to re-run)
 * - Batch processing: Processes records in batches of 50
 * - Error isolation: One failure doesn't stop others
 * - Validation: Checks required fields and ranges before insertion
 * - Audit logging: All changes tracked in valuation_audit_logs
 * - Dry-run mode: Test without making changes
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
const SCRIPT_NAME = 'toyota-damage-deductions';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Toyota damage deduction data based on Nigerian market repair costs
 * Source: scripts/import-toyota-damage-deductions.ts
 */
const rawData = [
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

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 * 
 * Handles damage deduction data with unique constraint: (make, component, damageLevel)
 * 
 * Each row in rawData produces one database record.
 * 
 * @param rawData - Array of raw deduction data
 * @returns Array of transformed deduction records ready for database insertion
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
 * 
 * Workflow:
 * 1. Check command-line flags (--force, --dry-run)
 * 2. Check registry for previous execution (skip unless --force)
 * 3. Record start in registry
 * 4. Transform raw data to database records
 * 5. Validate all records
 * 6. Process records in batches
 * 7. Handle errors gracefully (continue on individual failures)
 * 8. Record success/failure in registry
 * 9. Print comprehensive summary report
 */
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
