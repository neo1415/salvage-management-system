/**
 * Nissan Vehicle Valuation Seed Script
 * 
 * Source: Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)
 * 
 * Usage:
 * - Test: tsx scripts/seeds/nissan/nissan-valuations.seed.ts --dry-run
 * - Run: tsx scripts/seeds/nissan/nissan-valuations.seed.ts
 * - Force re-run: tsx scripts/seeds/nissan/nissan-valuations.seed.ts --force
 * 
 * Requirements: 6.1, 6.3, 6.6
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
const SCRIPT_NAME = 'nissan-valuations';
const BATCH_SIZE = 50;

// ============================================================================
// RAW DATA
// ============================================================================

// Nissan vehicle valuation data from official Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)
// Transform the data into separate records for each condition category
const rawData = [
  // Altima (2002-2024)
  { make: 'Nissan', model: 'Altima', year: 2002, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1600000, avgUsed: 750000, avgTokunbo: 1200000 },
  { make: 'Nissan', model: 'Altima', year: 2004, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'Altima', year: 2006, nigUsedLow: 800000, nigUsedHigh: 1600000, tokunboLow: 1300000, tokunboHigh: 2600000, avgUsed: 1200000, avgTokunbo: 1900000 },
  { make: 'Nissan', model: 'Altima', year: 2008, nigUsedLow: 1100000, nigUsedHigh: 2200000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1600000, avgTokunbo: 2600000 },
  { make: 'Nissan', model: 'Altima', year: 2010, nigUsedLow: 1400000, nigUsedHigh: 2800000, tokunboLow: 2300000, tokunboHigh: 4500000, avgUsed: 2100000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Altima', year: 2012, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2700000, avgTokunbo: 4500000 },
  { make: 'Nissan', model: 'Altima', year: 2013, nigUsedLow: 2200000, nigUsedHigh: 4500000, tokunboLow: 4000000, tokunboHigh: 7500000, avgUsed: 3400000, avgTokunbo: 5800000 },
  { make: 'Nissan', model: 'Altima', year: 2015, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 7000000, tokunboHigh: 13000000, avgUsed: 4500000, avgTokunbo: 10000000 },
  { make: 'Nissan', model: 'Altima', year: 2016, nigUsedLow: 4000000, nigUsedHigh: 7500000, tokunboLow: 9000000, tokunboHigh: 15000000, avgUsed: 5800000, avgTokunbo: 12000000 },
  { make: 'Nissan', model: 'Altima', year: 2018, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 12000000, tokunboHigh: 20000000, avgUsed: 7000000, avgTokunbo: 16000000 },
  { make: 'Nissan', model: 'Altima', year: 2019, tokunboLow: 17000000, tokunboHigh: 28000000, avgTokunbo: 22500000 },
  { make: 'Nissan', model: 'Altima', year: 2021, tokunboLow: 24000000, tokunboHigh: 38000000, avgTokunbo: 31000000 },
  { make: 'Nissan', model: 'Altima', year: 2024, tokunboLow: 35000000, tokunboHigh: 52000000, avgTokunbo: 43500000 },

  // Sentra (2003-2021)
  { make: 'Nissan', model: 'Sentra', year: 2003, nigUsedLow: 400000, nigUsedHigh: 800000, tokunboLow: 600000, tokunboHigh: 1300000, avgUsed: 600000, avgTokunbo: 950000 },
  { make: 'Nissan', model: 'Sentra', year: 2007, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Nissan', model: 'Sentra', year: 2010, nigUsedLow: 800000, nigUsedHigh: 1600000, tokunboLow: 1200000, tokunboHigh: 2500000, avgUsed: 1200000, avgTokunbo: 1900000 },
  { make: 'Nissan', model: 'Sentra', year: 2013, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Nissan', model: 'Sentra', year: 2014, nigUsedLow: 1600000, nigUsedHigh: 3200000, tokunboLow: 3000000, tokunboHigh: 5500000, avgUsed: 2400000, avgTokunbo: 4300000 },
  { make: 'Nissan', model: 'Sentra', year: 2016, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 4500000, tokunboHigh: 8000000, avgUsed: 3000000, avgTokunbo: 6300000 },
  { make: 'Nissan', model: 'Sentra', year: 2019, tokunboLow: 10000000, tokunboHigh: 17000000, avgTokunbo: 13500000 },
  { make: 'Nissan', model: 'Sentra', year: 2021, tokunboLow: 16000000, tokunboHigh: 26000000, avgTokunbo: 21000000 },

  // Pathfinder (2001-2024)
  { make: 'Nissan', model: 'Pathfinder', year: 2001, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2003, nigUsedLow: 700000, nigUsedHigh: 1500000, tokunboLow: 1400000, tokunboHigh: 2800000, avgUsed: 1100000, avgTokunbo: 2100000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2005, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1700000, tokunboHigh: 3500000, avgUsed: 1400000, avgTokunbo: 2600000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2007, nigUsedLow: 1100000, nigUsedHigh: 2200000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1600000, avgTokunbo: 3000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2008, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2800000, tokunboHigh: 6000000, avgUsed: 2300000, avgTokunbo: 4400000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2013, nigUsedLow: 2000000, nigUsedHigh: 4500000, tokunboLow: 4000000, tokunboHigh: 8000000, avgUsed: 3300000, avgTokunbo: 6000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 5500000, tokunboLow: 6000000, tokunboHigh: 10000000, avgUsed: 4000000, avgTokunbo: 8000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 7000000, tokunboLow: 9000000, tokunboHigh: 15000000, avgUsed: 5300000, avgTokunbo: 12000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2018, nigUsedLow: 5000000, nigUsedHigh: 10000000, tokunboLow: 14000000, tokunboHigh: 22000000, avgUsed: 7500000, avgTokunbo: 18000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2022, tokunboLow: 30000000, tokunboHigh: 48000000, avgTokunbo: 39000000 },
  { make: 'Nissan', model: 'Pathfinder', year: 2024, tokunboLow: 40000000, tokunboHigh: 58000000, avgTokunbo: 49000000 },

  // Xterra (2002-2015)
  { make: 'Nissan', model: 'Xterra', year: 2002, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1600000, avgUsed: 750000, avgTokunbo: 1200000 },
  { make: 'Nissan', model: 'Xterra', year: 2005, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Nissan', model: 'Xterra', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Nissan', model: 'Xterra', year: 2010, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Nissan', model: 'Xterra', year: 2013, nigUsedLow: 1600000, nigUsedHigh: 3200000, tokunboLow: 2800000, tokunboHigh: 5500000, avgUsed: 2400000, avgTokunbo: 4100000 },
  { make: 'Nissan', model: 'Xterra', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },

  // Murano (2003-2021)
  { make: 'Nissan', model: 'Murano', year: 2003, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'Murano', year: 2005, nigUsedLow: 800000, nigUsedHigh: 1600000, tokunboLow: 1300000, tokunboHigh: 2600000, avgUsed: 1200000, avgTokunbo: 1900000 },
  { make: 'Nissan', model: 'Murano', year: 2007, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1700000, tokunboHigh: 3400000, avgUsed: 1500000, avgTokunbo: 2500000 },
  { make: 'Nissan', model: 'Murano', year: 2009, nigUsedLow: 1300000, nigUsedHigh: 2600000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Murano', year: 2011, nigUsedLow: 1700000, nigUsedHigh: 3400000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2500000, avgTokunbo: 4500000 },
  { make: 'Nissan', model: 'Murano', year: 2013, nigUsedLow: 2200000, nigUsedHigh: 4500000, tokunboLow: 4000000, tokunboHigh: 8000000, avgUsed: 3400000, avgTokunbo: 6000000 },
  { make: 'Nissan', model: 'Murano', year: 2015, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 6000000, tokunboHigh: 11000000, avgUsed: 4500000, avgTokunbo: 8500000 },
  { make: 'Nissan', model: 'Murano', year: 2018, nigUsedLow: 4500000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 6800000, avgTokunbo: 14000000 },
  { make: 'Nissan', model: 'Murano', year: 2021, tokunboLow: 20000000, tokunboHigh: 32000000, avgTokunbo: 26000000 },

  // Rogue (2008-2024)
  { make: 'Nissan', model: 'Rogue', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Nissan', model: 'Rogue', year: 2011, nigUsedLow: 1300000, nigUsedHigh: 2600000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Rogue', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2700000, avgTokunbo: 5300000 },
  { make: 'Nissan', model: 'Rogue', year: 2017, nigUsedLow: 2800000, nigUsedHigh: 5500000, tokunboLow: 6000000, tokunboHigh: 11000000, avgUsed: 4100000, avgTokunbo: 8500000 },
  { make: 'Nissan', model: 'Rogue', year: 2019, tokunboLow: 10000000, tokunboHigh: 17000000, avgTokunbo: 13500000 },
  { make: 'Nissan', model: 'Rogue', year: 2021, tokunboLow: 15000000, tokunboHigh: 25000000, avgTokunbo: 20000000 },
  { make: 'Nissan', model: 'Rogue', year: 2024, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },

  // Maxima (2002-2020)
  { make: 'Nissan', model: 'Maxima', year: 2002, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1600000, avgUsed: 750000, avgTokunbo: 1200000 },
  { make: 'Nissan', model: 'Maxima', year: 2004, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'Maxima', year: 2007, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Nissan', model: 'Maxima', year: 2010, nigUsedLow: 1300000, nigUsedHigh: 2600000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Maxima', year: 2013, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2700000, avgTokunbo: 5300000 },
  { make: 'Nissan', model: 'Maxima', year: 2016, nigUsedLow: 3000000, nigUsedHigh: 6000000, tokunboLow: 7000000, tokunboHigh: 13000000, avgUsed: 4500000, avgTokunbo: 10000000 },
  { make: 'Nissan', model: 'Maxima', year: 2018, nigUsedLow: 4500000, nigUsedHigh: 9000000, tokunboLow: 11000000, tokunboHigh: 19000000, avgUsed: 6800000, avgTokunbo: 15000000 },
  { make: 'Nissan', model: 'Maxima', year: 2020, tokunboLow: 18000000, tokunboHigh: 30000000, avgTokunbo: 24000000 },

  // Armada (2004-2023)
  { make: 'Nissan', model: 'Armada', year: 2004, nigUsedLow: 800000, nigUsedHigh: 1600000, tokunboLow: 1300000, tokunboHigh: 2600000, avgUsed: 1200000, avgTokunbo: 1900000 },
  { make: 'Nissan', model: 'Armada', year: 2007, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1900000, avgTokunbo: 3000000 },
  { make: 'Nissan', model: 'Armada', year: 2010, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2700000, avgTokunbo: 4500000 },
  { make: 'Nissan', model: 'Armada', year: 2013, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 9000000, avgUsed: 3800000, avgTokunbo: 7000000 },
  { make: 'Nissan', model: 'Armada', year: 2017, nigUsedLow: 4500000, nigUsedHigh: 9000000, tokunboLow: 10000000, tokunboHigh: 18000000, avgUsed: 6800000, avgTokunbo: 14000000 },
  { make: 'Nissan', model: 'Armada', year: 2020, tokunboLow: 20000000, tokunboHigh: 35000000, avgTokunbo: 27500000 },
  { make: 'Nissan', model: 'Armada', year: 2023, tokunboLow: 35000000, tokunboHigh: 55000000, avgTokunbo: 45000000 },

  // X-Trail (2004-2021)
  { make: 'Nissan', model: 'X-Trail', year: 2004, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'X-Trail', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1700000, tokunboHigh: 3400000, avgUsed: 1500000, avgTokunbo: 2500000 },
  { make: 'Nissan', model: 'X-Trail', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2700000, avgTokunbo: 5300000 },
  { make: 'Nissan', model: 'X-Trail', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 7000000, tokunboLow: 8000000, tokunboHigh: 14000000, avgUsed: 5300000, avgTokunbo: 11000000 },
  { make: 'Nissan', model: 'X-Trail', year: 2021, tokunboLow: 16000000, tokunboHigh: 26000000, avgTokunbo: 21000000 },

  // Quest (2000-2015)
  { make: 'Nissan', model: 'Quest', year: 2000, nigUsedLow: 400000, nigUsedHigh: 800000, tokunboLow: 600000, tokunboHigh: 1200000, avgUsed: 600000, avgTokunbo: 900000 },
  { make: 'Nissan', model: 'Quest', year: 2004, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 1000000, tokunboHigh: 2000000, avgUsed: 900000, avgTokunbo: 1500000 },
  { make: 'Nissan', model: 'Quest', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Nissan', model: 'Quest', year: 2011, nigUsedLow: 1300000, nigUsedHigh: 2600000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Nissan', model: 'Quest', year: 2015, nigUsedLow: 2000000, nigUsedHigh: 4000000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 3000000, avgTokunbo: 5300000 },

  // Patrol (2003-2025)
  { make: 'Nissan', model: 'Patrol', year: 2003, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1700000, tokunboHigh: 3400000, avgUsed: 1500000, avgTokunbo: 2500000 },
  { make: 'Nissan', model: 'Patrol', year: 2008, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3000000, tokunboHigh: 6000000, avgUsed: 2700000, avgTokunbo: 4500000 },
  { make: 'Nissan', model: 'Patrol', year: 2013, nigUsedLow: 3500000, nigUsedHigh: 7000000, tokunboLow: 7000000, tokunboHigh: 13000000, avgUsed: 5300000, avgTokunbo: 10000000 },
  { make: 'Nissan', model: 'Patrol', year: 2017, nigUsedLow: 6000000, nigUsedHigh: 12000000, tokunboLow: 15000000, tokunboHigh: 25000000, avgUsed: 9000000, avgTokunbo: 20000000 },
  { make: 'Nissan', model: 'Patrol', year: 2021, tokunboLow: 35000000, tokunboHigh: 55000000, avgTokunbo: 45000000 },
  { make: 'Nissan', model: 'Patrol', year: 2025, tokunboLow: 60000000, tokunboHigh: 90000000, avgTokunbo: 75000000 },

  // Frontier (2003-2022)
  { make: 'Nissan', model: 'Frontier', year: 2003, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1600000, avgUsed: 750000, avgTokunbo: 1200000 },
  { make: 'Nissan', model: 'Frontier', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Nissan', model: 'Frontier', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3600000, tokunboLow: 3500000, tokunboHigh: 7000000, avgUsed: 2700000, avgTokunbo: 5300000 },
  { make: 'Nissan', model: 'Frontier', year: 2019, tokunboLow: 10000000, tokunboHigh: 17000000, avgTokunbo: 13500000 },
  { make: 'Nissan', model: 'Frontier', year: 2022, tokunboLow: 18000000, tokunboHigh: 28000000, avgTokunbo: 23000000 },

  // Primera (2001-2003)
  { make: 'Nissan', model: 'Primera', year: 2001, nigUsedLow: 300000, nigUsedHigh: 600000, tokunboLow: 500000, tokunboHigh: 1000000, avgUsed: 450000, avgTokunbo: 750000 },
  { make: 'Nissan', model: 'Primera', year: 2003, nigUsedLow: 350000, nigUsedHigh: 700000, tokunboLow: 600000, tokunboHigh: 1200000, avgUsed: 525000, avgTokunbo: 900000 },

  // Almera (2003-2013)
  { make: 'Nissan', model: 'Almera', year: 2003, nigUsedLow: 350000, nigUsedHigh: 700000, tokunboLow: 600000, tokunboHigh: 1200000, avgUsed: 525000, avgTokunbo: 900000 },
  { make: 'Nissan', model: 'Almera', year: 2013, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1700000, tokunboHigh: 3400000, avgUsed: 1500000, avgTokunbo: 2500000 },

  // Juke (2012-2021)
  { make: 'Nissan', model: 'Juke', year: 2012, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2800000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4100000 },
  { make: 'Nissan', model: 'Juke', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 5000000, tokunboLow: 5000000, tokunboHigh: 9000000, avgUsed: 3800000, avgTokunbo: 7000000 },
  { make: 'Nissan', model: 'Juke', year: 2021, tokunboLow: 12000000, tokunboHigh: 20000000, avgTokunbo: 16000000 },
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
        dataSource: 'Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
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
        dataSource: 'Nissan Cars in Nigeria Comprehensive Price & Valuation Guide (March 2026)',
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
