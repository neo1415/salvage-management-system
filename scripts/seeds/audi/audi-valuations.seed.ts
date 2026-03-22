/**
 * Audi Vehicle Valuation Seed Script
 * 
 * Source: Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
 * Extracted from: scripts/import-audi-valuations-direct.ts
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/audi/audi-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/audi/audi-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/audi/audi-valuations.seed.ts --force
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { batchProcessor, type BatchResult } from '@/features/seeds/services/batch-processor.service';
import { validationService, type ValuationRecord } from '@/features/seeds/services/validation.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = 'audi-valuations';
const BATCH_SIZE = 50;
const audiRawData = [
  // A3 Series (2000-2024)
  { make: 'Audi', model: 'A3', year: 2000, nigUsedLow: 600000, nigUsedHigh: 1000000, avgUsed: 800000 },
  { make: 'Audi', model: 'A3', year: 2003, nigUsedLow: 800000, nigUsedHigh: 1400000, avgUsed: 1100000 },
  { make: 'Audi', model: 'A3', year: 2005, nigUsedLow: 1000000, nigUsedHigh: 1800000, avgUsed: 1400000 },
  { make: 'Audi', model: 'A3', year: 2007, nigUsedLow: 1100000, nigUsedHigh: 2000000, avgUsed: 1600000 },
  { make: 'Audi', model: 'A3', year: 2009, nigUsedLow: 1300000, nigUsedHigh: 2400000, avgUsed: 1900000 },
  { make: 'Audi', model: 'A3', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 3500000, avgUsed: 2800000 },
  { make: 'Audi', model: 'A3', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 4500000, avgUsed: 3500000 },
  { make: 'Audi', model: 'A3', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6000000, avgUsed: 4800000 },
  { make: 'Audi', model: 'A3', year: 2018, nigUsedLow: 4500000, nigUsedHigh: 8000000, avgUsed: 6300000 },
  { make: 'Audi', model: 'A3', year: 2020, tokunboLow: 11000000, tokunboHigh: 18000000, avgTokunbo: 14500000 },
  { make: 'Audi', model: 'A3', year: 2022, tokunboLow: 16000000, tokunboHigh: 24000000, avgTokunbo: 20000000 },
  { make: 'Audi', model: 'A3', year: 2024, tokunboLow: 22000000, tokunboHigh: 32000000, avgTokunbo: 27000000 },

  // A4 Series (2000-2024) - Most popular Audi in Nigeria
  { make: 'Audi', model: 'A4', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, avgUsed: 700000 },
  { make: 'Audi', model: 'A4', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, avgUsed: 850000 },
  { make: 'Audi', model: 'A4', year: 2004, nigUsedLow: 700000, nigUsedHigh: 1300000, avgUsed: 1000000 },
  { make: 'Audi', model: 'A4', year: 2006, nigUsedLow: 900000, nigUsedHigh: 1700000, avgUsed: 1300000 },
  { make: 'Audi', model: 'A4', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2200000, avgUsed: 1700000 },
  { make: 'Audi', model: 'A4', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 2800000, avgUsed: 2100000 },
  { make: 'Audi', model: 'A4', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000 },
  { make: 'Audi', model: 'A4', year: 2014, nigUsedLow: 2800000, nigUsedHigh: 5000000, avgUsed: 3900000 },
  { make: 'Audi', model: 'A4', year: 2016, nigUsedLow: 4000000, nigUsedHigh: 7000000, avgUsed: 5500000 },
  { make: 'Audi', model: 'A4', year: 2018, nigUsedLow: 5500000, nigUsedHigh: 9500000, avgUsed: 7500000 },
  { make: 'Audi', model: 'A4', year: 2020, tokunboLow: 17000000, tokunboHigh: 26000000, avgTokunbo: 21500000 },
  { make: 'Audi', model: 'A4', year: 2022, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Audi', model: 'A4', year: 2024, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },

  // A6 Series (2000-2024) - Executive flagship
  { make: 'Audi', model: 'A6', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, avgUsed: 700000 },
  { make: 'Audi', model: 'A6', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, avgUsed: 850000 },
  { make: 'Audi', model: 'A6', year: 2004, nigUsedLow: 700000, nigUsedHigh: 1300000, avgUsed: 1000000 },
  { make: 'Audi', model: 'A6', year: 2006, nigUsedLow: 900000, nigUsedHigh: 1800000, avgUsed: 1400000 },
  { make: 'Audi', model: 'A6', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2500000, avgUsed: 1900000 },
  { make: 'Audi', model: 'A6', year: 2010, nigUsedLow: 1600000, nigUsedHigh: 3200000, avgUsed: 2400000 },
  { make: 'Audi', model: 'A6', year: 2012, nigUsedLow: 2500000, nigUsedHigh: 5000000, avgUsed: 3800000 },
  { make: 'Audi', model: 'A6', year: 2014, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'A6', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, avgUsed: 7000000 },
  { make: 'Audi', model: 'A6', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 13000000, avgUsed: 10000000 },
  { make: 'Audi', model: 'A6', year: 2020, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Audi', model: 'A6', year: 2022, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },
  { make: 'Audi', model: 'A6', year: 2024, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },

  // Q3 Series (2012-2024) - Compact luxury SUV
  { make: 'Audi', model: 'Q3', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 4000000, avgUsed: 3000000 },
  { make: 'Audi', model: 'Q3', year: 2014, nigUsedLow: 2800000, nigUsedHigh: 5000000, avgUsed: 3900000 },
  { make: 'Audi', model: 'Q3', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q3', year: 2019, tokunboLow: 12000000, tokunboHigh: 20000000, avgTokunbo: 16000000 },
  { make: 'Audi', model: 'Q3', year: 2022, tokunboLow: 20000000, tokunboHigh: 30000000, avgTokunbo: 25000000 },
  { make: 'Audi', model: 'Q3', year: 2024, tokunboLow: 28000000, tokunboHigh: 40000000, avgTokunbo: 34000000 },

  // Q5 Series (2009-2025) - Mid-size luxury SUV
  { make: 'Audi', model: 'Q5', year: 2009, nigUsedLow: 1500000, nigUsedHigh: 2800000, avgUsed: 2100000 },
  { make: 'Audi', model: 'Q5', year: 2011, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000 },
  { make: 'Audi', model: 'Q5', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 4800000, avgUsed: 3600000 },
  { make: 'Audi', model: 'Q5', year: 2015, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q5', year: 2017, nigUsedLow: 5000000, nigUsedHigh: 8500000, avgUsed: 6800000 },
  { make: 'Audi', model: 'Q5', year: 2019, nigUsedLow: 7000000, nigUsedHigh: 12000000, avgUsed: 9500000 },
  { make: 'Audi', model: 'Q5', year: 2021, tokunboLow: 22000000, tokunboHigh: 33000000, avgTokunbo: 27500000 },
  { make: 'Audi', model: 'Q5', year: 2023, tokunboLow: 30000000, tokunboHigh: 45000000, avgTokunbo: 37500000 },
  { make: 'Audi', model: 'Q5', year: 2025, tokunboLow: 38000000, tokunboHigh: 55000000, avgTokunbo: 46500000 },

  // Q7 Series (2007-2024) - Full-size luxury SUV
  { make: 'Audi', model: 'Q7', year: 2007, nigUsedLow: 1500000, nigUsedHigh: 3000000, avgUsed: 2300000 },
  { make: 'Audi', model: 'Q7', year: 2009, nigUsedLow: 2000000, nigUsedHigh: 4000000, avgUsed: 3000000 },
  { make: 'Audi', model: 'Q7', year: 2011, nigUsedLow: 2500000, nigUsedHigh: 5000000, avgUsed: 3800000 },
  { make: 'Audi', model: 'Q7', year: 2013, nigUsedLow: 3500000, nigUsedHigh: 6500000, avgUsed: 5000000 },
  { make: 'Audi', model: 'Q7', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, avgUsed: 5800000 },
  { make: 'Audi', model: 'Q7', year: 2016, nigUsedLow: 6000000, nigUsedHigh: 11000000, avgUsed: 8500000 },
  { make: 'Audi', model: 'Q7', year: 2018, nigUsedLow: 8000000, nigUsedHigh: 14000000, avgUsed: 11000000 },
  { make: 'Audi', model: 'Q7', year: 2020, tokunboLow: 25000000, tokunboHigh: 40000000, avgTokunbo: 32500000 },
  { make: 'Audi', model: 'Q7', year: 2022, tokunboLow: 38000000, tokunboHigh: 55000000, avgTokunbo: 46500000 },
  { make: 'Audi', model: 'Q7', year: 2024, tokunboLow: 50000000, tokunboHigh: 70000000, avgTokunbo: 60000000 },
];


// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformToDbRecords(rawData: any[]): ValuationRecord[] {
  const records: ValuationRecord[] = [];
  
  for (const item of rawData) {
    if (!item.make || !item.model || !item.year) {
      console.warn('⚠️  Skipping invalid record (missing make, model, or year):', item);
      continue;
    }

    if (item.nigUsedLow !== undefined && item.nigUsedHigh !== undefined && item.avgUsed !== undefined) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'fair',
        lowPrice: item.nigUsedLow,
        highPrice: item.nigUsedHigh,
        averagePrice: item.avgUsed,
        dataSource: 'Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }

    if (item.tokunboLow !== undefined && item.tokunboHigh !== undefined && item.avgTokunbo !== undefined) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'good',
        lowPrice: item.tokunboLow,
        highPrice: item.tokunboHigh,
        averagePrice: item.avgTokunbo,
        dataSource: 'Audi Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
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
  console.log(`📊 Total raw records: ${audiRawData.length}\n`);
  
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
    const records = transformToDbRecords(audiRawData);
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
            const validation = validationService.validateValuation(record);
            if (!validation.valid) {
              console.error(`   ⚠️  Validation failed for ${record.year} ${record.make} ${record.model}:`);
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
              console.log(`   [DRY RUN] Would upsert: ${record.year} ${record.make} ${record.model} (${record.conditionCategory})`);
              result.imported++;
            } else {
              const upsertResult = await idempotentUpsert.upsertValuation(record);
              
              if (upsertResult.error) {
                console.error(`   ❌ Error upserting ${record.year} ${record.make} ${record.model}:`, upsertResult.error.message);
                result.errors.push({ record, error: upsertResult.error });
                result.skipped++;
              } else {
                if (upsertResult.action === 'inserted') result.imported++;
                if (upsertResult.action === 'updated') result.updated++;
                if (upsertResult.action === 'skipped') result.skipped++;
              }
            }
          } catch (error) {
            console.error(`   ❌ Unexpected error processing ${record.year} ${record.make} ${record.model}:`, error);
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
        console.log(`${index + 1}. ${record.year} ${record.make} ${record.model}`);
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
