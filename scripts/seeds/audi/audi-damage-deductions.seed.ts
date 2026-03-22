/**
 * Audi Damage Deduction Seed Script
 * 
 * Source: Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
 * Extracted from: scripts/import-audi-damage-deductions.ts
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/audi/audi-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/audi/audi-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/audi/audi-damage-deductions.seed.ts --force
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { batchProcessor, type BatchResult } from '@/features/seeds/services/batch-processor.service';
import { validationService, type DeductionRecord } from '@/features/seeds/services/validation.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = 'audi-damage-deductions';
const BATCH_SIZE = 50;
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
    notes: 'Replace + paint match. Genuine Audi bumper â‚¦200â€“450k, local copy â‚¦60â€“120k.',
  },
  {
    make: 'Audi',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 250000,
    repairCostHigh: 500000,
    valuationDeductionLow: 600000,
    valuationDeductionHigh: 1200000,
    notes: 'Full replacement. Airbag deployment likely â€” inspect crash sensors.',
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
    notes: 'Genuine Audi glass â‚¦200â€“400k. Local glass â‚¦80â€“150k. ADAS recalib adds â‚¦50k+.',
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
    notes: 'Polish/restore â‚¦20k. Lens replacement â‚¦60k. OEM Audi LED headlight â‚¦400kâ€“1M.',
  },
  {
    make: 'Audi',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 800000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 2000000,
    notes: 'Genuine Audi LED/Matrix unit extremely expensive. Used unit â‚¦200â€“500k.',
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
    notes: 'OLED taillights on newer Audi very expensive. Used from Cotonou: â‚¦150â€“400k.',
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
    notes: 'Genuine Audi grille â‚¦80â€“250k. Sensors/cameras embedded in some models.',
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
    notes: 'Valve cover gasket most common. Higher deduction â€” signals maintenance neglect.',
  },
  {
    make: 'Audi',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 800000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 8000000,
    notes: 'Repair or source used Audi engine from Cotonou (â‚¦600kâ€“2M). Critical deduction.',
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
    notes: 'Replacement gearbox from Cotonou â‚¦800kâ€“2.5M. Highest deduction category.',
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
    notes: 'Air suspension (Q7, A6, A8) replacement: â‚¦300kâ€“800k per strut (OEM).',
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
    notes: 'Audi full leather re-trim â‚¦250â€“600k. Partial repair â‚¦100â€“200k.',
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
    notes: 'MMI screen replacement: â‚¦200â€“600k. Dashboard re-pad: â‚¦100â€“250k.',
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
    notes: 'Compressor: â‚¦150â€“350k. Condenser: â‚¦100â€“250k. Regas: â‚¦30â€“60k.',
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


// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformToDbRecords(rawData: any[]): DeductionRecord[] {
  const records: DeductionRecord[] = [];
  
  for (const item of rawData) {
    if (!item.make || !item.component || !item.damageLevel) {
      console.warn('⚠️  Skipping invalid record (missing make, component, or damageLevel):', item);
      continue;
    }

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
  console.log(`📊 Total raw records: ${audiDamageDeductions.length}\n`);
  
  const forceRun = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  
  if (!forceRun && !dryRun) {
    const hasRun = await seedRegistryService.hasBeenExecuted(scriptName);
    if (hasRun) {
      console.log('⏭️  Seed already executed. Use --force to re-run.');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    }
  }
  
  if (dryRun) console.log('🔍 DRY RUN MODE - No changes will be made\n');
  if (forceRun) console.log('🔄 FORCE MODE - Re-running seed\n');
  
  let registryId: string | null = null;
  if (!dryRun) {
    registryId = await seedRegistryService.recordStart(scriptName);
    console.log(`📝 Registry entry created: ${registryId}\n`);
  }
  
  try {
    console.log('🔄 Transforming raw data...');
    const records = transformToDbRecords(audiDamageDeductions);
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
            const validation = validationService.validateDeduction(record);
            if (!validation.valid) {
              console.error(`   ⚠️  Validation failed for ${record.make} ${record.component} (${record.damageLevel}):`);
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
            
            if (dryRun) {
              console.log(`   [DRY RUN] Would upsert: ${record.make} ${record.component} (${record.damageLevel})`);
              result.imported++;
            } else {
              const upsertResult = await idempotentUpsert.upsertDeduction(record);
              
              if (upsertResult.error) {
                console.error(`   ❌ Error upserting ${record.make} ${record.component} (${record.damageLevel}):`, upsertResult.error.message);
                result.errors.push({ record, error: upsertResult.error });
                result.skipped++;
              } else {
                if (upsertResult.action === 'inserted') result.imported++;
                if (upsertResult.action === 'updated') result.updated++;
                if (upsertResult.action === 'skipped') result.skipped++;
              }
            }
          } catch (error) {
            console.error(`   ❌ Unexpected error processing ${record.make} ${record.component} (${record.damageLevel}):`, error);
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
    
    if (!dryRun && registryId) {
      await seedRegistryService.recordSuccess(registryId, {
        recordsImported: stats.totalImported,
        recordsUpdated: stats.totalUpdated,
        recordsSkipped: stats.totalSkipped,
        executionTimeMs: executionTime,
      });
    }
    
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

executeSeed();
