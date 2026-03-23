/**
 * Mercedes-Benz Vehicle Valuation Seed Script
 * 
 * Source: Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/mercedes/mercedes-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/mercedes/mercedes-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/mercedes/mercedes-valuations.seed.ts --force
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
const SCRIPT_NAME = 'mercedes-valuations';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Mercedes-Benz vehicle valuation data from official Mercedes-Benz in Nigeria 
 * Comprehensive Price & Valuation Guide (March 2026)
 * 
 * Transform the data into separate records for each condition category
 */
const mercedesRawData = [
  // C-Class (2002-2024)
  { make: 'Mercedes-Benz', model: 'C-Class W203', year: 2002, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1700000, avgUsed: 750000, avgTokunbo: 1300000 },
  { make: 'Mercedes-Benz', model: 'C-Class W203', year: 2005, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1200000, tokunboHigh: 2500000, avgUsed: 1100000, avgTokunbo: 1900000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 5000000, avgUsed: 1800000, avgTokunbo: 3500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6500000, avgUsed: 2500000, avgTokunbo: 4800000 },
  { make: 'Mercedes-Benz', model: 'C-Class W204', year: 2012, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 4500000, tokunboHigh: 9000000, avgUsed: 3300000, avgTokunbo: 6800000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2015, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 11500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2017, nigUsedLow: 4500000, nigUsedHigh: 10000000, tokunboLow: 13000000, tokunboHigh: 22000000, avgUsed: 7300000, avgTokunbo: 17500000 },
  { make: 'Mercedes-Benz', model: 'C-Class W205', year: 2018, nigUsedLow: 6000000, nigUsedHigh: 13000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 9500000, avgTokunbo: 24000000 },
  { make: 'Mercedes-Benz', model: 'C-Class W206', year: 2022, tokunboLow: 45000000, tokunboHigh: 75000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'C-Class W206', year: 2024, tokunboLow: 65000000, tokunboHigh: 95000000, avgTokunbo: 80000000 },
  { make: 'Mercedes-Benz', model: 'C43 AMG', year: 2017, tokunboLow: 25000000, tokunboHigh: 42000000, avgTokunbo: 33500000 },
  { make: 'Mercedes-Benz', model: 'C63 AMG', year: 2016, tokunboLow: 35000000, tokunboHigh: 65000000, avgTokunbo: 50000000 },

  // E-Class (2000-2024)
  { make: 'Mercedes-Benz', model: 'E-Class W210', year: 2000, nigUsedLow: 400000, nigUsedHigh: 800000, tokunboLow: 700000, tokunboHigh: 1500000, avgUsed: 600000, avgTokunbo: 1100000 },
  { make: 'Mercedes-Benz', model: 'E-Class W211', year: 2003, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W211', year: 2006, nigUsedLow: 900000, nigUsedHigh: 2000000, tokunboLow: 1500000, tokunboHigh: 3500000, avgUsed: 1400000, avgTokunbo: 2500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 6000000, tokunboHigh: 11000000, avgUsed: 3800000, avgTokunbo: 8500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W212', year: 2014, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 8000000, tokunboHigh: 14000000, avgUsed: 4500000, avgTokunbo: 11000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2017, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 14000000, tokunboHigh: 25000000, avgUsed: 7500000, avgTokunbo: 19500000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2019, tokunboLow: 30000000, tokunboHigh: 50000000, avgTokunbo: 40000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W213', year: 2021, tokunboLow: 50000000, tokunboHigh: 80000000, avgTokunbo: 65000000 },
  { make: 'Mercedes-Benz', model: 'E-Class W214', year: 2024, tokunboLow: 80000000, tokunboHigh: 120000000, avgTokunbo: 100000000 },
  { make: 'Mercedes-Benz', model: 'E43 AMG W213', year: 2017, tokunboLow: 35000000, tokunboHigh: 58000000, avgTokunbo: 46500000 },
  { make: 'Mercedes-Benz', model: 'E63 AMG W213', year: 2018, tokunboLow: 70000000, tokunboHigh: 120000000, avgTokunbo: 95000000 },

  // GLK-Class (2009-2015)
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2009, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 6500000, avgUsed: 2500000, avgTokunbo: 4800000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2012, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 8000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 11500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2013, nigUsedLow: 4000000, nigUsedHigh: 8000000, tokunboLow: 11000000, tokunboHigh: 18000000, avgUsed: 6000000, avgTokunbo: 14500000 },
  { make: 'Mercedes-Benz', model: 'GLK350', year: 2015, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 15000000, tokunboHigh: 25000000, avgUsed: 7500000, avgTokunbo: 20000000 },

  // GLC-Class (2016-2025)
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2016, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 18000000, tokunboHigh: 30000000, avgUsed: 7500000, avgTokunbo: 24000000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2017, nigUsedLow: 6000000, nigUsedHigh: 13000000, tokunboLow: 25000000, tokunboHigh: 42000000, avgUsed: 9500000, avgTokunbo: 33500000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2019, nigUsedLow: 9000000, nigUsedHigh: 18000000, tokunboLow: 35000000, tokunboHigh: 58000000, avgUsed: 13500000, avgTokunbo: 46500000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2020, tokunboLow: 48000000, tokunboHigh: 72000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'GLC300', year: 2022, tokunboLow: 70000000, tokunboHigh: 105000000, avgTokunbo: 87500000 },
  { make: 'Mercedes-Benz', model: 'GLC43 AMG', year: 2018, tokunboLow: 45000000, tokunboHigh: 75000000, avgTokunbo: 60000000 },
  { make: 'Mercedes-Benz', model: 'GLC43 AMG', year: 2022, tokunboLow: 100000000, tokunboHigh: 145000000, avgTokunbo: 122500000 },

  // GLE / ML-Class (2006-2025)
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2006, poor: 1800000, poorHigh: 2500000, avgPoor: 2150000, fair: 2500000, fairHigh: 3200000, avgFair: 2850000, good: 3200000, goodHigh: 4000000, avgGood: 3600000 },
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2008, poor: 2500000, poorHigh: 3500000, avgPoor: 3000000, fair: 3500000, fairHigh: 4500000, avgFair: 4000000, good: 4500000, goodHigh: 5500000, avgGood: 5000000 },
  { make: 'Mercedes-Benz', model: 'ML350 W164', year: 2010, poor: 4000000, poorHigh: 5000000, avgPoor: 4500000, fair: 5000000, fairHigh: 6500000, avgFair: 5750000, good: 6500000, goodHigh: 8000000, avgGood: 7250000 },
  { make: 'Mercedes-Benz', model: 'ML350 W166', year: 2012, poor: 6000000, poorHigh: 7500000, avgPoor: 6750000, fair: 7500000, fairHigh: 9500000, avgFair: 8500000, good: 9500000, goodHigh: 12000000, avgGood: 10750000 },
  { make: 'Mercedes-Benz', model: 'ML350 W166', year: 2014, poor: 12000000, poorHigh: 14000000, avgPoor: 13000000, fair: 14000000, fairHigh: 17000000, avgFair: 15500000, good: 17000000, goodHigh: 20000000, avgGood: 18500000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W166', year: 2016, poor: 18000000, poorHigh: 21000000, avgPoor: 19500000, fair: 21000000, fairHigh: 26000000, avgFair: 23500000, good: 26000000, goodHigh: 30000000, avgGood: 28000000, excellentLow: 30000000, excellentHigh: 34000000, avgExcellent: 32000000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W166', year: 2018, poor: 28000000, poorHigh: 33000000, avgPoor: 30500000, fair: 33000000, fairHigh: 40000000, avgFair: 36500000, good: 40000000, goodHigh: 47000000, avgGood: 43500000, excellentLow: 47000000, excellentHigh: 54000000, avgExcellent: 50500000 },
  { make: 'Mercedes-Benz', model: 'GLE350 W167', year: 2020, fair: 65000000, fairHigh: 75000000, avgFair: 70000000, good: 75000000, goodHigh: 90000000, avgGood: 82500000, excellentLow: 90000000, excellentHigh: 110000000, avgExcellent: 100000000 },
  { make: 'Mercedes-Benz', model: 'GLE450 W167', year: 2019, fair: 73000000, fairHigh: 90000000, avgFair: 81500000, good: 90000000, goodHigh: 115000000, avgGood: 102500000, excellentLow: 115000000, excellentHigh: 145000000, avgExcellent: 130000000 },
  { make: 'Mercedes-Benz', model: 'GLE450 W167', year: 2022, good: 120000000, goodHigh: 145000000, avgGood: 132500000, excellentLow: 145000000, excellentHigh: 185000000, avgExcellent: 165000000 },
  { make: 'Mercedes-Benz', model: 'GLE53 AMG', year: 2021, good: 120000000, goodHigh: 150000000, avgGood: 135000000, excellentLow: 150000000, excellentHigh: 195000000, avgExcellent: 172500000 },

  // G-Class / G-Wagon (2003-2025)
  { make: 'Mercedes-Benz', model: 'G500', year: 2003, nigUsedLow: 3000000, nigUsedHigh: 7000000, tokunboLow: 6000000, tokunboHigh: 15000000, avgUsed: 5000000, avgTokunbo: 10500000 },
  { make: 'Mercedes-Benz', model: 'G500', year: 2008, nigUsedLow: 5000000, nigUsedHigh: 12000000, tokunboLow: 12000000, tokunboHigh: 25000000, avgUsed: 8500000, avgTokunbo: 18500000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W463', year: 2013, tokunboLow: 50000000, tokunboHigh: 90000000, avgTokunbo: 70000000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W463', year: 2017, tokunboLow: 100000000, tokunboHigh: 165000000, avgTokunbo: 132500000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W464', year: 2019, tokunboLow: 150000000, tokunboHigh: 230000000, avgTokunbo: 190000000 },
  { make: 'Mercedes-Benz', model: 'G63 AMG W464', year: 2022, tokunboLow: 220000000, tokunboHigh: 340000000, avgTokunbo: 280000000 },
  { make: 'Mercedes-Benz', model: 'G550', year: 2020, tokunboLow: 120000000, tokunboHigh: 200000000, avgTokunbo: 160000000 },
  { make: 'Mercedes-Benz', model: 'G580 EQ', year: 2024, tokunboLow: 180000000, tokunboHigh: 280000000, avgTokunbo: 230000000 },

  // GLS-Class / GL-Class (2008-2025)
  { make: 'Mercedes-Benz', model: 'GL450 W164', year: 2008, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3000000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5000000 },
  { make: 'Mercedes-Benz', model: 'GL450 W166', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 6000000, tokunboLow: 6000000, tokunboHigh: 12000000, avgUsed: 4300000, avgTokunbo: 9000000 },
  { make: 'Mercedes-Benz', model: 'GLS450 W167', year: 2020, tokunboLow: 80000000, tokunboHigh: 140000000, avgTokunbo: 110000000 },
  { make: 'Mercedes-Benz', model: 'GLS580 W167', year: 2021, tokunboLow: 130000000, tokunboHigh: 200000000, avgTokunbo: 165000000 },
  { make: 'Mercedes-Benz', model: 'Maybach GLS', year: 2022, tokunboLow: 250000000, tokunboHigh: 400000000, avgTokunbo: 325000000 },

  // S-Class (2002-2022)
  { make: 'Mercedes-Benz', model: 'S-Class W220', year: 2002, nigUsedLow: 600000, nigUsedHigh: 1300000, tokunboLow: 1000000, tokunboHigh: 2500000, avgUsed: 950000, avgTokunbo: 1800000 },
  { make: 'Mercedes-Benz', model: 'S-Class W221', year: 2007, nigUsedLow: 1200000, nigUsedHigh: 3000000, tokunboLow: 2500000, tokunboHigh: 6000000, avgUsed: 2100000, avgTokunbo: 4300000 },
  { make: 'Mercedes-Benz', model: 'S-Class W221', year: 2010, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W222', year: 2014, nigUsedLow: 4000000, nigUsedHigh: 9000000, tokunboLow: 12000000, tokunboHigh: 25000000, avgUsed: 6500000, avgTokunbo: 18500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W222', year: 2017, nigUsedLow: 7000000, nigUsedHigh: 16000000, tokunboLow: 25000000, tokunboHigh: 50000000, avgUsed: 11500000, avgTokunbo: 37500000 },
  { make: 'Mercedes-Benz', model: 'S-Class W223', year: 2021, tokunboLow: 90000000, tokunboHigh: 160000000, avgTokunbo: 125000000 },
  { make: 'Mercedes-Benz', model: 'S680 Maybach', year: 2022, tokunboLow: 200000000, tokunboHigh: 400000000, avgTokunbo: 300000000 },

  // A-Class / CLA / GLA (2013-2024)
  { make: 'Mercedes-Benz', model: 'A-Class W176', year: 2013, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4500000, avgUsed: 1800000, avgTokunbo: 3300000 },
  { make: 'Mercedes-Benz', model: 'A-Class W177', year: 2019, tokunboLow: 18000000, tokunboHigh: 35000000, avgTokunbo: 26500000 },
  { make: 'Mercedes-Benz', model: 'CLA250', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3500000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'CLA250', year: 2020, tokunboLow: 25000000, tokunboHigh: 45000000, avgTokunbo: 35000000 },
  { make: 'Mercedes-Benz', model: 'GLA250', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 5000000, tokunboHigh: 10000000, avgUsed: 3300000, avgTokunbo: 7500000 },
  { make: 'Mercedes-Benz', model: 'GLA250', year: 2021, tokunboLow: 28000000, tokunboHigh: 50000000, avgTokunbo: 39000000 },

  // Sporty / Open-Top (2006-2016)
  { make: 'Mercedes-Benz', model: 'CLK350', year: 2006, nigUsedLow: 1000000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 5000000, avgUsed: 1800000, avgTokunbo: 3500000 },
  { make: 'Mercedes-Benz', model: 'SLK250', year: 2012, nigUsedLow: 1500000, nigUsedHigh: 3500000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2500000, avgTokunbo: 5300000 },
  { make: 'Mercedes-Benz', model: 'AMG GT', year: 2016, tokunboLow: 65000000, tokunboHigh: 120000000, avgTokunbo: 92500000 },
];

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Transform raw data to database records
 * 
 * Handles multiple condition categories per row:
 * - poor: Poor condition (high mileage, needs work)
 * - fair: Fair condition (higher mileage, some wear)
 * - good: Good condition (normal wear)
 * - excellent: Excellent condition (low mileage, pristine)
 * 
 * Each row in rawData may produce multiple database records (one per condition category).
 */
function transformToDbRecords(rawData: any[]): ValuationRecord[] {
  const records: ValuationRecord[] = [];
  
  for (const item of rawData) {
    // Validate that basic fields exist
    if (!item.make || !item.model || !item.year) {
      console.warn('⚠️  Skipping invalid record (missing make, model, or year):', item);
      continue;
    }

    // Poor condition (if data present)
    if (item.poor !== undefined || (item.poor === undefined && item.poorHigh !== undefined && item.avgPoor !== undefined)) {
      const lowPrice = item.poor || item.poorLow || item.avgPoor;
      const highPrice = item.poorHigh || item.poor || item.avgPoor;
      const avgPrice = item.avgPoor || item.poor;
      
      if (lowPrice && highPrice && avgPrice) {
        records.push({
          make: item.make,
          model: item.model,
          year: item.year,
          conditionCategory: 'poor',
          lowPrice: lowPrice,
          highPrice: highPrice,
          averagePrice: avgPrice,
          dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        });
      }
    }

    // Fair condition (if data present)
    if (item.fair !== undefined || (item.fair === undefined && item.fairHigh !== undefined && item.avgFair !== undefined)) {
      const lowPrice = item.fair || item.fairLow || item.avgFair;
      const highPrice = item.fairHigh || item.fair || item.avgFair;
      const avgPrice = item.avgFair || item.fair;
      
      if (lowPrice && highPrice && avgPrice) {
        records.push({
          make: item.make,
          model: item.model,
          year: item.year,
          conditionCategory: 'fair',
          lowPrice: lowPrice,
          highPrice: highPrice,
          averagePrice: avgPrice,
          dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        });
      }
    }

    // Good condition (if data present)
    if (item.good !== undefined || (item.good === undefined && item.goodHigh !== undefined && item.avgGood !== undefined)) {
      const lowPrice = item.good || item.goodLow || item.avgGood;
      const highPrice = item.goodHigh || item.good || item.avgGood;
      const avgPrice = item.avgGood || item.good;
      
      if (lowPrice && highPrice && avgPrice) {
        records.push({
          make: item.make,
          model: item.model,
          year: item.year,
          conditionCategory: 'good',
          lowPrice: lowPrice,
          highPrice: highPrice,
          averagePrice: avgPrice,
          dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        });
      }
    }

    // Excellent condition (if data present)
    if (
      item.excellentLow !== undefined &&
      item.excellentHigh !== undefined &&
      item.avgExcellent !== undefined
    ) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'excellent',
        lowPrice: item.excellentLow,
        highPrice: item.excellentHigh,
        averagePrice: item.avgExcellent,
        dataSource: 'Mercedes-Benz in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
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
  console.log(`📊 Total raw records: ${mercedesRawData.length}\n`);
  
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
    const records = transformToDbRecords(mercedesRawData);
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
