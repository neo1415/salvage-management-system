/**
 * Import Audi Vehicle Valuation Data
 * 
 * This script imports comprehensive Audi vehicle valuation data for the Nigerian market
 * including models: A3, A4, A6, Q3, Q5, Q7 (2000-2025)
 * 
 * Data source: Comprehensive Audi price guide for Nigeria (February 2026)
 * Markets: Jiji.ng, Carlots.ng, Zimcompass.com/ng, Autochek.ng, Cars45, NigerianPrice.com
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

interface ValuationRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  mileageRange: string;
  baseValue: number;
  marketValueLow: number;
  marketValueHigh: number;
  source: string;
  notes?: string;
}

interface DamageDeduction {
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  estimatedRepairCost: number;
  valuationDeduction: number;
  notes: string;
}

async function getSystemUserId(): Promise<string> {
  const { users } = await import('@/lib/db/schema/users');
  const result = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);
  
  if (result.length === 0) {
    throw new Error('No system_admin user found. Please create a system admin user first.');
  }
  
  return result[0].id;
}

// Audi A3 Valuations (2000-2024)
const audiA3Valuations: ValuationRecord[] = [
  // 2000-2009 (1st & 2nd gen)
  { make: 'Audi', model: 'A3', year: 2000, conditionCategory: 'fair', mileageRange: '150k-230k km', baseValue: 800000, marketValueLow: 600000, marketValueHigh: 1000000, source: 'Jiji.ng, Carlots.ng', notes: '1st gen hatchback, 1.8T engine, high maintenance cost' },
  { make: 'Audi', model: 'A3', year: 2003, conditionCategory: 'fair', mileageRange: '130k-210k km', baseValue: 1100000, marketValueLow: 800000, marketValueHigh: 1400000, source: 'Jiji.ng, Carlots.ng', notes: 'Sportback variant, 2.0 TDI diesel, Belgium-grade available' },
  { make: 'Audi', model: 'A3', year: 2005, conditionCategory: 'good', mileageRange: '110k-190k km', baseValue: 1400000, marketValueLow: 1000000, marketValueHigh: 1800000, source: 'Jiji.ng, Carlots.ng', notes: '2nd gen (8P), 2.0T TFSI petrol, turbocharged' },
  { make: 'Audi', model: 'A3', year: 2007, conditionCategory: 'good', mileageRange: '100k-175k km', baseValue: 1600000, marketValueLow: 1100000, marketValueHigh: 2000000, source: 'Jiji.ng, Carlots.ng', notes: 'Sportback 5-door, DSG gearbox common' },
  { make: 'Audi', model: 'A3', year: 2009, conditionCategory: 'good', mileageRange: '85k-155k km', baseValue: 1900000, marketValueLow: 1300000, marketValueHigh: 2400000, source: 'Jiji.ng, Carlots.ng', notes: 'Facelifted 8P, LED DRLs, panoramic roof option' },
  
  // 2012-2018 (3rd gen)
  { make: 'Audi', model: 'A3', year: 2012, conditionCategory: 'good', mileageRange: '70k-130k km', baseValue: 2800000, marketValueLow: 2000000, marketValueHigh: 3500000, source: 'Jiji.ng, Carlots.ng', notes: '3rd gen (8V), lighter, sedan variant introduced' },
  { make: 'Audi', model: 'A3', year: 2014, conditionCategory: 'excellent', mileageRange: '55k-110k km', baseValue: 3500000, marketValueLow: 2500000, marketValueHigh: 4500000, source: 'Jiji.ng, Carlots.ng', notes: 'Sedan variant popular, Belgium grade ₦6.5-7M' },
  { make: 'Audi', model: 'A3', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-85k km', baseValue: 4800000, marketValueLow: 3500000, marketValueHigh: 6000000, source: 'Jiji.ng, Carlots.ng', notes: 'Facelifted 8V, virtual cockpit optional' },
  { make: 'Audi', model: 'A3', year: 2018, conditionCategory: 'excellent', mileageRange: '30k-65k km', baseValue: 6300000, marketValueLow: 4500000, marketValueHigh: 8000000, source: 'Jiji.ng, Carlots.ng', notes: 'Pre-update 8V, 1.4 TFSI fuel-efficient' },
  
  // 2020-2024 (4th gen)
  { make: 'Audi', model: 'A3', year: 2020, conditionCategory: 'excellent', mileageRange: '15k-45k km', baseValue: 14500000, marketValueLow: 11000000, marketValueHigh: 18000000, source: 'Jiji.ng, Carlots.ng', notes: '4th gen (8Y), fully digital cabin, limited supply' },
  { make: 'Audi', model: 'A3', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 20000000, marketValueLow: 16000000, marketValueHigh: 24000000, source: 'Jiji.ng, Carlots.ng', notes: 'Almost new tokunbo, 35TFSI standard' },
  { make: 'Audi', model: 'A3', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', baseValue: 27000000, marketValueLow: 22000000, marketValueHigh: 32000000, source: 'Jiji.ng, Carlots.ng', notes: 'Latest A3, limited dealer availability' },
];

// Audi A4 Valuations (2000-2024) - Most widely traded Audi model in Nigeria
const audiA4Valuations: ValuationRecord[] = [
  // 2000-2008 (B5, B6, B7 generations)
  { make: 'Audi', model: 'A4', year: 2000, conditionCategory: 'fair', mileageRange: '160k-260k km', baseValue: 700000, marketValueLow: 500000, marketValueHigh: 900000, source: 'Jiji.ng, Carlots.ng', notes: 'B5 gen, very old, good for spare parts' },
  { make: 'Audi', model: 'A4', year: 2002, conditionCategory: 'fair', mileageRange: '140k-240k km', baseValue: 850000, marketValueLow: 600000, marketValueHigh: 1100000, source: 'Jiji.ng, Carlots.ng', notes: 'B6 gen, Quattro AWD rarer, 1.8T petrol' },
  { make: 'Audi', model: 'A4', year: 2004, conditionCategory: 'fair', mileageRange: '130k-220k km', baseValue: 1000000, marketValueLow: 700000, marketValueHigh: 1300000, source: 'Jiji.ng, Carlots.ng', notes: 'B6 facelifted, 2.0 TDI diesel available' },
  { make: 'Audi', model: 'A4', year: 2006, conditionCategory: 'good', mileageRange: '110k-200k km', baseValue: 1300000, marketValueLow: 900000, marketValueHigh: 1700000, source: 'Jiji.ng, Carlots.ng', notes: 'B7 gen, 2.0T TFSI, Belgium grade exists' },
  { make: 'Audi', model: 'A4', year: 2008, conditionCategory: 'good', mileageRange: '100k-180k km', baseValue: 1700000, marketValueLow: 1200000, marketValueHigh: 2200000, source: 'Jiji.ng, Carlots.ng', notes: 'B8 gen (major redesign), 2.0 TFSI, DSG smoother' },
  
  // 2010-2016 (B8 generation - most common in Tokunbo market)
  { make: 'Audi', model: 'A4', year: 2010, conditionCategory: 'good', mileageRange: '85k-160k km', baseValue: 2100000, marketValueLow: 1500000, marketValueHigh: 2800000, source: 'Jiji.ng, Carlots.ng', notes: 'B8 facelift, Quattro versions available' },
  { make: 'Audi', model: 'A4', year: 2012, conditionCategory: 'good', mileageRange: '70k-140k km', baseValue: 2900000, marketValueLow: 2000000, marketValueHigh: 3800000, source: 'Jiji.ng, Carlots.ng', notes: 'B8, clean Belgium-grade ₦10.5M seen' },
  { make: 'Audi', model: 'A4', year: 2014, conditionCategory: 'excellent', mileageRange: '55k-110k km', baseValue: 3900000, marketValueLow: 2800000, marketValueHigh: 5000000, source: 'Jiji.ng, Carlots.ng', notes: 'B8 last year, high demand, fullest option ₦8.5M+' },
  { make: 'Audi', model: 'A4', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-90k km', baseValue: 5500000, marketValueLow: 4000000, marketValueHigh: 7000000, source: 'Jiji.ng, Carlots.ng', notes: 'B9 gen (major redesign), virtual cockpit standard' },
  
  // 2018-2024 (B9 generation)
  { make: 'Audi', model: 'A4', year: 2018, conditionCategory: 'excellent', mileageRange: '25k-65k km', baseValue: 7500000, marketValueLow: 5500000, marketValueHigh: 9500000, source: 'Jiji.ng, Carlots.ng', notes: 'B9 facelift, 2.0T 248hp, clean Tokunbo ₦14-17M' },
  { make: 'Audi', model: 'A4', year: 2020, conditionCategory: 'excellent', mileageRange: '10k-40k km', baseValue: 21500000, marketValueLow: 17000000, marketValueHigh: 26000000, source: 'Jiji.ng, Carlots.ng, NigerianPrice.com', notes: 'B9 updated, 12.3in virtual cockpit pro' },
  { make: 'Audi', model: 'A4', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 31500000, marketValueLow: 25000000, marketValueHigh: 38000000, source: 'Jiji.ng, Carlots.ng, ccarprice.com', notes: 'New A4 TFSI, brand new ₦55.8M' },
  { make: 'Audi', model: 'A4', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', baseValue: 42500000, marketValueLow: 35000000, marketValueHigh: 50000000, source: 'Jiji.ng, Carlots.ng', notes: 'A4/A5 rebadge transition, ultra-rare, grey market' },
];

// Audi A6 Valuations (2000-2024) - Executive flagship sedan
const audiA6Valuations: ValuationRecord[] = [
  // 2000-2010 (C5, C6 generations)
  { make: 'Audi', model: 'A6', year: 2000, conditionCategory: 'fair', mileageRange: '160k-270k km', baseValue: 700000, marketValueLow: 500000, marketValueHigh: 900000, source: 'Jiji.ng, Zimcompass.com', notes: 'C5 gen, 2.4/2.8/3.0 V6, very old' },
  { make: 'Audi', model: 'A6', year: 2002, conditionCategory: 'fair', mileageRange: '140k-250k km', baseValue: 850000, marketValueLow: 600000, marketValueHigh: 1100000, source: 'Jiji.ng, Zimcompass.com', notes: 'C5 allroad variant rare, 4.2 V8 high maintenance' },
  { make: 'Audi', model: 'A6', year: 2004, conditionCategory: 'fair', mileageRange: '120k-220k km', baseValue: 1000000, marketValueLow: 700000, marketValueHigh: 1300000, source: 'Jiji.ng, Carlots.ng', notes: 'C6 gen (new platform), 2.0T, 3.2 FSI' },
  { make: 'Audi', model: 'A6', year: 2006, conditionCategory: 'good', mileageRange: '110k-200k km', baseValue: 1400000, marketValueLow: 900000, marketValueHigh: 1800000, source: 'Jiji.ng, Carlots.ng', notes: 'C6 flagship, V6 3.2 FSI, check camshaft tensioner' },
  { make: 'Audi', model: 'A6', year: 2008, conditionCategory: 'good', mileageRange: '95k-175k km', baseValue: 1900000, marketValueLow: 1200000, marketValueHigh: 2500000, source: 'Jiji.ng, Carlots.ng', notes: 'C6 updated, 2.8 FSI, 3.0 TDI, 4-plug engine ₦3.7M' },
  { make: 'Audi', model: 'A6', year: 2010, conditionCategory: 'good', mileageRange: '80k-155k km', baseValue: 2400000, marketValueLow: 1600000, marketValueHigh: 3200000, source: 'Jiji.ng, Carlots.ng', notes: 'C6 final year, Quattro premium ₦1-2M above 2WD' },
  
  // 2012-2018 (C7 generation)
  { make: 'Audi', model: 'A6', year: 2012, conditionCategory: 'good', mileageRange: '65k-130k km', baseValue: 3800000, marketValueLow: 2500000, marketValueHigh: 5000000, source: 'Jiji.ng, Carlots.ng', notes: 'C7 gen, 3.0 TFSI supercharged, extremely clean ₦12.5M' },
  { make: 'Audi', model: 'A6', year: 2014, conditionCategory: 'excellent', mileageRange: '50k-100k km', baseValue: 5000000, marketValueLow: 3500000, marketValueHigh: 6500000, source: 'Jiji.ng, Carlots.ng, NigerianPrice.com', notes: 'C7 premium, MMI navigation, from ₦25M+' },
  { make: 'Audi', model: 'A6', year: 2016, conditionCategory: 'excellent', mileageRange: '35k-80k km', baseValue: 7000000, marketValueLow: 5000000, marketValueHigh: 9000000, source: 'Jiji.ng, Carlots.ng', notes: 'C7 facelifted, LED matrix lights, Abuja ₦12.5M' },
  { make: 'Audi', model: 'A6', year: 2018, conditionCategory: 'excellent', mileageRange: '20k-55k km', baseValue: 10000000, marketValueLow: 7000000, marketValueHigh: 13000000, source: 'Jiji.ng, Carlots.ng', notes: 'C8 gen (all-new), MHEV technology, 48V mild hybrid' },
  
  // 2020-2024 (C8 generation)
  { make: 'Audi', model: 'A6', year: 2020, conditionCategory: 'excellent', mileageRange: '10k-35k km', baseValue: 31500000, marketValueLow: 25000000, marketValueHigh: 38000000, source: 'Jiji.ng, NigerianPrice.com', notes: 'C8, 3.0T TFSI, from ₦25M+ (new listing baseline)' },
  { make: 'Audi', model: 'A6', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 42500000, marketValueLow: 35000000, marketValueHigh: 50000000, source: 'Jiji.ng, Carlots.ng', notes: 'C8 updated, very exclusive, grey market import' },
  { make: 'Audi', model: 'A6', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', baseValue: 55000000, marketValueLow: 45000000, marketValueHigh: 65000000, source: 'Jiji.ng, Carlots.ng', notes: 'Latest C8, e-tron variant exists, almost non-existent' },
];

// Audi Q3 Valuations (2012-2024) - Compact luxury SUV
const audiQ3Valuations: ValuationRecord[] = [
  { make: 'Audi', model: 'Q3', year: 2012, conditionCategory: 'good', mileageRange: '70k-130k km', baseValue: 3000000, marketValueLow: 2000000, marketValueHigh: 4000000, source: 'Jiji.ng, Carlots.ng', notes: '1st gen (8U), 2.0T TFSI Quattro, limited Nigeria supply' },
  { make: 'Audi', model: 'Q3', year: 2014, conditionCategory: 'good', mileageRange: '55k-105k km', baseValue: 3900000, marketValueLow: 2800000, marketValueHigh: 5000000, source: 'Jiji.ng, Carlots.ng', notes: '8U facelift, S-line exterior pack, panoramic roof' },
  { make: 'Audi', model: 'Q3', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-80k km', baseValue: 5000000, marketValueLow: 3500000, marketValueHigh: 6500000, source: 'Jiji.ng, Carlots.ng', notes: 'Updated 8U, good entry-level Audi SUV' },
  { make: 'Audi', model: 'Q3', year: 2019, conditionCategory: 'excellent', mileageRange: '15k-45k km', baseValue: 16000000, marketValueLow: 12000000, marketValueHigh: 20000000, source: 'Jiji.ng, Carlots.ng', notes: '2nd gen (F3), completely new platform, very rare' },
  { make: 'Audi', model: 'Q3', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 25000000, marketValueLow: 20000000, marketValueHigh: 30000000, source: 'Jiji.ng, Carlots.ng', notes: 'F3 updated, RS Q3 variant ₦100M+, grey market' },
  { make: 'Audi', model: 'Q3', year: 2024, conditionCategory: 'excellent', mileageRange: '0-8k km', baseValue: 34000000, marketValueLow: 28000000, marketValueHigh: 40000000, source: 'Jiji.ng, Carlots.ng', notes: 'Latest Q3, Sportback variant, very limited stock' },
];

// Audi Q5 Valuations (2009-2025) - Mid-size luxury SUV (sweet spot)
const audiQ5Valuations: ValuationRecord[] = [
  // 2009-2015 (1st gen)
  { make: 'Audi', model: 'Q5', year: 2009, conditionCategory: 'good', mileageRange: '100k-180k km', baseValue: 2100000, marketValueLow: 1500000, marketValueHigh: 2800000, source: 'Jiji.ng, Carlots.ng, NigerianPrice.com', notes: '1st gen (8R), 2.0T TFSI Quattro, V6 3.2 FSI' },
  { make: 'Audi', model: 'Q5', year: 2011, conditionCategory: 'good', mileageRange: '85k-160k km', baseValue: 2900000, marketValueLow: 2000000, marketValueHigh: 3800000, source: 'Jiji.ng, Carlots.ng', notes: '8R updated, hybrid variant rare, DSG service at 60k km' },
  { make: 'Audi', model: 'Q5', year: 2013, conditionCategory: 'good', mileageRange: '70k-140k km', baseValue: 3600000, marketValueLow: 2500000, marketValueHigh: 4800000, source: 'Jiji.ng, Carlots.ng', notes: '1st gen final, Premium Plus trim, 3.0 TDI diesel' },
  { make: 'Audi', model: 'Q5', year: 2015, conditionCategory: 'excellent', mileageRange: '50k-100k km', baseValue: 5000000, marketValueLow: 3500000, marketValueHigh: 6500000, source: 'Jiji.ng, NigerianPrice.com', notes: 'Facelifted 8R, LED headlights, from ₦16M+ (2025)' },
  
  // 2017-2025 (2nd gen - aspirational choice)
  { make: 'Audi', model: 'Q5', year: 2017, conditionCategory: 'excellent', mileageRange: '35k-80k km', baseValue: 6800000, marketValueLow: 5000000, marketValueHigh: 8500000, source: 'Jiji.ng, Carlots.ng', notes: '2nd gen (FY), completely redesigned, lighter, ₦13M baseline' },
  { make: 'Audi', model: 'Q5', year: 2019, conditionCategory: 'excellent', mileageRange: '20k-55k km', baseValue: 9500000, marketValueLow: 7000000, marketValueHigh: 12000000, source: 'Jiji.ng, Carlots.ng', notes: 'FY updated, MHEV standard, SQ5 variant rare' },
  { make: 'Audi', model: 'Q5', year: 2021, conditionCategory: 'excellent', mileageRange: '10k-35k km', baseValue: 27500000, marketValueLow: 22000000, marketValueHigh: 33000000, source: 'Jiji.ng, Carlots.ng', notes: 'Sportback variant (coupe-SUV), very desirable' },
  { make: 'Audi', model: 'Q5', year: 2023, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 37500000, marketValueLow: 30000000, marketValueHigh: 45000000, source: 'Jiji.ng, Carlots.ng', notes: 'FY2 refresh, large 10.1in MMI, nearly brand-new' },
  { make: 'Audi', model: 'Q5', year: 2025, conditionCategory: 'excellent', mileageRange: '0-5k km', baseValue: 46500000, marketValueLow: 38000000, marketValueHigh: 55000000, source: 'Jiji.ng, Carlots.ng', notes: 'Updated powertrain, SQ5 TDI, extremely rare, grey market' },
];

// Audi Q7 Valuations (2007-2024) - Full-size luxury SUV (most recognized Audi in Nigeria)
const audiQ7Valuations: ValuationRecord[] = [
  // 2007-2014 (1st gen 4L - most common Tokunbo)
  { make: 'Audi', model: 'Q7', year: 2007, conditionCategory: 'good', mileageRange: '120k-220k km', baseValue: 2300000, marketValueLow: 1500000, marketValueHigh: 3000000, source: 'Jiji.ng, Zimcompass.com', notes: '1st gen (4L), 3.6 V6 FSI, 7-seater, 280hp, from ₦7M' },
  { make: 'Audi', model: 'Q7', year: 2009, conditionCategory: 'good', mileageRange: '100k-190k km', baseValue: 3000000, marketValueLow: 2000000, marketValueHigh: 4000000, source: 'Jiji.ng, Carlots.ng', notes: '4L, 3.0 TDI diesel, 4.2 V8 thirsty, air suspension check' },
  { make: 'Audi', model: 'Q7', year: 2011, conditionCategory: 'good', mileageRange: '85k-165k km', baseValue: 3800000, marketValueLow: 2500000, marketValueHigh: 5000000, source: 'Jiji.ng, Carlots.ng', notes: '4L facelift, LED headlights, MMI 3G, ₦13M one year used' },
  { make: 'Audi', model: 'Q7', year: 2013, conditionCategory: 'good', mileageRange: '70k-140k km', baseValue: 5000000, marketValueLow: 3500000, marketValueHigh: 6500000, source: 'Jiji.ng, Carlots.ng', notes: 'Final 4L gen, very common in Nigeria, ₦7M starting' },
  { make: 'Audi', model: 'Q7', year: 2014, conditionCategory: 'excellent', mileageRange: '60k-120k km', baseValue: 5800000, marketValueLow: 4000000, marketValueHigh: 7500000, source: 'Jiji.ng, Carlots.ng', notes: 'Peak 1st gen supply, black on black leather, 67 Jiji ads' },
  
  // 2016-2024 (2nd gen 4M)
  { make: 'Audi', model: 'Q7', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-90k km', baseValue: 8500000, marketValueLow: 6000000, marketValueHigh: 11000000, source: 'Jiji.ng, Carlots.ng', notes: '2nd gen (4M), 300kg lighter, 3.0T TFSI, ₦18-20M S-line' },
  { make: 'Audi', model: 'Q7', year: 2018, conditionCategory: 'excellent', mileageRange: '25k-65k km', baseValue: 11000000, marketValueLow: 8000000, marketValueHigh: 14000000, source: 'Jiji.ng, Carlots.ng', notes: '4M premium, top grade fully loaded, ₦25-28M range' },
  { make: 'Audi', model: 'Q7', year: 2020, conditionCategory: 'excellent', mileageRange: '10k-40k km', baseValue: 32500000, marketValueLow: 25000000, marketValueHigh: 40000000, source: 'Jiji.ng, Carlots.ng', notes: '4M updated (OLED rear lights), SQ7 4.0T V8 ₦80M+' },
  { make: 'Audi', model: 'Q7', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', baseValue: 46500000, marketValueLow: 38000000, marketValueHigh: 55000000, source: 'Jiji.ng, Carlots.ng', notes: 'Very limited, 3.0T 340hp, TFSI e plug-in hybrid' },
  { make: 'Audi', model: 'Q7', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', baseValue: 60000000, marketValueLow: 50000000, marketValueHigh: 70000000, source: 'Jiji.ng, Carlots.ng', notes: 'Top of range, SQ7 competition, 4.0 V8 BiTurbo, bespoke' },
];

// Audi-specific damage deductions (Nigeria 2025/2026)
const audiDamageDeductions: DamageDeduction[] = [
  // Front Bumper
  { component: 'Front Bumper', damageLevel: 'minor', estimatedRepairCost: 60000, valuationDeduction: 150000, notes: 'Scratch/scuff - respray + plastic weld. Genuine Audi bumper ₦200-450k' },
  { component: 'Front Bumper', damageLevel: 'moderate', estimatedRepairCost: 140000, valuationDeduction: 375000, notes: 'Crack/dent - replace + paint match. Local copy ₦60-120k' },
  { component: 'Front Bumper', damageLevel: 'severe', estimatedRepairCost: 375000, valuationDeduction: 900000, notes: 'Destroyed - full replacement. Check airbag deployment and crash sensors' },
  
  // Rear Bumper
  { component: 'Rear Bumper', damageLevel: 'minor', estimatedRepairCost: 52500, valuationDeduction: 130000, notes: 'Touch-up + small repair. Less structural than front' },
  { component: 'Rear Bumper', damageLevel: 'moderate', estimatedRepairCost: 125000, valuationDeduction: 325000, notes: 'Panel replacement. Check reverse sensors/camera' },
  { component: 'Rear Bumper', damageLevel: 'severe', estimatedRepairCost: 325000, valuationDeduction: 750000, notes: 'Full rear impact check. Boot/trunk alignment critical' },
  
  // Bonnet/Hood
  { component: 'Bonnet/Hood', damageLevel: 'minor', estimatedRepairCost: 50000, valuationDeduction: 140000, notes: 'Light dent - panel beating + respray. No structural concern' },
  { component: 'Bonnet/Hood', damageLevel: 'moderate', estimatedRepairCost: 130000, valuationDeduction: 360000, notes: 'Multiple dents, possible hinge damage' },
  { component: 'Bonnet/Hood', damageLevel: 'severe', estimatedRepairCost: 325000, valuationDeduction: 1050000, notes: 'Crumpled - usually replaced. Check radiator/fan damage' },
  
  // Front Wing/Fender
  { component: 'Front Wing/Fender', damageLevel: 'minor', estimatedRepairCost: 42500, valuationDeduction: 125000, notes: 'Pull + paint. Common road debris impact' },
  { component: 'Front Wing/Fender', damageLevel: 'moderate', estimatedRepairCost: 115000, valuationDeduction: 325000, notes: 'Replace panel. Check headlight alignment' },
  { component: 'Front Wing/Fender', damageLevel: 'severe', estimatedRepairCost: 290000, valuationDeduction: 850000, notes: 'Possible chassis rail impact. Structural inspection critical' },
  
  // Door Panel (per door)
  { component: 'Door Panel', damageLevel: 'minor', estimatedRepairCost: 35000, valuationDeduction: 105000, notes: 'Scratch/ding - dent pull + spot repair. Common car park damage' },
  { component: 'Door Panel', damageLevel: 'moderate', estimatedRepairCost: 105000, valuationDeduction: 290000, notes: 'Full respray of panel. Check door seal' },
  { component: 'Door Panel', damageLevel: 'severe', estimatedRepairCost: 350000, valuationDeduction: 1050000, notes: 'Side impact - door replacement. Check side airbag sensor' },
  
  // Windscreen
  { component: 'Windscreen', damageLevel: 'minor', estimatedRepairCost: 27500, valuationDeduction: 70000, notes: 'Chip/crack - resin injection. ADAS recalibration needed (newer Audis)' },
  { component: 'Windscreen', damageLevel: 'moderate', estimatedRepairCost: 165000, valuationDeduction: 400000, notes: 'Full replacement. Genuine Audi glass ₦200-400k. ADAS recalib adds ₦50k+' },
  
  // Headlights
  { component: 'Headlights', damageLevel: 'minor', estimatedRepairCost: 40000, valuationDeduction: 100000, notes: 'Cracked/fogged - polish/restore ₦20k. Lens replacement ₦60k' },
  { component: 'Headlights', damageLevel: 'severe', estimatedRepairCost: 500000, valuationDeduction: 1250000, notes: 'Broken/destroyed - OEM Audi LED/Matrix unit ₦400k-1M. Used ₦200-500k' },
  
  // Tail Lights
  { component: 'Tail Lights', damageLevel: 'moderate', estimatedRepairCost: 175000, valuationDeduction: 410000, notes: 'Cracked/broken - OLED taillights very expensive. Used from Cotonou ₦150-400k' },
  
  // Engine (Oil leak)
  { component: 'Engine', damageLevel: 'minor', estimatedRepairCost: 65000, valuationDeduction: 400000, notes: 'Oil leak (gasket seepage) - valve cover gasket common. Signals maintenance neglect' },
  { component: 'Engine', damageLevel: 'severe', estimatedRepairCost: 1900000, valuationDeduction: 5500000, notes: 'Blown/seized - repair or source used engine from Cotonou (₦600k-2M). Critical deduction' },
  
  // Gearbox/Transmission
  { component: 'Gearbox/Transmission', damageLevel: 'moderate', estimatedRepairCost: 950000, valuationDeduction: 2750000, notes: 'DSG fault/slipping - Audi DSG/S-Tronic service-intensive. Untampered gear = major premium' },
  { component: 'Gearbox/Transmission', damageLevel: 'severe', estimatedRepairCost: 2000000, valuationDeduction: 5000000, notes: 'Severe/failed - replacement gearbox from Cotonou ₦800k-2.5M. Highest deduction category' },
  
  // Suspension (per axle)
  { component: 'Suspension', damageLevel: 'minor', estimatedRepairCost: 165000, valuationDeduction: 400000, notes: 'Worn/leaking shocks - air suspension (Q7, A6, A8) replacement: ₦300k-800k per strut (OEM)' },
  { component: 'Suspension', damageLevel: 'moderate', estimatedRepairCost: 400000, valuationDeduction: 1000000, notes: 'Damaged (pothole/accident) - control arms, tie rods. Check wheel alignment' },
  
  // Interior (seats)
  { component: 'Interior Seats', damageLevel: 'moderate', estimatedRepairCost: 250000, valuationDeduction: 500000, notes: 'Torn/stained leather - Audi full leather re-trim ₦250-600k. Partial repair ₦100-200k' },
  
  // Interior (dashboard)
  { component: 'Interior Dashboard', damageLevel: 'moderate', estimatedRepairCost: 190000, valuationDeduction: 375000, notes: 'Cracked/faded - MMI screen replacement: ₦200-600k. Dashboard re-pad: ₦100-250k' },
  
  // AC System
  { component: 'AC System', damageLevel: 'moderate', estimatedRepairCost: 190000, valuationDeduction: 450000, notes: 'Not cooling - compressor: ₦150-350k. Condenser: ₦100-250k. Regas: ₦30-60k' },
  
  // Frame/Chassis
  { component: 'Frame/Chassis', damageLevel: 'severe', estimatedRepairCost: 1750000, valuationDeduction: 6500000, notes: 'Bent (accident) - major structural. Frame straightening + certification. Near total-loss for older cars' },
  
  // Mileage Tampering
  { component: 'Mileage Tampering', damageLevel: 'severe', estimatedRepairCost: 0, valuationDeduction: 3000000, notes: 'Odometer rolled back - deduct based on true mileage. Criminal offence. VIN history check recommended' },
];

// Combine all Audi valuations
const allAudiValuations = [
  ...audiA3Valuations,
  ...audiA4Valuations,
  ...audiA6Valuations,
  ...audiQ3Valuations,
  ...audiQ5Valuations,
  ...audiQ7Valuations,
];

async function importAudiData() {
  console.log('🚗 Starting Audi vehicle valuation data import...\n');

  try {
    // Step 1: Import vehicle valuations
    console.log('📊 Importing Audi vehicle valuations...');
    let importedCount = 0;
    let skippedCount = 0;

    for (const valuation of allAudiValuations) {
      try {
        // Check if record already exists
        const existing = await db
          .select()
          .from(vehicleValuations)
          .where(
            and(
              eq(vehicleValuations.make, valuation.make),
              eq(vehicleValuations.model, valuation.model),
              eq(vehicleValuations.year, valuation.year),
              eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing record
          await db
            .update(vehicleValuations)
            .set({
              mileageRange: valuation.mileageRange,
              baseValue: valuation.baseValue,
              marketValueLow: valuation.marketValueLow,
              marketValueHigh: valuation.marketValueHigh,
              source: valuation.source,
              notes: valuation.notes,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(vehicleValuations.make, valuation.make),
                eq(vehicleValuations.model, valuation.model),
                eq(vehicleValuations.year, valuation.year),
                eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
              )
            );
          skippedCount++;
        } else {
          // Insert new record
          await db.insert(vehicleValuations).values({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
            mileageRange: valuation.mileageRange,
            baseValue: valuation.baseValue,
            marketValueLow: valuation.marketValueLow,
            marketValueHigh: valuation.marketValueHigh,
            source: valuation.source,
            notes: valuation.notes,
          });
          importedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error importing ${valuation.year} ${valuation.make} ${valuation.model}:`,
          error
        );
      }
    }

    console.log(`✅ Imported ${importedCount} new Audi valuations`);
    console.log(`♻️  Updated ${skippedCount} existing Audi valuations\n`);

    // Step 2: Import Audi-specific damage deductions
    console.log('🔧 Importing Audi-specific damage deductions...');
    let deductionsImported = 0;
    let deductionsSkipped = 0;

    for (const deduction of audiDamageDeductions) {
      try {
        // Check if deduction already exists
        const existing = await db
          .select()
          .from(damageDeductions)
          .where(
            and(
              eq(damageDeductions.component, deduction.component),
              eq(damageDeductions.damageLevel, deduction.damageLevel)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing deduction
          await db
            .update(damageDeductions)
            .set({
              estimatedRepairCost: deduction.estimatedRepairCost,
              valuationDeduction: deduction.valuationDeduction,
              notes: deduction.notes,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(damageDeductions.component, deduction.component),
                eq(damageDeductions.damageLevel, deduction.damageLevel)
              )
            );
          deductionsSkipped++;
        } else {
          // Insert new deduction
          await db.insert(damageDeductions).values({
            component: deduction.component,
            damageLevel: deduction.damageLevel,
            estimatedRepairCost: deduction.estimatedRepairCost,
            valuationDeduction: deduction.valuationDeduction,
            notes: deduction.notes,
          });
          deductionsImported++;
        }
      } catch (error) {
        console.error(
          `❌ Error importing deduction for ${deduction.component} (${deduction.damageLevel}):`,
          error
        );
      }
    }

    console.log(`✅ Imported ${deductionsImported} new Audi damage deductions`);
    console.log(`♻️  Updated ${deductionsSkipped} existing damage deductions\n`);

    // Step 3: Summary
    console.log('📈 Import Summary:');
    console.log(`   Total Audi valuations processed: ${allAudiValuations.length}`);
    console.log(`   - A3: ${audiA3Valuations.length} records`);
    console.log(`   - A4: ${audiA4Valuations.length} records`);
    console.log(`   - A6: ${audiA6Valuations.length} records`);
    console.log(`   - Q3: ${audiQ3Valuations.length} records`);
    console.log(`   - Q5: ${audiQ5Valuations.length} records`);
    console.log(`   - Q7: ${audiQ7Valuations.length} records`);
    console.log(`   Total damage deductions: ${audiDamageDeductions.length}`);
    console.log('\n✅ Audi data import complete!');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the import
importAudiData()
  .then(() => {
    console.log('\n🎉 All done! Audi vehicle valuation data has been imported.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
