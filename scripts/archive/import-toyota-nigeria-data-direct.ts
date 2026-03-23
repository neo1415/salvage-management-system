/**
 * Direct Database Import: Toyota Nigeria Market Data (2000-2025)
 * 
 * This script directly imports Toyota vehicle valuations and damage deductions
 * into the database, bypassing the API layer.
 * 
 * Run: npx tsx scripts/import-toyota-nigeria-data-direct.ts
 */

import { config } from 'dotenv';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';

config();

// Toyota Camry Valuations (2000-2025)
const camryValuations = [
  // Big Daddy era (2000-2006)
  { make: 'Toyota', model: 'Camry', year: 2000, conditionCategory: 'fair', lowPrice: 700000, highPrice: 900000, averagePrice: 800000, mileageLow: 150000, mileageHigh: 240000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2000, conditionCategory: 'good', lowPrice: 1300000, highPrice: 1700000, averagePrice: 1500000, mileageLow: 150000, mileageHigh: 240000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2002, conditionCategory: 'fair', lowPrice: 900000, highPrice: 1100000, averagePrice: 1000000, mileageLow: 140000, mileageHigh: 220000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2002, conditionCategory: 'good', lowPrice: 1600000, highPrice: 2000000, averagePrice: 1800000, mileageLow: 140000, mileageHigh: 220000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2004, conditionCategory: 'fair', lowPrice: 1000000, highPrice: 1400000, averagePrice: 1200000, mileageLow: 120000, mileageHigh: 200000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2004, conditionCategory: 'good', lowPrice: 2000000, highPrice: 2400000, averagePrice: 2200000, mileageLow: 120000, mileageHigh: 200000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2006, conditionCategory: 'fair', lowPrice: 1300000, highPrice: 1700000, averagePrice: 1500000, mileageLow: 100000, mileageHigh: 180000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2006, conditionCategory: 'good', lowPrice: 2700000, highPrice: 3300000, averagePrice: 3000000, mileageLow: 100000, mileageHigh: 180000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2006, conditionCategory: 'excellent', lowPrice: 4200000, highPrice: 4800000, averagePrice: 4500000, mileageLow: 100000, mileageHigh: 180000, dataSource: 'Jiji.ng, Carlots.ng' },
  
  // Muscle era (2007-2011)
  { make: 'Toyota', model: 'Camry', year: 2007, conditionCategory: 'fair', lowPrice: 1800000, highPrice: 2200000, averagePrice: 2000000, mileageLow: 90000, mileageHigh: 165000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2007, conditionCategory: 'good', lowPrice: 3500000, highPrice: 4100000, averagePrice: 3800000, mileageLow: 90000, mileageHigh: 165000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2007, conditionCategory: 'excellent', lowPrice: 5200000, highPrice: 5800000, averagePrice: 5500000, mileageLow: 90000, mileageHigh: 165000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2008, conditionCategory: 'fair', lowPrice: 2300000, highPrice: 2700000, averagePrice: 2500000, mileageLow: 85000, mileageHigh: 160000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2008, conditionCategory: 'good', lowPrice: 4200000, highPrice: 4800000, averagePrice: 4500000, mileageLow: 85000, mileageHigh: 160000, dataSource: 'Jiji.ng, Carlots.ng' },
  { make: 'Toyota', model: 'Camry', year: 2008, conditionCategory: 'excellent', lowPrice: 6200000, highPrice: 6800000, averagePrice: 6500000, mileageLow: 85000, mileageHigh: 160000, dataSource: 'Jiji.ng, Carlots.ng' },
