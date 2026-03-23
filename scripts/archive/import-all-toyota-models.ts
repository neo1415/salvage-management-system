/**
 * Direct Database Import: All Toyota Models (2000-2025)
 * 
 * This script directly imports all 9 Toyota models into the database
 * using the bulk import service.
 * 
 * Run: npx tsx scripts/import-all-toyota-models.ts
 */

import { config } from 'dotenv';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';

config();

// Helper to convert simple format to database format
function convertToDbFormat(simple: any) {
  const [mileageLow, mileageHigh] = simple.mileageRange.split('-').map(Number);
  
  // Map generic conditions to Nigerian market categories
  let conditionCategory: string;
  if (simple.condition === 'fair') {
    conditionCategory = 'nig_used_low'; // Fair = Nigerian used, low condition
  } else if (simple.condition === 'good') {
    conditionCategory = 'tokunbo_low'; // Good = Tokunbo (foreign used), low condition
  } else if (simple.condition === 'excellent') {
    conditionCategory = 'tokunbo_high'; // Excellent = Tokunbo (foreign used), high condition
  } else {
    conditionCategory = 'average'; // Default to average
  }
  
  return {
    make: simple.make,
    model: simple.model,
    year: simple.year,
    conditionCategory,
    lowPrice: Math.round(simple.basePrice * 0.9),
    highPrice: Math.round(simple.basePrice * 1.1),
    averagePrice: simple.basePrice,
    mileageLow,
    mileageHigh,
    dataSource: 'Jiji.ng, Carlots.ng, Cars45.com',
  };
}

// Toyota Camry Valuations (2000-2025) - 62 records
const camryValuations = [
  { make: 'Toyota', model: 'Camry', year: 2000, condition: 'fair', basePrice: 800000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Camry', year: 2000, condition: 'good', basePrice: 1500000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Camry', year: 2002, condition: 'fair', basePrice: 1000000, mileageRange: '140000-220000' },
  { make: 'Toyota', model: 'Camry', year: 2002, condition: 'good', basePrice: 1800000, mileageRange: '140000-220000' },
  { make: 'Toyota', model: 'Camry', year: 2004, condition: 'fair', basePrice: 1200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Camry', year: 2004, condition: 'good', basePrice: 2200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'fair', basePrice: 1500000, mileageRange: '100000-180000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'good', basePrice: 3000000, mileageRange: '100000-180000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'excellent', basePrice: 4500000, mileageRange: '100000-180000' },
  { make: 'Toyota', model: 'Camry', year: 2007, condition: 'fair', basePrice: 2000000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Camry', year: 2007, condition: 'good', basePrice: 3800000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Camry', year: 2007, condition: 'excellent', basePrice: 5500000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Camry', year: 2008, condition: 'fair', basePrice: 2500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Camry', year: 2008, condition: 'good', basePrice: 4500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Camry', year: 2008, condition: 'excellent', basePrice: 6500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Camry', year: 2009, condition: 'fair', basePrice: 2800000, mileageRange: '80000-150000' },
  { make: 'Toyota', model: 'Camry', year: 2009, condition: 'good', basePrice: 5000000, mileageRange: '80000-150000' },
  { make: 'Toyota', model: 'Camry', year: 2009, condition: 'excellent', basePrice: 7000000, mileageRange: '80000-150000' },
  { make: 'Toyota', model: 'Camry', year: 2010, condition: 'fair', basePrice: 3000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Camry', year: 2010, condition: 'good', basePrice: 5500000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Camry', year: 2010, condition: 'excellent', basePrice: 8000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Camry', year: 2011, condition: 'fair', basePrice: 3500000, mileageRange: '70000-130000' },
  { make: 'Toyota', model: 'Camry', year: 2011, condition: 'good', basePrice: 6000000, mileageRange: '70000-130000' },
  { make: 'Toyota', model: 'Camry', year: 2011, condition: 'excellent', basePrice: 9000000, mileageRange: '70000-130000' },
  { make: 'Toyota', model: 'Camry', year: 2012, condition: 'fair', basePrice: 4000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Camry', year: 2012, condition: 'good', basePrice: 7000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Camry', year: 2012, condition: 'excellent', basePrice: 11000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Camry', year: 2013, condition: 'fair', basePrice: 5000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'Camry', year: 2013, condition: 'good', basePrice: 8500000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'Camry', year: 2013, condition: 'excellent', basePrice: 13000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'Camry', year: 2014, condition: 'fair', basePrice: 6000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Camry', year: 2014, condition: 'good', basePrice: 10000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Camry', year: 2014, condition: 'excellent', basePrice: 16000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Camry', year: 2015, condition: 'fair', basePrice: 7000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Camry', year: 2015, condition: 'good', basePrice: 12000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Camry', year: 2015, condition: 'excellent', basePrice: 20000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Camry', year: 2016, condition: 'fair', basePrice: 8000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Camry', year: 2016, condition: 'good', basePrice: 14000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Camry', year: 2016, condition: 'excellent', basePrice: 22000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Camry', year: 2017, condition: 'fair', basePrice: 9000000, mileageRange: '30000-65000' },
  { make: 'Toyota', model: 'Camry', year: 2017, condition: 'good', basePrice: 15000000, mileageRange: '30000-65000' },
  { make: 'Toyota', model: 'Camry', year: 2017, condition: 'excellent', basePrice: 25000000, mileageRange: '30000-65000' },
  { make: 'Toyota', model: 'Camry', year: 2018, condition: 'fair', basePrice: 11000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Camry', year: 2018, condition: 'good', basePrice: 18000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Camry', year: 2018, condition: 'excellent', basePrice: 28000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Camry', year: 2019, condition: 'fair', basePrice: 13000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'Camry', year: 2019, condition: 'good', basePrice: 20000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'Camry', year: 2019, condition: 'excellent', basePrice: 32000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'Camry', year: 2020, condition: 'fair', basePrice: 15000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Camry', year: 2020, condition: 'good', basePrice: 23000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Camry', year: 2020, condition: 'excellent', basePrice: 35000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Camry', year: 2021, condition: 'fair', basePrice: 18000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'Camry', year: 2021, condition: 'good', basePrice: 26000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'Camry', year: 2021, condition: 'excellent', basePrice: 40000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'Camry', year: 2022, condition: 'fair', basePrice: 20000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Camry', year: 2022, condition: 'good', basePrice: 30000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Camry', year: 2022, condition: 'excellent', basePrice: 45000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Camry', year: 2023, condition: 'good', basePrice: 35000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Camry', year: 2023, condition: 'excellent', basePrice: 50000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Camry', year: 2024, condition: 'good', basePrice: 40000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Camry', year: 2024, condition: 'excellent', basePrice: 55000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Camry', year: 2025, condition: 'excellent', basePrice: 60000000, mileageRange: '0-15000' },
];

// Toyota Corolla Valuations (2000-2025) - 25 records
const corollaValuations = [
  { make: 'Toyota', model: 'Corolla', year: 2000, condition: 'fair', basePrice: 600000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Corolla', year: 2000, condition: 'good', basePrice: 1200000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Corolla', year: 2003, condition: 'fair', basePrice: 800000, mileageRange: '130000-210000' },
  { make: 'Toyota', model: 'Corolla', year: 2003, condition: 'good', basePrice: 1500000, mileageRange: '130000-210000' },
  { make: 'Toyota', model: 'Corolla', year: 2005, condition: 'fair', basePrice: 1000000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Corolla', year: 2005, condition: 'good', basePrice: 1800000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Corolla', year: 2008, condition: 'fair', basePrice: 1500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Corolla', year: 2008, condition: 'good', basePrice: 2500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Corolla', year: 2010, condition: 'fair', basePrice: 2000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Corolla', year: 2010, condition: 'good', basePrice: 3500000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Corolla', year: 2012, condition: 'fair', basePrice: 2500000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Corolla', year: 2012, condition: 'good', basePrice: 4500000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Corolla', year: 2014, condition: 'fair', basePrice: 3500000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Corolla', year: 2014, condition: 'good', basePrice: 6000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Corolla', year: 2016, condition: 'fair', basePrice: 5000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Corolla', year: 2016, condition: 'good', basePrice: 8500000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Corolla', year: 2018, condition: 'fair', basePrice: 7000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Corolla', year: 2018, condition: 'good', basePrice: 11000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Corolla', year: 2020, condition: 'fair', basePrice: 9000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Corolla', year: 2020, condition: 'good', basePrice: 14000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Corolla', year: 2022, condition: 'fair', basePrice: 12000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Corolla', year: 2022, condition: 'good', basePrice: 18000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Corolla', year: 2024, condition: 'good', basePrice: 22000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Corolla', year: 2024, condition: 'excellent', basePrice: 28000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Corolla', year: 2025, condition: 'excellent', basePrice: 32000000, mileageRange: '0-15000' },
];

// Toyota Highlander Valuations (2001-2024) - 22 records
const highlanderValuations = [
  { make: 'Toyota', model: 'Highlander', year: 2001, condition: 'fair', basePrice: 1500000, mileageRange: '145000-230000' },
  { make: 'Toyota', model: 'Highlander', year: 2001, condition: 'good', basePrice: 2500000, mileageRange: '145000-230000' },
  { make: 'Toyota', model: 'Highlander', year: 2004, condition: 'fair', basePrice: 2000000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Highlander', year: 2004, condition: 'good', basePrice: 3500000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Highlander', year: 2007, condition: 'fair', basePrice: 3000000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Highlander', year: 2007, condition: 'good', basePrice: 5500000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Highlander', year: 2010, condition: 'fair', basePrice: 5000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Highlander', year: 2010, condition: 'good', basePrice: 9000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Highlander', year: 2012, condition: 'fair', basePrice: 7000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Highlander', year: 2012, condition: 'good', basePrice: 12000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Highlander', year: 2014, condition: 'fair', basePrice: 10000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Highlander', year: 2014, condition: 'good', basePrice: 16000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Highlander', year: 2016, condition: 'fair', basePrice: 14000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Highlander', year: 2016, condition: 'good', basePrice: 22000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Highlander', year: 2018, condition: 'fair', basePrice: 18000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Highlander', year: 2018, condition: 'good', basePrice: 28000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Highlander', year: 2020, condition: 'fair', basePrice: 25000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Highlander', year: 2020, condition: 'good', basePrice: 38000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Highlander', year: 2022, condition: 'fair', basePrice: 35000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Highlander', year: 2022, condition: 'good', basePrice: 50000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Highlander', year: 2024, condition: 'good', basePrice: 60000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Highlander', year: 2024, condition: 'excellent', basePrice: 75000000, mileageRange: '0-20000' },
];

// Toyota RAV4 Valuations (2000-2025) - 19 records
const rav4Valuations = [
  { make: 'Toyota', model: 'RAV4', year: 2000, condition: 'fair', basePrice: 800000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'RAV4', year: 2000, condition: 'good', basePrice: 1500000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'RAV4', year: 2004, condition: 'fair', basePrice: 1200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'RAV4', year: 2004, condition: 'good', basePrice: 2200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'RAV4', year: 2008, condition: 'fair', basePrice: 2000000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'RAV4', year: 2008, condition: 'good', basePrice: 3800000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'RAV4', year: 2010, condition: 'fair', basePrice: 3000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'RAV4', year: 2010, condition: 'good', basePrice: 5500000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'RAV4', year: 2013, condition: 'fair', basePrice: 5000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'RAV4', year: 2013, condition: 'good', basePrice: 9000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'RAV4', year: 2016, condition: 'fair', basePrice: 9000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'RAV4', year: 2016, condition: 'good', basePrice: 15000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'RAV4', year: 2019, condition: 'fair', basePrice: 15000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'RAV4', year: 2019, condition: 'good', basePrice: 23000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'RAV4', year: 2021, condition: 'fair', basePrice: 20000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'RAV4', year: 2021, condition: 'good', basePrice: 30000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'RAV4', year: 2023, condition: 'good', basePrice: 38000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'RAV4', year: 2023, condition: 'excellent', basePrice: 48000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'RAV4', year: 2025, condition: 'excellent', basePrice: 55000000, mileageRange: '0-15000' },
];

// Toyota Sienna Valuations (2000-2025) - 21 records
const siennaValuations = [
  { make: 'Toyota', model: 'Sienna', year: 2000, condition: 'fair', basePrice: 900000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Sienna', year: 2000, condition: 'good', basePrice: 1700000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Sienna', year: 2004, condition: 'fair', basePrice: 1500000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Sienna', year: 2004, condition: 'good', basePrice: 2800000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Sienna', year: 2007, condition: 'fair', basePrice: 2500000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Sienna', year: 2007, condition: 'good', basePrice: 4500000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Sienna', year: 2010, condition: 'fair', basePrice: 4000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Sienna', year: 2010, condition: 'good', basePrice: 7000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Sienna', year: 2012, condition: 'fair', basePrice: 5500000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Sienna', year: 2012, condition: 'good', basePrice: 9500000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Sienna', year: 2015, condition: 'fair', basePrice: 9000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Sienna', year: 2015, condition: 'good', basePrice: 15000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Sienna', year: 2018, condition: 'fair', basePrice: 14000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Sienna', year: 2018, condition: 'good', basePrice: 22000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Sienna', year: 2020, condition: 'fair', basePrice: 18000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Sienna', year: 2020, condition: 'good', basePrice: 28000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Sienna', year: 2022, condition: 'fair', basePrice: 25000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Sienna', year: 2022, condition: 'good', basePrice: 38000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Sienna', year: 2024, condition: 'good', basePrice: 45000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Sienna', year: 2024, condition: 'excellent', basePrice: 55000000, mileageRange: '0-20000' },
  { make: 'Toyota', model: 'Sienna', year: 2025, condition: 'excellent', basePrice: 60000000, mileageRange: '0-15000' },
];

// Toyota Land Cruiser Valuations (2000-2025) - 17 records
const landCruiserValuations = [
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, condition: 'fair', basePrice: 2000000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2000, condition: 'good', basePrice: 3500000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, condition: 'fair', basePrice: 4000000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2005, condition: 'good', basePrice: 7000000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, condition: 'fair', basePrice: 6000000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2008, condition: 'good', basePrice: 11000000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2012, condition: 'fair', basePrice: 12000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2012, condition: 'good', basePrice: 20000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, condition: 'fair', basePrice: 18000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2015, condition: 'good', basePrice: 30000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2018, condition: 'fair', basePrice: 28000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2018, condition: 'good', basePrice: 45000000, mileageRange: '25000-55000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, condition: 'fair', basePrice: 40000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2020, condition: 'good', basePrice: 60000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, condition: 'fair', basePrice: 55000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2022, condition: 'good', basePrice: 80000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Land Cruiser', year: 2025, condition: 'excellent', basePrice: 120000000, mileageRange: '0-15000' },
];

// Toyota Prado Valuations (2003-2025) - 15 records
const pradoValuations = [
  { make: 'Toyota', model: 'Prado', year: 2003, condition: 'fair', basePrice: 2000000, mileageRange: '130000-210000' },
  { make: 'Toyota', model: 'Prado', year: 2003, condition: 'good', basePrice: 3500000, mileageRange: '130000-210000' },
  { make: 'Toyota', model: 'Prado', year: 2007, condition: 'fair', basePrice: 4000000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Prado', year: 2007, condition: 'good', basePrice: 7000000, mileageRange: '90000-165000' },
  { make: 'Toyota', model: 'Prado', year: 2010, condition: 'fair', basePrice: 7000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Prado', year: 2010, condition: 'good', basePrice: 12000000, mileageRange: '75000-140000' },
  { make: 'Toyota', model: 'Prado', year: 2014, condition: 'fair', basePrice: 14000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Prado', year: 2014, condition: 'good', basePrice: 22000000, mileageRange: '45000-90000' },
  { make: 'Toyota', model: 'Prado', year: 2017, condition: 'fair', basePrice: 20000000, mileageRange: '30000-65000' },
  { make: 'Toyota', model: 'Prado', year: 2017, condition: 'good', basePrice: 32000000, mileageRange: '30000-65000' },
  { make: 'Toyota', model: 'Prado', year: 2020, condition: 'fair', basePrice: 30000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Prado', year: 2020, condition: 'good', basePrice: 45000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Prado', year: 2023, condition: 'good', basePrice: 55000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Prado', year: 2023, condition: 'excellent', basePrice: 70000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Prado', year: 2025, condition: 'excellent', basePrice: 85000000, mileageRange: '0-15000' },
];

// Toyota Venza Valuations (2009-2025) - 11 records
const venzaValuations = [
  { make: 'Toyota', model: 'Venza', year: 2009, condition: 'fair', basePrice: 2500000, mileageRange: '80000-150000' },
  { make: 'Toyota', model: 'Venza', year: 2009, condition: 'good', basePrice: 4500000, mileageRange: '80000-150000' },
  { make: 'Toyota', model: 'Venza', year: 2012, condition: 'fair', basePrice: 4500000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Venza', year: 2012, condition: 'good', basePrice: 8000000, mileageRange: '60000-115000' },
  { make: 'Toyota', model: 'Venza', year: 2015, condition: 'fair', basePrice: 7000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Venza', year: 2015, condition: 'good', basePrice: 12000000, mileageRange: '40000-80000' },
  { make: 'Toyota', model: 'Venza', year: 2020, condition: 'fair', basePrice: 15000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Venza', year: 2020, condition: 'good', basePrice: 23000000, mileageRange: '15000-40000' },
  { make: 'Toyota', model: 'Venza', year: 2023, condition: 'good', basePrice: 30000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Venza', year: 2023, condition: 'excellent', basePrice: 40000000, mileageRange: '0-25000' },
  { make: 'Toyota', model: 'Venza', year: 2025, condition: 'excellent', basePrice: 50000000, mileageRange: '0-15000' },
];

// Toyota Avalon Valuations (2000-2022) - 16 records
const avalonValuations = [
  { make: 'Toyota', model: 'Avalon', year: 2000, condition: 'fair', basePrice: 900000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Avalon', year: 2000, condition: 'good', basePrice: 1700000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Avalon', year: 2005, condition: 'fair', basePrice: 1800000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Avalon', year: 2005, condition: 'good', basePrice: 3200000, mileageRange: '110000-190000' },
  { make: 'Toyota', model: 'Avalon', year: 2008, condition: 'fair', basePrice: 2500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Avalon', year: 2008, condition: 'good', basePrice: 4500000, mileageRange: '85000-160000' },
  { make: 'Toyota', model: 'Avalon', year: 2013, condition: 'fair', basePrice: 5000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'Avalon', year: 2013, condition: 'good', basePrice: 9000000, mileageRange: '55000-100000' },
  { make: 'Toyota', model: 'Avalon', year: 2016, condition: 'fair', basePrice: 8000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Avalon', year: 2016, condition: 'good', basePrice: 14000000, mileageRange: '35000-70000' },
  { make: 'Toyota', model: 'Avalon', year: 2019, condition: 'fair', basePrice: 13000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'Avalon', year: 2019, condition: 'good', basePrice: 20000000, mileageRange: '20000-45000' },
  { make: 'Toyota', model: 'Avalon', year: 2021, condition: 'fair', basePrice: 18000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'Avalon', year: 2021, condition: 'good', basePrice: 28000000, mileageRange: '10000-35000' },
  { make: 'Toyota', model: 'Avalon', year: 2022, condition: 'good', basePrice: 32000000, mileageRange: '5000-30000' },
  { make: 'Toyota', model: 'Avalon', year: 2022, condition: 'excellent', basePrice: 42000000, mileageRange: '5000-30000' },
];

// Combine all valuations
const allValuations = [
  ...camryValuations.map(convertToDbFormat),
  ...corollaValuations.map(convertToDbFormat),
  ...highlanderValuations.map(convertToDbFormat),
  ...rav4Valuations.map(convertToDbFormat),
  ...siennaValuations.map(convertToDbFormat),
  ...landCruiserValuations.map(convertToDbFormat),
  ...pradoValuations.map(convertToDbFormat),
  ...venzaValuations.map(convertToDbFormat),
  ...avalonValuations.map(convertToDbFormat),
];

console.log('🚗 Toyota Multi-Model Import Script');
console.log('====================================\n');
console.log(`📊 Prepared ${allValuations.length} vehicle valuations`);
console.log('⏳ Starting import...\n');

async function importData() {
  try {
    console.log('📤 Importing valuations using bulk import service...');
    
    // Use bulk import service which handles upserts
    const result = await bulkImportService.importValuations(allValuations);
    
    console.log(`✅ Import complete!`);
    console.log(`   Success: ${result.successCount} records`);
    console.log(`   Failed: ${result.failureCount} records`);
    console.log(`   Upserted: ${result.upsertedCount} records`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   - Row ${err.row}: ${err.error}`);
      });
    }
    
    console.log('\n🎉 All Toyota models imported!');
    console.log('   Models imported:');
    console.log('   - Camry: 62 records');
    console.log('   - Corolla: 25 records');
    console.log('   - Highlander: 22 records');
    console.log('   - RAV4: 19 records');
    console.log('   - Sienna: 21 records');
    console.log('   - Land Cruiser: 17 records');
    console.log('   - Prado: 15 records');
    console.log('   - Venza: 11 records');
    console.log('   - Avalon: 16 records');
    console.log('   Total: 208 records');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importData();
