/**
 * Lexus Vehicle Valuation Seed Script
 * 
 * Source: Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)
 * Extracted from: scripts/import-lexus-valuations.ts
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/lexus/lexus-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/lexus/lexus-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/lexus/lexus-valuations.seed.ts --force
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
const SCRIPT_NAME = 'lexus-valuations';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Lexus vehicle valuation data from official Lexus Nigeria guide (Feb 2026)
 * Covers models: ES, IS, RX, GX, LX, NX, LS Series
 */
const lexusRawData = [
  // ES Series
  { make: 'Lexus', model: 'ES300', year: 2000, nigUsedLow: 500000, nigUsedHigh: 900000, tokunboLow: 700000, tokunboHigh: 1300000, avgUsed: 700000, avgTokunbo: 1000000 },
  { make: 'Lexus', model: 'ES300', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1100000, tokunboLow: 900000, tokunboHigh: 1700000, avgUsed: 850000, avgTokunbo: 1300000 },
  { make: 'Lexus', model: 'ES330', year: 2004, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Lexus', model: 'ES350', year: 2006, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Lexus', model: 'ES350', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'ES350', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'ES350', year: 2012, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 7800000 },
  { make: 'Lexus', model: 'ES350', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, tokunboLow: 8000000, tokunboHigh: 13000000, avgUsed: 5800000, avgTokunbo: 10500000 },
  { make: 'Lexus', model: 'ES350', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 7000000, avgTokunbo: 14000000 },
  { make: 'Lexus', model: 'ES350', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 13000000, tokunboLow: 15000000, tokunboHigh: 25000000, avgUsed: 10000000, avgTokunbo: 20000000 },
  { make: 'Lexus', model: 'ES350', year: 2020, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },
  { make: 'Lexus', model: 'ES350', year: 2022, tokunboLow: 35000000, tokunboHigh: 50000000, avgTokunbo: 42500000 },
  { make: 'Lexus', model: 'ES350', year: 2024, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },

  // IS Series
  { make: 'Lexus', model: 'IS250', year: 2006, nigUsedLow: 1000000, nigUsedHigh: 1900000, tokunboLow: 1500000, tokunboHigh: 2800000, avgUsed: 1400000, avgTokunbo: 2100000 },
  { make: 'Lexus', model: 'IS250', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'IS250', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 3800000, tokunboLow: 3500000, tokunboHigh: 6500000, avgUsed: 2900000, avgTokunbo: 5000000 },
  { make: 'Lexus', model: 'IS250', year: 2011, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 9000000, avgUsed: 3800000, avgTokunbo: 7000000 },
  { make: 'Lexus', model: 'IS250', year: 2013, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 7000000, tokunboHigh: 12000000, avgUsed: 5000000, avgTokunbo: 9500000 },
  { make: 'Lexus', model: 'IS250', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 7500000, tokunboLow: 8000000, tokunboHigh: 14000000, avgUsed: 5800000, avgTokunbo: 11000000 },
  { make: 'Lexus', model: 'IS300', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 17000000, avgUsed: 7000000, avgTokunbo: 13500000 },
  { make: 'Lexus', model: 'IS300', year: 2018, nigUsedLow: 7000000, nigUsedHigh: 12000000, tokunboLow: 14000000, tokunboHigh: 22000000, avgUsed: 9500000, avgTokunbo: 18000000 },
  { make: 'Lexus', model: 'IS350', year: 2021, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },
  { make: 'Lexus', model: 'IS350', year: 2023, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },

  // RX Series
  { make: 'Lexus', model: 'RX300', year: 2000, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Lexus', model: 'RX300', year: 2002, nigUsedLow: 700000, nigUsedHigh: 1300000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 1000000, avgTokunbo: 1500000 },
  { make: 'Lexus', model: 'RX330', year: 2004, nigUsedLow: 900000, nigUsedHigh: 1700000, tokunboLow: 1400000, tokunboHigh: 2600000, avgUsed: 1300000, avgTokunbo: 2000000 },
  { make: 'Lexus', model: 'RX350', year: 2006, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Lexus', model: 'RX350', year: 2007, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4000000 },
  { make: 'Lexus', model: 'RX350', year: 2008, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'RX350', year: 2010, nigUsedLow: 2500000, nigUsedHigh: 5500000, tokunboLow: 5000000, tokunboHigh: 9500000, avgUsed: 4000000, avgTokunbo: 7300000 },
  { make: 'Lexus', model: 'RX350', year: 2011, nigUsedLow: 3500000, nigUsedHigh: 7000000, tokunboLow: 7000000, tokunboHigh: 13000000, avgUsed: 5300000, avgTokunbo: 10000000 },
  { make: 'Lexus', model: 'RX350', year: 2013, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 7500000, avgTokunbo: 14000000 },
  { make: 'Lexus', model: 'RX350', year: 2014, nigUsedLow: 6000000, nigUsedHigh: 12000000, tokunboLow: 13000000, tokunboHigh: 22000000, avgUsed: 9000000, avgTokunbo: 17500000 },
  { make: 'Lexus', model: 'RX350', year: 2016, nigUsedLow: 8000000, nigUsedHigh: 15000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 11500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'RX350', year: 2018, nigUsedLow: 12000000, nigUsedHigh: 22000000, tokunboLow: 25000000, tokunboHigh: 40000000, avgUsed: 17000000, avgTokunbo: 32500000 },
  { make: 'Lexus', model: 'RX350', year: 2019, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },
  { make: 'Lexus', model: 'RX350', year: 2020, tokunboLow: 42000000, tokunboHigh: 60000000, avgTokunbo: 51000000 },
  { make: 'Lexus', model: 'RX350', year: 2022, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Lexus', model: 'RX350', year: 2024, tokunboLow: 80000000, tokunboHigh: 115000000, avgTokunbo: 97500000 },

  // GX Series
  { make: 'Lexus', model: 'GX470', year: 2003, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Lexus', model: 'GX470', year: 2005, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4500000 },
  { make: 'Lexus', model: 'GX470', year: 2007, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 4500000, tokunboHigh: 8000000, avgUsed: 3800000, avgTokunbo: 6300000 },
  { make: 'Lexus', model: 'GX470', year: 2009, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 6000000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 8000000 },
  { make: 'Lexus', model: 'GX460', year: 2010, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 7000000, tokunboHigh: 14000000, avgUsed: 6000000, avgTokunbo: 10500000 },
  { make: 'Lexus', model: 'GX460', year: 2013, nigUsedLow: 6000000, nigUsedHigh: 11000000, tokunboLow: 11000000, tokunboHigh: 20000000, avgUsed: 8500000, avgTokunbo: 15500000 },
  { make: 'Lexus', model: 'GX460', year: 2016, nigUsedLow: 9000000, nigUsedHigh: 16000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 12500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'GX460', year: 2019, nigUsedLow: 13000000, nigUsedHigh: 24000000, tokunboLow: 25000000, tokunboHigh: 42000000, avgUsed: 18500000, avgTokunbo: 33500000 },
  { make: 'Lexus', model: 'GX550', year: 2024, tokunboLow: 100000000, tokunboHigh: 150000000, avgTokunbo: 125000000 },
  { make: 'Lexus', model: 'GX550', year: 2025, tokunboLow: 120000000, tokunboHigh: 165000000, avgTokunbo: 142500000 },

  // LX Series
  { make: 'Lexus', model: 'LX470', year: 2000, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2500000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'LX470', year: 2003, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3300000, avgTokunbo: 5300000 },
  { make: 'Lexus', model: 'LX470', year: 2007, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 4500000, avgTokunbo: 7500000 },
  { make: 'Lexus', model: 'LX570', year: 2008, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 7000000, tokunboHigh: 15000000, avgUsed: 6000000, avgTokunbo: 11000000 },
  { make: 'Lexus', model: 'LX570', year: 2010, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 12000000, tokunboHigh: 22000000, avgUsed: 7500000, avgTokunbo: 17000000 },
  { make: 'Lexus', model: 'LX570', year: 2013, nigUsedLow: 7000000, nigUsedHigh: 14000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 10500000, avgTokunbo: 24000000 },
  { make: 'Lexus', model: 'LX570', year: 2015, nigUsedLow: 10000000, nigUsedHigh: 20000000, tokunboLow: 25000000, tokunboHigh: 45000000, avgUsed: 15000000, avgTokunbo: 35000000 },
  { make: 'Lexus', model: 'LX570', year: 2016, nigUsedLow: 14000000, nigUsedHigh: 26000000, tokunboLow: 32000000, tokunboHigh: 55000000, avgUsed: 20000000, avgTokunbo: 43500000 },
  { make: 'Lexus', model: 'LX570', year: 2017, nigUsedLow: 18000000, nigUsedHigh: 34000000, tokunboLow: 45000000, tokunboHigh: 72000000, avgUsed: 26000000, avgTokunbo: 58500000 },
  { make: 'Lexus', model: 'LX570', year: 2018, nigUsedLow: 22000000, nigUsedHigh: 40000000, tokunboLow: 55000000, tokunboHigh: 85000000, avgUsed: 31000000, avgTokunbo: 70000000 },
  { make: 'Lexus', model: 'LX570', year: 2019, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Lexus', model: 'LX570', year: 2020, tokunboLow: 75000000, tokunboHigh: 110000000, avgTokunbo: 92500000 },
  { make: 'Lexus', model: 'LX600', year: 2022, tokunboLow: 120000000, tokunboHigh: 180000000, avgTokunbo: 150000000 },
  { make: 'Lexus', model: 'LX600', year: 2024, tokunboLow: 150000000, tokunboHigh: 220000000, avgTokunbo: 185000000 },

  // NX Series
  { make: 'Lexus', model: 'NX200t', year: 2015, nigUsedLow: 6000000, nigUsedHigh: 11000000, tokunboLow: 12000000, tokunboHigh: 20000000, avgUsed: 8500000, avgTokunbo: 16000000 },
  { make: 'Lexus', model: 'NX300', year: 2018, nigUsedLow: 10000000, nigUsedHigh: 18000000, tokunboLow: 20000000, tokunboHigh: 32000000, avgUsed: 14000000, avgTokunbo: 26000000 },
  { make: 'Lexus', model: 'NX350', year: 2022, tokunboLow: 45000000, tokunboHigh: 65000000, avgTokunbo: 55000000 },
  { make: 'Lexus', model: 'NX350', year: 2024, tokunboLow: 55000000, tokunboHigh: 80000000, avgTokunbo: 67500000 },

  // LS Series
  { make: 'Lexus', model: 'LS400', year: 2000, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Lexus', model: 'LS430', year: 2004, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2300000, avgTokunbo: 3800000 },
  { make: 'Lexus', model: 'LS460', year: 2007, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3800000, avgTokunbo: 6500000 },
  { make: 'Lexus', model: 'LS460', year: 2010, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 6000000, avgTokunbo: 11500000 },
  { make: 'Lexus', model: 'LS460', year: 2013, nigUsedLow: 6000000, nigUsedHigh: 12000000, tokunboLow: 13000000, tokunboHigh: 23000000, avgUsed: 9000000, avgTokunbo: 18000000 },
  { make: 'Lexus', model: 'LS500', year: 2018, nigUsedLow: 15000000, nigUsedHigh: 28000000, tokunboLow: 35000000, tokunboHigh: 55000000, avgUsed: 21500000, avgTokunbo: 45000000 },
  { make: 'Lexus', model: 'LS500', year: 2021, tokunboLow: 60000000, tokunboHigh: 90000000, avgTokunbo: 75000000 },
  { make: 'Lexus', model: 'LS500', year: 2023, tokunboLow: 80000000, tokunboHigh: 120000000, avgTokunbo: 100000000 },
];

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 * 
 * Handles multiple condition categories per row:
 * - nig_used_low: Nigerian used vehicles (lower price range)
 * - tokunbo_low: Foreign used vehicles (lower price range)
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
        dataSource: 'Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
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
        dataSource: 'Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
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
  console.log(`📊 Total raw records: ${lexusRawData.length}\n`);
  
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
    const records = transformToDbRecords(lexusRawData);
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
