/**
 * Kia Vehicle Valuation Seed Script
 * 
 * Source: Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
 * Extracted from: scripts/import-hyundai-kia-valuations.ts (Kia portion)
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/kia/kia-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/kia/kia-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/kia/kia-valuations.seed.ts --force
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
import { validationService, type ValuationRecord } from '@/features/seeds/services/validation.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = 'kia-valuations';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Kia vehicle valuation data from official Hyundai & Kia guide (Feb 2026)
 * Covers models: Sportage, Sorento, Rio, Picanto, Cerato, Forte, Optima, K5, Soul, Stinger, Telluride
 */
const kiaRawData = [
  // Sportage
  { make: 'Kia', model: 'Sportage', year: 2006, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Sportage', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Sportage', year: 2010, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Sportage', year: 2012, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Sportage', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Sportage', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'Sportage', year: 2018, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 9500000, tokunboHigh: 16000000, avgUsed: 7000000, avgTokunbo: 12800000 },
  { make: 'Kia', model: 'Sportage', year: 2020, nigUsedLow: 7500000, nigUsedHigh: 13000000, tokunboLow: 14000000, tokunboHigh: 23000000, avgUsed: 10300000, avgTokunbo: 18500000 },
  { make: 'Kia', model: 'Sportage', year: 2022, tokunboLow: 20000000, tokunboHigh: 32000000, avgTokunbo: 26000000 },
  { make: 'Kia', model: 'Sportage', year: 2024, tokunboLow: 28000000, tokunboHigh: 45000000, avgTokunbo: 36500000 },

  // Sorento
  { make: 'Kia', model: 'Sorento', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Sorento', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2800000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4100000 },
  { make: 'Kia', model: 'Sorento', year: 2012, nigUsedLow: 2200000, nigUsedHigh: 4200000, tokunboLow: 4000000, tokunboHigh: 7500000, avgUsed: 3200000, avgTokunbo: 5800000 },
  { make: 'Kia', model: 'Sorento', year: 2014, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4300000, avgTokunbo: 7800000 },
  { make: 'Kia', model: 'Sorento', year: 2016, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Kia', model: 'Sorento', year: 2018, nigUsedLow: 6500000, nigUsedHigh: 11500000, tokunboLow: 12500000, tokunboHigh: 20000000, avgUsed: 9000000, avgTokunbo: 16300000 },
  { make: 'Kia', model: 'Sorento', year: 2020, nigUsedLow: 9500000, nigUsedHigh: 16000000, tokunboLow: 18000000, tokunboHigh: 28000000, avgUsed: 12800000, avgTokunbo: 23000000 },
  { make: 'Kia', model: 'Sorento', year: 2022, tokunboLow: 28000000, tokunboHigh: 42000000, avgTokunbo: 35000000 },
  { make: 'Kia', model: 'Sorento', year: 2024, tokunboLow: 38000000, tokunboHigh: 58000000, avgTokunbo: 48000000 },

  // Rio/Picanto
  { make: 'Kia', model: 'Rio', year: 2008, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Kia', model: 'Rio', year: 2010, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Rio', year: 2012, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1600000, tokunboHigh: 3200000, avgUsed: 1400000, avgTokunbo: 2400000 },
  { make: 'Kia', model: 'Rio', year: 2014, nigUsedLow: 1300000, nigUsedHigh: 2500000, tokunboLow: 2300000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Rio', year: 2016, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Rio', year: 2018, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Picanto', year: 2012, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1200000, tokunboHigh: 2400000, avgUsed: 1000000, avgTokunbo: 1800000 },
  { make: 'Kia', model: 'Picanto', year: 2014, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Picanto', year: 2016, nigUsedLow: 1400000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2100000, avgTokunbo: 3800000 },

  // Cerato/Forte
  { make: 'Kia', model: 'Cerato', year: 2008, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Kia', model: 'Cerato', year: 2010, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Kia', model: 'Cerato', year: 2012, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Cerato', year: 2014, nigUsedLow: 1500000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 4500000, avgUsed: 2100000, avgTokunbo: 3500000 },
  { make: 'Kia', model: 'Cerato', year: 2016, nigUsedLow: 2000000, nigUsedHigh: 3800000, tokunboLow: 3500000, tokunboHigh: 6500000, avgUsed: 2900000, avgTokunbo: 5000000 },
  { make: 'Kia', model: 'Cerato', year: 2018, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 9500000, avgUsed: 4300000, avgTokunbo: 7500000 },
  { make: 'Kia', model: 'Forte', year: 2020, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Kia', model: 'Forte', year: 2022, tokunboLow: 13000000, tokunboHigh: 20000000, avgTokunbo: 16500000 },

  // Optima/K5
  { make: 'Kia', model: 'Optima', year: 2006, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Kia', model: 'Optima', year: 2008, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Optima', year: 2010, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Optima', year: 2012, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Optima', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Optima', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Optima', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'K5', year: 2020, nigUsedLow: 5500000, nigUsedHigh: 10000000, tokunboLow: 10000000, tokunboHigh: 17000000, avgUsed: 7800000, avgTokunbo: 13500000 },
  { make: 'Kia', model: 'K5', year: 2022, tokunboLow: 15000000, tokunboHigh: 24000000, avgTokunbo: 19500000 },
  { make: 'Kia', model: 'K5', year: 2024, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },

  // Soul
  { make: 'Kia', model: 'Soul', year: 2010, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Soul', year: 2012, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Soul', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Soul', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Soul', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'Soul', year: 2020, tokunboLow: 12000000, tokunboHigh: 18000000, avgTokunbo: 15000000 },

  // Stinger
  { make: 'Kia', model: 'Stinger', year: 2018, nigUsedLow: 8000000, nigUsedHigh: 14000000, tokunboLow: 15000000, tokunboHigh: 24000000, avgUsed: 11000000, avgTokunbo: 19500000 },
  { make: 'Kia', model: 'Stinger', year: 2020, nigUsedLow: 12000000, nigUsedHigh: 20000000, tokunboLow: 22000000, tokunboHigh: 35000000, avgUsed: 16000000, avgTokunbo: 28500000 },
  { make: 'Kia', model: 'Stinger', year: 2022, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },

  // Telluride
  { make: 'Kia', model: 'Telluride', year: 2020, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Kia', model: 'Telluride', year: 2022, tokunboLow: 35000000, tokunboHigh: 52000000, avgTokunbo: 43500000 },
  { make: 'Kia', model: 'Telluride', year: 2024, tokunboLow: 48000000, tokunboHigh: 70000000, avgTokunbo: 59000000 },
];

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 */
function transformToDbRecords(rawData: any[]): ValuationRecord[] {
  const records: ValuationRecord[] = [];
  
  for (const item of rawData) {
    // Validate that basic fields exist
    if (!item.make || !item.model || !item.year) {
      console.warn('⚠️  Skipping invalid record (missing make, model, or year):', item);
      continue;
    }

    // Nigerian Used (if data present)
    if (
      item.nigUsedLow !== undefined &&
      item.nigUsedHigh !== undefined &&
      item.avgUsed !== undefined
    ) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'fair',
        lowPrice: item.nigUsedLow,
        highPrice: item.nigUsedHigh,
        averagePrice: item.avgUsed,
        dataSource: 'Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }

    // Tokunbo (Foreign Used) (if data present)
    if (
      item.tokunboLow !== undefined &&
      item.tokunboHigh !== undefined &&
      item.avgTokunbo !== undefined
    ) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'good',
        lowPrice: item.tokunboLow,
        highPrice: item.tokunboHigh,
        averagePrice: item.avgTokunbo,
        dataSource: 'Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
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
            const validation = validationService.validateValuation(record);
            if (!validation.valid) {
              console.error(
                `   ⚠️  Validation failed for ${record.year} ${record.make} ${record.model}:`
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
                `   [DRY RUN] Would upsert: ${record.year} ${record.make} ${record.model} (${record.conditionCategory})`
              );
              result.imported++;
            } else {
              // Perform idempotent upsert
              const upsertResult = await idempotentUpsert.upsertValuation(record);
              
              if (upsertResult.error) {
                console.error(
                  `   ❌ Error upserting ${record.year} ${record.make} ${record.model}:`,
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
              `   ❌ Unexpected error processing ${record.year} ${record.make} ${record.model}:`,
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
        console.log(`${index + 1}. ${record.year} ${record.make} ${record.model}`);
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
