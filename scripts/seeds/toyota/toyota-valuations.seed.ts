/**
 * Toyota Vehicle Valuation Seed Script
 * 
 * Source: Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)
 * 
 * Consolidates data from multiple Toyota import scripts:
 * - scripts/import-toyota-data-complete.ts (Camry, Corolla)
 * - scripts/import-remaining-toyota-direct.ts (Highlander, RAV4, Sienna, Land Cruiser, Prado, Venza, Avalon)
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/toyota/toyota-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/toyota/toyota-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force
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
const SCRIPT_NAME = 'toyota-valuations';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

/**
 * Toyota vehicle valuation data from official Toyota Nigeria 
 * Comprehensive Price & Valuation Guide (March 2026)
 * 
 * Covers multiple models: Camry, Corolla, Highlander, RAV4, Sienna, 
 * Land Cruiser, Prado, Venza, Avalon
 * 
 * Transform the data into separate records for each condition category
 */
const toyotaRawData = [
  // ========== TOYOTA CAMRY (40 entries) ==========
  // 2000-2025 coverage with all condition categories
  { make: 'Toyota', model: 'Camry', year: 2000, nigUsedLow: 800000, nigUsedHigh: 1500000, avgUsed: 1100000, tokunboLow: 1200000, tokunboHigh: 2200000, avgTokunbo: 1700000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Camry', year: 2002, nigUsedLow: 1000000, nigUsedHigh: 1800000, avgUsed: 1400000, tokunboLow: 1500000, tokunboHigh: 2800000, avgTokunbo: 2100000, mileageLow: 140000, mileageHigh: 220000 },
  { make: 'Toyota', model: 'Camry', year: 2004, nigUsedLow: 1200000, nigUsedHigh: 2200000, avgUsed: 1700000, tokunboLow: 1800000, tokunboHigh: 3200000, avgTokunbo: 2500000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Camry', year: 2006, nigUsedLow: 1500000, nigUsedHigh: 3000000, avgUsed: 2300000, tokunboLow: 2500000, tokunboHigh: 4500000, avgTokunbo: 3500000, mileageLow: 100000, mileageHigh: 180000 },
  { make: 'Toyota', model: 'Camry', year: 2007, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000, tokunboLow: 3000000, tokunboHigh: 5500000, avgTokunbo: 4300000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Camry', year: 2008, nigUsedLow: 2500000, nigUsedHigh: 4500000, avgUsed: 3500000, tokunboLow: 3500000, tokunboHigh: 6500000, avgTokunbo: 5000000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'Camry', year: 2009, nigUsedLow: 2800000, nigUsedHigh: 5000000, avgUsed: 3900000, tokunboLow: 4000000, tokunboHigh: 7000000, avgTokunbo: 5500000, mileageLow: 80000, mileageHigh: 150000 },
  { make: 'Toyota', model: 'Camry', year: 2010, nigUsedLow: 3000000, nigUsedHigh: 5500000, avgUsed: 4300000, tokunboLow: 4500000, tokunboHigh: 8000000, avgTokunbo: 6300000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Camry', year: 2011, nigUsedLow: 3500000, nigUsedHigh: 6000000, avgUsed: 4800000, tokunboLow: 5500000, tokunboHigh: 9000000, avgTokunbo: 7300000, mileageLow: 70000, mileageHigh: 130000 },
  { make: 'Toyota', model: 'Camry', year: 2012, nigUsedLow: 4000000, nigUsedHigh: 7000000, avgUsed: 5500000, tokunboLow: 6500000, tokunboHigh: 11000000, avgTokunbo: 8800000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Camry', year: 2013, nigUsedLow: 5000000, nigUsedHigh: 8500000, avgUsed: 6800000, tokunboLow: 8000000, tokunboHigh: 13000000, avgTokunbo: 10500000, mileageLow: 55000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'Camry', year: 2014, nigUsedLow: 6000000, nigUsedHigh: 10000000, avgUsed: 8000000, tokunboLow: 10000000, tokunboHigh: 16000000, avgTokunbo: 13000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Camry', year: 2015, nigUsedLow: 7000000, nigUsedHigh: 12000000, avgUsed: 9500000, tokunboLow: 12000000, tokunboHigh: 20000000, avgTokunbo: 16000000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Camry', year: 2016, nigUsedLow: 8000000, nigUsedHigh: 14000000, avgUsed: 11000000, tokunboLow: 14000000, tokunboHigh: 22000000, avgTokunbo: 18000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Camry', year: 2017, nigUsedLow: 9000000, nigUsedHigh: 15000000, avgUsed: 12000000, tokunboLow: 16000000, tokunboHigh: 25000000, avgTokunbo: 20500000, mileageLow: 30000, mileageHigh: 65000 },
  { make: 'Toyota', model: 'Camry', year: 2018, nigUsedLow: 11000000, nigUsedHigh: 18000000, avgUsed: 14500000, tokunboLow: 18000000, tokunboHigh: 28000000, avgTokunbo: 23000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Camry', year: 2019, fair: 13000000, good: 20000000, excellentLow: 22000000, excellentHigh: 32000000, avgExcellent: 27000000, mileageLow: 20000, mileageHigh: 50000 },
  { make: 'Toyota', model: 'Camry', year: 2020, fair: 15000000, good: 23000000, excellentLow: 26000000, excellentHigh: 38000000, avgExcellent: 32000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Camry', year: 2021, fair: 18000000, good: 26000000, excellentLow: 32000000, excellentHigh: 48000000, avgExcellent: 40000000, mileageLow: 10000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Camry', year: 2022, excellentLow: 40000000, excellentHigh: 58000000, avgExcellent: 49000000, mileageLow: 5000, mileageHigh: 20000 },
  { make: 'Toyota', model: 'Camry', year: 2024, excellentLow: 55000000, excellentHigh: 75000000, avgExcellent: 65000000, mileageLow: 0, mileageHigh: 10000 },
  { make: 'Toyota', model: 'Camry', year: 2025, excellentLow: 60000000, excellentHigh: 80000000, avgExcellent: 70000000, mileageLow: 0, mileageHigh: 5000 },

  // ========== TOYOTA COROLLA (16 entries) ==========
  { make: 'Toyota', model: 'Corolla', year: 2000, nigUsedLow: 600000, nigUsedHigh: 1000000, avgUsed: 800000, tokunboLow: 800000, tokunboHigh: 1500000, avgTokunbo: 1100000, mileageLow: 160000, mileageHigh: 260000 },
  { make: 'Toyota', model: 'Corolla', year: 2003, nigUsedLow: 700000, nigUsedHigh: 1300000, avgUsed: 1000000, tokunboLow: 1000000, tokunboHigh: 1800000, avgTokunbo: 1400000, mileageLow: 140000, mileageHigh: 230000 },
  { make: 'Toyota', model: 'Corolla', year: 2005, nigUsedLow: 800000, nigUsedHigh: 1500000, avgUsed: 1100000, tokunboLow: 1100000, tokunboHigh: 2000000, avgTokunbo: 1600000, mileageLow: 120000, mileageHigh: 210000 },
  { make: 'Toyota', model: 'Corolla', year: 2006, nigUsedLow: 900000, nigUsedHigh: 1700000, avgUsed: 1300000, tokunboLow: 1300000, tokunboHigh: 2300000, avgTokunbo: 1800000, mileageLow: 110000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Corolla', year: 2008, nigUsedLow: 1100000, nigUsedHigh: 2000000, avgUsed: 1600000, tokunboLow: 1600000, tokunboHigh: 3000000, avgTokunbo: 2300000, mileageLow: 95000, mileageHigh: 175000 },
  { make: 'Toyota', model: 'Corolla', year: 2010, nigUsedLow: 1400000, nigUsedHigh: 2500000, avgUsed: 1900000, tokunboLow: 2000000, tokunboHigh: 3800000, avgTokunbo: 2900000, mileageLow: 80000, mileageHigh: 155000 },
  { make: 'Toyota', model: 'Corolla', year: 2013, nigUsedLow: 2000000, nigUsedHigh: 3800000, avgUsed: 2900000, tokunboLow: 3000000, tokunboHigh: 5500000, avgTokunbo: 4300000, mileageLow: 60000, mileageHigh: 120000 },
  { make: 'Toyota', model: 'Corolla', year: 2015, nigUsedLow: 3000000, nigUsedHigh: 5500000, avgUsed: 4300000, tokunboLow: 5000000, tokunboHigh: 8500000, avgTokunbo: 6800000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Corolla', year: 2017, nigUsedLow: 4000000, nigUsedHigh: 7000000, avgUsed: 5500000, tokunboLow: 7000000, tokunboHigh: 12000000, avgTokunbo: 9500000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Corolla', year: 2019, excellentLow: 12000000, excellentHigh: 20000000, avgExcellent: 16000000, mileageLow: 20000, mileageHigh: 50000 },
  { make: 'Toyota', model: 'Corolla', year: 2021, excellentLow: 18000000, excellentHigh: 28000000, avgExcellent: 23000000, mileageLow: 10000, mileageHigh: 35000 },
  { make: 'Toyota', model: 'Corolla', year: 2023, excellentLow: 25000000, excellentHigh: 38000000, avgExcellent: 31500000, mileageLow: 5000, mileageHigh: 15000 },
  { make: 'Toyota', model: 'Corolla', year: 2025, excellentLow: 30000000, excellentHigh: 45000000, avgExcellent: 37500000, mileageLow: 0, mileageHigh: 8000 },

  // ========== TOYOTA HIGHLANDER (18 entries) ==========
  { make: 'Toyota', model: 'Highlander', year: 2004, fair: 2000000, fairHigh: 3500000, avgFair: 2750000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Highlander', year: 2007, fair: 3000000, fairHigh: 5500000, avgFair: 4250000, good: 5500000, goodHigh: 8000000, avgGood: 6750000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Highlander', year: 2010, fair: 5000000, fairHigh: 9000000, avgFair: 7000000, good: 9000000, goodHigh: 13000000, avgGood: 11000000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Highlander', year: 2012, fair: 7000000, fairHigh: 12000000, avgFair: 9500000, good: 12000000, goodHigh: 17000000, avgGood: 14500000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Highlander', year: 2014, fair: 10000000, fairHigh: 16000000, avgFair: 13000000, good: 16000000, goodHigh: 22000000, avgGood: 19000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Highlander', year: 2016, fair: 14000000, fairHigh: 22000000, avgFair: 18000000, good: 22000000, goodHigh: 30000000, avgGood: 26000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Highlander', year: 2018, fair: 18000000, fairHigh: 28000000, avgFair: 23000000, good: 28000000, goodHigh: 38000000, avgGood: 33000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Highlander', year: 2020, fair: 25000000, fairHigh: 38000000, avgFair: 31500000, good: 38000000, goodHigh: 52000000, avgGood: 45000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Highlander', year: 2022, fair: 35000000, fairHigh: 50000000, avgFair: 42500000, good: 50000000, goodHigh: 68000000, avgGood: 59000000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Highlander', year: 2024, good: 60000000, goodHigh: 75000000, avgGood: 67500000, excellentLow: 75000000, excellentHigh: 95000000, avgExcellent: 85000000, mileageLow: 0, mileageHigh: 20000 },

  // ========== TOYOTA RAV4 (10 entries) ==========
  { make: 'Toyota', model: 'RAV4', year: 2000, fair: 800000, fairHigh: 1500000, avgFair: 1150000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'RAV4', year: 2004, fair: 1200000, fairHigh: 2200000, avgFair: 1700000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'RAV4', year: 2008, fair: 2000000, fairHigh: 3800000, avgFair: 2900000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'RAV4', year: 2010, fair: 3000000, fairHigh: 5500000, avgFair: 4250000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'RAV4', year: 2013, fair: 5000000, fairHigh: 9000000, avgFair: 7000000, mileageLow: 55000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'RAV4', year: 2016, fair: 9000000, fairHigh: 15000000, avgFair: 12000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'RAV4', year: 2019, fair: 15000000, fairHigh: 23000000, avgFair: 19000000, mileageLow: 20000, mileageHigh: 45000 },
  { make: 'Toyota', model: 'RAV4', year: 2021, fair: 20000000, fairHigh: 30000000, avgFair: 25000000, mileageLow: 10000, mileageHigh: 35000 },
  { make: 'Toyota', model: 'RAV4', year: 2023, good: 38000000, goodHigh: 48000000, avgGood: 43000000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'RAV4', year: 2025, excellentLow: 55000000, excellentHigh: 70000000, avgExcellent: 62500000, mileageLow: 0, mileageHigh: 15000 },

  // ========== TOYOTA SIENNA (11 entries) ==========
  { make: 'Toyota', model: 'Sienna', year: 2000, fair: 900000, fairHigh: 1700000, avgFair: 1300000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Sienna', year: 2004, fair: 1500000, fairHigh: 2800000, avgFair: 2150000, mileageLow: 120000, mileageHigh: 200000 },
  { make: 'Toyota', model: 'Sienna', year: 2007, fair: 2500000, fairHigh: 4500000, avgFair: 3500000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Sienna', year: 2010, fair: 4000000, fairHigh: 7000000, avgFair: 5500000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Sienna', year: 2012, fair: 5500000, fairHigh: 9500000, avgFair: 7500000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Sienna', year: 2015, fair: 9000000, fairHigh: 15000000, avgFair: 12000000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Sienna', year: 2018, fair: 14000000, fairHigh: 22000000, avgFair: 18000000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Sienna', year: 2020, fair: 18000000, fairHigh: 28000000, avgFair: 23000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Sienna', year: 2022, fair: 25000000, fairHigh: 38000000, avgFair: 31500000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Sienna', year: 2024, good: 45000000, goodHigh: 55000000, avgGood: 50000000, mileageLow: 0, mileageHigh: 20000 },
  { make: 'Toyota', model: 'Sienna', year: 2025, excellentLow: 60000000, excellentHigh: 75000000, avgExcellent: 67500000, mileageLow: 0, mileageHigh: 15000 },

  // ========== TOYOTA LAND CRUISER (9 entries) ==========
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, fair: 2000000, fairHigh: 3500000, avgFair: 2750000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, fair: 4000000, fairHigh: 7000000, avgFair: 5500000, mileageLow: 110000, mileageHigh: 190000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, fair: 6000000, fairHigh: 11000000, avgFair: 8500000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2012, fair: 12000000, fairHigh: 20000000, avgFair: 16000000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, fair: 18000000, fairHigh: 30000000, avgFair: 24000000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2018, fair: 28000000, fairHigh: 45000000, avgFair: 36500000, mileageLow: 25000, mileageHigh: 55000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, fair: 40000000, fairHigh: 60000000, avgFair: 50000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, fair: 55000000, fairHigh: 80000000, avgFair: 67500000, mileageLow: 5000, mileageHigh: 30000 },
  { make: 'Toyota', model: 'Land Cruiser', year: 2025, excellentLow: 120000000, excellentHigh: 160000000, avgExcellent: 140000000, mileageLow: 0, mileageHigh: 15000 },

  // ========== TOYOTA PRADO (8 entries) ==========
  { make: 'Toyota', model: 'Prado', year: 2003, fair: 2000000, fairHigh: 3500000, avgFair: 2750000, mileageLow: 130000, mileageHigh: 210000 },
  { make: 'Toyota', model: 'Prado', year: 2007, fair: 4000000, fairHigh: 7000000, avgFair: 5500000, mileageLow: 90000, mileageHigh: 165000 },
  { make: 'Toyota', model: 'Prado', year: 2010, fair: 7000000, fairHigh: 12000000, avgFair: 9500000, mileageLow: 75000, mileageHigh: 140000 },
  { make: 'Toyota', model: 'Prado', year: 2014, fair: 14000000, fairHigh: 22000000, avgFair: 18000000, mileageLow: 45000, mileageHigh: 90000 },
  { make: 'Toyota', model: 'Prado', year: 2017, fair: 20000000, fairHigh: 32000000, avgFair: 26000000, mileageLow: 30000, mileageHigh: 65000 },
  { make: 'Toyota', model: 'Prado', year: 2020, fair: 30000000, fairHigh: 45000000, avgFair: 37500000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Prado', year: 2023, good: 55000000, goodHigh: 70000000, avgGood: 62500000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'Prado', year: 2025, excellentLow: 85000000, excellentHigh: 110000000, avgExcellent: 97500000, mileageLow: 0, mileageHigh: 15000 },

  // ========== TOYOTA VENZA (6 entries) ==========
  { make: 'Toyota', model: 'Venza', year: 2009, fair: 2500000, fairHigh: 4500000, avgFair: 3500000, mileageLow: 80000, mileageHigh: 150000 },
  { make: 'Toyota', model: 'Venza', year: 2012, fair: 4500000, fairHigh: 8000000, avgFair: 6250000, mileageLow: 60000, mileageHigh: 115000 },
  { make: 'Toyota', model: 'Venza', year: 2015, fair: 7000000, fairHigh: 12000000, avgFair: 9500000, mileageLow: 40000, mileageHigh: 80000 },
  { make: 'Toyota', model: 'Venza', year: 2020, fair: 15000000, fairHigh: 23000000, avgFair: 19000000, mileageLow: 15000, mileageHigh: 40000 },
  { make: 'Toyota', model: 'Venza', year: 2023, good: 30000000, goodHigh: 40000000, avgGood: 35000000, mileageLow: 0, mileageHigh: 25000 },
  { make: 'Toyota', model: 'Venza', year: 2025, excellentLow: 50000000, excellentHigh: 65000000, avgExcellent: 57500000, mileageLow: 0, mileageHigh: 15000 },

  // ========== TOYOTA AVALON (8 entries) ==========
  { make: 'Toyota', model: 'Avalon', year: 2000, fair: 900000, fairHigh: 1700000, avgFair: 1300000, mileageLow: 150000, mileageHigh: 240000 },
  { make: 'Toyota', model: 'Avalon', year: 2005, fair: 1800000, fairHigh: 3200000, avgFair: 2500000, mileageLow: 110000, mileageHigh: 190000 },
  { make: 'Toyota', model: 'Avalon', year: 2008, fair: 2500000, fairHigh: 4500000, avgFair: 3500000, mileageLow: 85000, mileageHigh: 160000 },
  { make: 'Toyota', model: 'Avalon', year: 2013, fair: 5000000, fairHigh: 9000000, avgFair: 7000000, mileageLow: 55000, mileageHigh: 100000 },
  { make: 'Toyota', model: 'Avalon', year: 2016, fair: 8000000, fairHigh: 14000000, avgFair: 11000000, mileageLow: 35000, mileageHigh: 70000 },
  { make: 'Toyota', model: 'Avalon', year: 2019, fair: 13000000, fairHigh: 20000000, avgFair: 16500000, mileageLow: 20000, mileageHigh: 45000 },
  { make: 'Toyota', model: 'Avalon', year: 2021, fair: 18000000, fairHigh: 28000000, avgFair: 23000000, mileageLow: 10000, mileageHigh: 35000 },
  { make: 'Toyota', model: 'Avalon', year: 2022, good: 32000000, goodHigh: 42000000, avgGood: 37000000, mileageLow: 5000, mileageHigh: 30000 },
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
 * - fair, good, excellent: Condition-based categories
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

    // Nigerian Used -> Fair condition (if data present)
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
        dataSource: 'Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        mileageLow: item.mileageLow,
        mileageHigh: item.mileageHigh,
      });
    }

    // Tokunbo (Foreign Used) -> Good condition (if data present)
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
        dataSource: 'Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        mileageLow: item.mileageLow,
        mileageHigh: item.mileageHigh,
      });
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
          dataSource: 'Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)',
          mileageLow: item.mileageLow,
          mileageHigh: item.mileageHigh,
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
          dataSource: 'Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)',
          mileageLow: item.mileageLow,
          mileageHigh: item.mileageHigh,
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
        dataSource: 'Toyota Nigeria Comprehensive Price & Valuation Guide (March 2026)',
        mileageLow: item.mileageLow,
        mileageHigh: item.mileageHigh,
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
  console.log(`📊 Total raw records: ${toyotaRawData.length}\n`);
  
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
    const records = transformToDbRecords(toyotaRawData);
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
