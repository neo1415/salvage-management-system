/**
 * Direct Database Import: Toyota Nigeria Market Data
 * Bypasses API authentication by importing directly to database
 * 
 * Run: npx tsx scripts/import-toyota-direct-db.ts
 */

import { config } from 'dotenv';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';

config();

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001'; // System admin user

async function importToyotaData() {
  console.log('🚗 Toyota Nigeria Data - Direct Database Import');
  console.log('================================================\n');

  try {
    // Import Camry valuations
    console.log('📤 Importing Toyota Camry valuations...');
    const camryData = [
      // 2000-2006 (Big Daddy era)
      { year: 2000, condition: 'fair', low: 700000, high: 900000, avg: 800000, mileLow: 150000, mileHigh: 240000 },
      { year: 2000, condition: 'good', low: 1300000, high: 1700000, avg: 1500000, mileLow: 150000, mileHigh: 240000 },
      { year: 2002, condition: 'fair', low: 900000, high: 1100000, avg: 1000000, mileLow: 140000, mileHigh: 220000 },
      { year: 2002, condition: 'good', low: 1600000, high: 2000000, avg: 1800000, mileLow: 140000, mileHigh: 220000 },
      { year: 2004, condition: 'fair', low: 1000000, high: 1400000, avg: 1200000, mileLow: 120000, mileHigh: 200000 },
      { year: 2004, condition: 'good', low: 2000000, high: 2400000, avg: 2200000, mileLow: 120000, mileHigh: 200000 },
      { year: 2006, condition: 'fair', low: 1300000, high: 1700000, avg: 1500000, mileLow: 100000, mileHigh: 180000 },
      { year: 2006, condition: 'good', low: 2700000, high: 3300000, avg: 3000000, mileLow: 100000, mileHigh: 180000 },
      { year: 2006, condition: 'excellent', low: 4200000, high: 4800000, avg: 4500000, mileLow: 100000, mileHigh: 180000 },
      // 2007-2011 (Muscle era)
      { year: 2007, condition: 'fair', low: 1800000, high: 2200000, avg: 2000000, mileLow: 90000, mileHigh: 165000 },
      { year: 2007, condition: 'good', low: 3500000, high: 4100000, avg: 3800000, mileLow: 90000, mileHigh: 165000 },
      { year: 2007, condition: 'excellent', low: 5200000, high: 5800000, avg: 5500000, mileLow: 90000, mileHigh: 165000 },
      { year: 2008, condition: 'fair', low: 2300000, high: 2700000, avg: 2500000, mileLow: 85000, mileHigh: 160000 },
      { year: 2008, condition: 'good', low: 4200000, high: 4800000, avg: 4500000, mileLow: 85000, mileHigh: 160000 },
      { year: 2008, condition: 'excellent', low: 6200000, high: 6800000, avg: 6500000, mileLow: 85000, mileHigh: 160000 },
      { year: 2009, condition: 'fair', low: 2600000, high: 3000000, avg: 2800000, mileLow: 80000, mileHigh: 150000 },
      { year: 2009, condition: 'good', low: 4700000, high: 5300000, avg: 5000000, mileLow: 80000, mileHigh: 150000 },
      { year: 2009, condition: 'excellent', low: 6700000, high: 7300000, avg: 7000000, mileLow: 80000, mileHigh: 150000 },
      { year: 2010, condition: 'fair', low: 2800000, high: 3200000, avg: 3000000, mileLow: 75000, mileHigh: 140000 },
      { year: 2010, condition: 'good', low: 5200000, high: 5800000, avg: 5500000, mileLow: 75000, mileHigh: 140000 },
      { year: 2010, condition: 'excellent', low: 7700000, high: 8300000, avg: 8000000, mileLow: 75000, mileHigh: 140000 },
      { year: 2011, condition: 'fair', low: 3300000, high: 3700000, avg: 3500000, mileLow: 70000, mileHigh: 130000 },
      { year: 2011, condition: 'good', low: 5700000, high: 6300000, avg: 6000000, mileLow: 70000, mileHigh: 130000 },
      { year: 2011, condition: 'excellent', low: 8700000, high: 9300000, avg: 9000000, mileLow: 70000, mileHigh: 130000 },
      // 2012-2018 (Modern era)
      { year: 2012, condition: 'fair', low: 3800000, high: 4200000, avg: 4000000, mileLow: 60000, mileHigh: 115000 },
      { year: 2012, condition: 'good', low: 6700000, high: 7300000, avg: 7000000, mileLow: 60000, mileHigh: 115000 },
      { year: 2012, condition: 'excellent', low: 10700000, high: 11300000, avg: 11000000, mileLow: 60000, mileHigh: 115000 },
      { year: 2013, condition: 'fair', low: 4700000, high: 5300000, avg: 5000000, mileLow: 55000, mileHigh: 100000 },
      { year: 2013, condition: 'good', low: 8200000, high: 8800000, avg: 8500000, mileLow: 55000, mileHigh: 100000 },
      { year: 2013, condition: 'excellent', low: 12700000, high: 13300000, avg: 13000000, mileLow: 55000, mileHigh: 100000 },
      { year: 2014, condition: 'fair', low: 5700000, high: 6300000, avg: 6000000, mileLow: 45000, mileHigh: 90000 },
      { year: 2014, condition: 'good', low: 9700000, high: 10300000, avg: 10000000, mileLow: 45000, mileHigh: 90000 },
      { year: 2014, condition: 'excellent', low: 15700000, high: 16300000, avg: 16000000, mileLow: 45000, mileHigh: 90000 },
      { year: 2015, condition: 'fair', low: 6700000, high: 7300000, avg: 7000000, mileLow: 40000, mileHigh: 80000 },
      { year: 2015, condition: 'good', low: 11700000, high: 12300000, avg: 12000000, mileLow: 40000, mileHigh: 80000 },
      { year: 2015, condition: 'excellent', low: 19700000, high: 20300000, avg: 20000000, mileLow: 40000, mileHigh: 80000 },
      { year: 2016, condition: 'fair', low: 7700000, high: 8300000, avg: 8000000, mileLow: 35000, mileHigh: 70000 },
      { year: 2016, condition: 'good', low: 13700000, high: 14300000, avg: 14000000, mileLow: 35000, mileHigh: 70000 },
      { year: 2016, condition: 'excellent', low: 21700000, high: 22300000, avg: 22000000, mileLow: 35000, mileHigh: 70000 },
      { year: 2017, condition: 'fair', low: 8700000, high: 9300000, avg: 9000000, mileLow: 30000, mileHigh: 65000 },
      { year: 2017, condition: 'good', low: 14700000, high: 15300000, avg: 15000000, mileLow: 30000, mileHigh: 65000 },
      { year: 2017, condition: 'excellent', low: 24700000, high: 25300000, avg: 25000000, mileLow: 30000, mileHigh: 65000 },
      { year: 2018, condition: 'fair', low: 10700000, high: 11300000, avg: 11000000, mileLow: 25000, mileHigh: 55000 },
      { year: 2018, condition: 'good', low: 17700000, high: 18300000, avg: 18000000, mileLow: 25000, mileHigh: 55000 },
      { year: 2018, condition: 'excellent', low: 27700000, high: 28300000, avg: 28000000, mileLow: 25000, mileHigh: 55000 },
      // 2019-2025 (Latest)
      { year: 2019, condition: 'fair', low: 12700000, high: 13300000, avg: 13000000, mileLow: 20000, mileHigh: 45000 },
      { year: 2019, condition: 'good', low: 19700000, high: 20300000, avg: 20000000, mileLow: 20000, mileHigh: 45000 },
      { year: 2019, condition: 'excellent', low: 31700000, high: 32300000, avg: 32000000, mileLow: 20000, mileHigh: 45000 },
      { year: 2020, condition: 'fair', low: 14700000, high: 15300000, avg: 15000000, mileLow: 15000, mileHigh: 40000 },
      { year: 2020, condition: 'good', low: 22700000, high: 23300000, avg: 23000000, mileLow: 15000, mileHigh: 40000 },
      { year: 2020, condition: 'excellent', low: 34700000, high: 35300000, avg: 35000000, mileLow: 15000, mileHigh: 40000 },
      { year: 2021, condition: 'fair', low: 17700000, high: 18300000, avg: 18000000, mileLow: 10000, mileHigh: 35000 },
      { year: 2021, condition: 'good', low: 25700000, high: 26300000, avg: 26000000, mileLow: 10000, mileHigh: 35000 },
      { year: 2021, condition: 'excellent', low: 39700000, high: 40300000, avg: 40000000, mileLow: 10000, mileHigh: 35000 },
      { year: 2022, condition: 'fair', low: 19700000, high: 20300000, avg: 20000000, mileLow: 5000, mileHigh: 30000 },
      { year: 2022, condition: 'good', low: 29700000, high: 30300000, avg: 30000000, mileLow: 5000, mileHigh: 30000 },
      { year: 2022, condition: 'excellent', low: 44700000, high: 45300000, avg: 45000000, mileLow: 5000, mileHigh: 30000 },
      { year: 2023, condition: 'good', low: 34700000, high: 35300000, avg: 35000000, mileLow: 0, mileHigh: 25000 },
      { year: 2023, condition: 'excellent', low: 49700000, high: 50300000, avg: 50000000, mileLow: 0, mileHigh: 25000 },
      { year: 2024, condition: 'good', low: 39700000, high: 40300000, avg: 40000000, mileLow: 0, mileHigh: 20000 },
      { year: 2024, condition: 'excellent', low: 54700000, high: 55300000, avg: 55000000, mileLow: 0, mileHigh: 20000 },
      { year: 2025, condition: 'excellent', low: 59700000, high: 60300000, avg: 60000000, mileLow: 0, mileHigh: 15000 },
    ];

    let camryCount = 0;
    for (const data of camryData) {
      try {
        await db.insert(vehicleValuations).values({
          make: 'Toyota',
          model: 'Camry',
          year: data.year,
          conditionCategory: data.condition as 'fair' | 'good' | 'excellent',
          lowPrice: data.low.toString(),
          highPrice: data.high.toString(),
          averagePrice: data.avg.toString(),
          mileageLow: data.mileLow,
          mileageHigh: data.mileHigh,
          dataSource: 'Jiji.ng, Carlots.ng, Cars45.com',
          createdBy: ADMIN_USER_ID,
        });
        camryCount++;
      } catch (error: any) {
        // Skip if already exists
        if (error?.cause?.code === '23505') {
          console.log(`   Skipping existing: ${data.year} ${data.condition}`);
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Imported ${camryCount} new Camry valuations\n`);

    // Import damage deductions
    console.log('📤 Importing damage deductions...');
    const deductionsData = [
      // Minor cosmetic (0.5-2% deduction)
      { type: 'minor_scratch', repair: 50000, percent: 0.01, desc: 'Minor surface scratch' },
      { type: 'minor_dent', repair: 80000, percent: 0.015, desc: 'Small dent without paint damage' },
      { type: 'paint_fade', repair: 120000, percent: 0.02, desc: 'Paint fading or discoloration' },
      // Moderate (2-5% deduction)
      { type: 'bumper_damage', repair: 150000, percent: 0.03, desc: 'Bumper crack or damage' },
      { type: 'door_dent', repair: 200000, percent: 0.04, desc: 'Door panel dent' },
      { type: 'windshield_crack', repair: 180000, percent: 0.035, desc: 'Windshield crack or chip' },
      { type: 'headlight_damage', repair: 100000, percent: 0.02, desc: 'Headlight broken or cracked' },
      { type: 'taillight_damage', repair: 80000, percent: 0.015, desc: 'Taillight broken or cracked' },
      // Significant (5-10% deduction)
      { type: 'fender_damage', repair: 350000, percent: 0.07, desc: 'Fender damage or replacement needed' },
      { type: 'hood_damage', repair: 400000, percent: 0.08, desc: 'Hood dent or damage' },
      { type: 'side_mirror_damage', repair: 120000, percent: 0.025, desc: 'Side mirror broken' },
      { type: 'wheel_rim_damage', repair: 150000, percent: 0.03, desc: 'Wheel rim bent or damaged' },
      // Major (10-20% deduction)
      { type: 'engine_issue', repair: 800000, percent: 0.15, desc: 'Engine problems or failure' },
      { type: 'transmission_issue', repair: 600000, percent: 0.12, desc: 'Transmission problems' },
      { type: 'suspension_damage', repair: 400000, percent: 0.08, desc: 'Suspension system damage' },
      { type: 'electrical_system', repair: 350000, percent: 0.07, desc: 'Electrical system issues' },
      // Structural (20-40% deduction)
      { type: 'frame_damage', repair: 1500000, percent: 0.30, desc: 'Frame or chassis damage' },
      { type: 'roof_damage', repair: 800000, percent: 0.16, desc: 'Roof panel damage' },
      { type: 'floor_pan_rust', repair: 500000, percent: 0.10, desc: 'Floor pan rust or corrosion' },
      // Interior (2-5% deduction)
      { type: 'seat_damage', repair: 150000, percent: 0.03, desc: 'Seat tears or damage' },
      { type: 'dashboard_crack', repair: 200000, percent: 0.04, desc: 'Dashboard cracks' },
      { type: 'ac_not_working', repair: 250000, percent: 0.05, desc: 'Air conditioning not functional' },
    ];

    let deductionCount = 0;
    for (const ded of deductionsData) {
      try {
        await db.insert(damageDeductions).values({
          component: ded.type,
          damageLevel: ded.repair < 200000 ? 'minor' : ded.repair < 500000 ? 'moderate' : 'severe',
          repairCostEstimate: ded.repair.toString(),
          valuationDeductionPercent: ded.percent.toString(),
          description: ded.desc,
          createdBy: ADMIN_USER_ID,
        });
        deductionCount++;
      } catch (error: any) {
        // Skip if already exists
        if (error?.cause?.code === '23505') {
          console.log(`   Skipping existing: ${ded.type}`);
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Imported ${deductionCount} new damage deductions\n`);

    console.log('🎉 Import complete!');
    console.log(`   Total: ${camryCount + deductionCount} records`);
    console.log('   Ready for AI assessment integration');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importToyotaData();
