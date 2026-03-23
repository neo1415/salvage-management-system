/**
 * Import Toyota Nigeria Market Data (2000-2025)
 * 
 * This script imports comprehensive Toyota vehicle valuations and damage deductions
 * for the Nigerian market based on February 2026 market research.
 * 
 * Data sources: Jiji.ng, Carlots.ng, Cars45.com, Sellatease.com, etc.
 * 
 * Run: npx tsx scripts/import-toyota-nigeria-data.ts
 */

import { config } from 'dotenv';

config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Helper to convert Naira string to number
function parseNaira(nairaStr: string): number {
  if (!nairaStr || nairaStr === 'N/A') return 0;
  // Remove ₦, M, k, commas, spaces
  const cleaned = nairaStr.replace(/[₦,\s]/g, '');
  
  if (cleaned.includes('M')) {
    return parseFloat(cleaned.replace('M', '')) * 1_000_000;
  }
  if (cleaned.includes('k')) {
    return parseFloat(cleaned.replace('k', '')) * 1_000;
  }
  return parseFloat(cleaned) || 0;
}

// Toyota Camry Valuations (2000-2025)
const camryValuations = [
  // Big Daddy era (2000-2006)
  { make: 'Toyota', model: 'Camry', year: 2000, condition: 'fair', basePrice: 800000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Camry', year: 2000, condition: 'good', basePrice: 1500000, mileageRange: '150000-240000' },
  { make: 'Toyota', model: 'Camry', year: 2002, condition: 'fair', basePrice: 1000000, mileageRange: '140000-220000' },
  { make: 'Toyota', model: 'Camry', year: 2002, condition: 'good', basePrice: 1800000, mileageRange: '140000-220000' },
  { make: 'Toyota', model: 'Camry', year: 2004, condition: 'fair', basePrice: 1200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Camry', year: 2004, condition: 'good', basePrice: 2200000, mileageRange: '120000-200000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'fair', basePrice: 1500000, mileageRange: '100000-180000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'good', basePrice: 3000000, mileageRange: '100000-180000' },
  { make: 'Toyota', model: 'Camry', year: 2006, condition: 'excellent', basePrice: 4500000, mileageRange: '100000-180000' },
  
  // Muscle era (2007-2011)
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
  
  // Modern era (2012-2018)
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
  
  // Latest (2019-2025)
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

// Toyota Corolla Valuations (2000-2025)
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

// Toyota Highlander Valuations (2001-2024)
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

// Toyota RAV4 Valuations (2000-2025)
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

// Toyota Sienna Valuations (2000-2025)
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

// Toyota Land Cruiser Valuations (2000-2025)
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

// Toyota Prado Valuations (2003-2025)
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

// Toyota Venza Valuations (2009-2025)
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

// Toyota Avalon Valuations (2000-2022)
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
  ...camryValuations,
  ...corollaValuations,
  ...highlanderValuations,
  ...rav4Valuations,
  ...siennaValuations,
  ...landCruiserValuations,
  ...pradoValuations,
  ...venzaValuations,
  ...avalonValuations,
];

// Toyota Damage Deductions
const damageDeductions = [
  // Minor cosmetic damage
  { damageType: 'minor_scratch', make: 'Toyota', model: null, repairCost: 50000, valuationDeduction: 100000 },
  { damageType: 'minor_dent', make: 'Toyota', model: null, repairCost: 80000, valuationDeduction: 150000 },
  { damageType: 'paint_fade', make: 'Toyota', model: null, repairCost: 120000, valuationDeduction: 200000 },
  
  // Moderate damage
  { damageType: 'bumper_damage', make: 'Toyota', model: null, repairCost: 150000, valuationDeduction: 300000 },
  { damageType: 'door_dent', make: 'Toyota', model: null, repairCost: 200000, valuationDeduction: 400000 },
  { damageType: 'windshield_crack', make: 'Toyota', model: null, repairCost: 180000, valuationDeduction: 350000 },
  { damageType: 'headlight_damage', make: 'Toyota', model: null, repairCost: 100000, valuationDeduction: 200000 },
  { damageType: 'taillight_damage', make: 'Toyota', model: null, repairCost: 80000, valuationDeduction: 150000 },
  
  // Significant damage
  { damageType: 'fender_damage', make: 'Toyota', model: null, repairCost: 350000, valuationDeduction: 700000 },
  { damageType: 'hood_damage', make: 'Toyota', model: null, repairCost: 400000, valuationDeduction: 800000 },
  { damageType: 'side_mirror_damage', make: 'Toyota', model: null, repairCost: 120000, valuationDeduction: 250000 },
  { damageType: 'wheel_rim_damage', make: 'Toyota', model: null, repairCost: 150000, valuationDeduction: 300000 },
  
  // Major damage
  { damageType: 'engine_issue', make: 'Toyota', model: null, repairCost: 800000, valuationDeduction: 1500000 },
  { damageType: 'transmission_issue', make: 'Toyota', model: null, repairCost: 600000, valuationDeduction: 1200000 },
  { damageType: 'suspension_damage', make: 'Toyota', model: null, repairCost: 400000, valuationDeduction: 800000 },
  { damageType: 'electrical_system', make: 'Toyota', model: null, repairCost: 350000, valuationDeduction: 700000 },
  
  // Structural damage
  { damageType: 'frame_damage', make: 'Toyota', model: null, repairCost: 1500000, valuationDeduction: 3000000 },
  { damageType: 'roof_damage', make: 'Toyota', model: null, repairCost: 800000, valuationDeduction: 1600000 },
  { damageType: 'floor_pan_rust', make: 'Toyota', model: null, repairCost: 500000, valuationDeduction: 1000000 },
  
  // Interior damage
  { damageType: 'seat_damage', make: 'Toyota', model: null, repairCost: 150000, valuationDeduction: 300000 },
  { damageType: 'dashboard_crack', make: 'Toyota', model: null, repairCost: 200000, valuationDeduction: 400000 },
  { damageType: 'ac_not_working', make: 'Toyota', model: null, repairCost: 250000, valuationDeduction: 500000 },
];

console.log('🚗 Toyota Nigeria Data Import Script');
console.log('=====================================\n');
console.log(`📊 Prepared ${allValuations.length} vehicle valuations`);
console.log(`🔧 Prepared ${damageDeductions.length} damage deductions`);
console.log('⏳ Starting import...\n');

async function importData() {
  try {
    // Import valuations
    console.log('📤 Importing vehicle valuations...');
    const valuationsResponse = await fetch(`${API_BASE}/api/admin/valuations/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(allValuations),
    });

    if (!valuationsResponse.ok) {
      const error = await valuationsResponse.text();
      throw new Error(`Valuations import failed: ${valuationsResponse.status} - ${error}`);
    }

    const valuationsResult = await valuationsResponse.json();
    console.log('✅ Valuations import complete!');
    console.log(`   Success: ${valuationsResult.successCount} records`);
    console.log(`   Failed: ${valuationsResult.failureCount} records`);
    
    if (valuationsResult.errors && valuationsResult.errors.length > 0) {
      console.log('\n⚠️  Valuation errors:');
      valuationsResult.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   - Row ${err.row}: ${err.error}`);
      });
    }

    // Import damage deductions
    console.log('\n📤 Importing damage deductions...');
    const deductionsResponse = await fetch(`${API_BASE}/api/admin/deductions/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(damageDeductions),
    });

    if (!deductionsResponse.ok) {
      const error = await deductionsResponse.text();
      throw new Error(`Deductions import failed: ${deductionsResponse.status} - ${error}`);
    }

    const deductionsResult = await deductionsResponse.json();
    console.log('✅ Deductions import complete!');
    console.log(`   Success: ${deductionsResult.successCount} records`);
    console.log(`   Failed: ${deductionsResult.failureCount} records`);
    
    if (deductionsResult.errors && deductionsResult.errors.length > 0) {
      console.log('\n⚠️  Deduction errors:');
      deductionsResult.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   - Row ${err.row}: ${err.error}`);
      });
    }

    console.log('\n🎉 Toyota data successfully imported to database!');
    console.log('💡 Summary:');
    console.log(`   - ${valuationsResult.successCount} vehicle valuations imported`);
    console.log(`   - ${deductionsResult.successCount} damage deductions imported`);
    console.log('   - Data covers 9 Toyota models (2000-2025)');
    console.log('   - Ready for AI assessment integration');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importData();
