/**
 * Import Audi Vehicle Valuation Data (FIXED VERSION)
 * Matches the actual database schema
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq, and } from 'drizzle-orm';

async function getSystemUserId(): Promise<string> {
  const result = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);
  
  if (result.length === 0) {
    throw new Error('No system_admin user found. Please create a system admin user first.');
  }
  
  return result[0].id;
}

// Helper to parse mileage range
function parseMileageRange(range: string): { low: number; high: number } {
  const match = range.match(/(\d+)k?-(\d+)k?\s*km/i);
  if (!match) return { low: 0, high: 0 };
  return {
    low: parseInt(match[1]) * 1000,
    high: parseInt(match[2]) * 1000,
  };
}

const audiData = [
  // A3 Models
  { make: 'Audi', model: 'A3', year: 2000, conditionCategory: 'fair', mileageRange: '150k-230k km', lowPrice: 600000, highPrice: 1000000, averagePrice: 800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '1st gen hatchback, 1.8T engine, high maintenance cost' },
  { make: 'Audi', model: 'A3', year: 2003, conditionCategory: 'fair', mileageRange: '130k-210k km', lowPrice: 800000, highPrice: 1400000, averagePrice: 1100000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Sportback variant, 2.0 TDI diesel, Belgium-grade available' },
  { make: 'Audi', model: 'A3', year: 2005, conditionCategory: 'good', mileageRange: '110k-190k km', lowPrice: 1000000, highPrice: 1800000, averagePrice: 1400000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '2nd gen (8P), 2.0T TFSI petrol, turbocharged' },
  { make: 'Audi', model: 'A3', year: 2007, conditionCategory: 'good', mileageRange: '100k-175k km', lowPrice: 1100000, highPrice: 2000000, averagePrice: 1600000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Sportback 5-door, DSG gearbox common' },
  { make: 'Audi', model: 'A3', year: 2009, conditionCategory: 'good', mileageRange: '85k-155k km', lowPrice: 1300000, highPrice: 2400000, averagePrice: 1900000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Facelifted 8P, LED DRLs, panoramic roof option' },
  { make: 'Audi', model: 'A3', year: 2012, conditionCategory: 'good', mileageRange: '70k-130k km', lowPrice: 2000000, highPrice: 3500000, averagePrice: 2800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '3rd gen (8V), lighter, sedan variant introduced' },
  { make: 'Audi', model: 'A3', year: 2014, conditionCategory: 'excellent', mileageRange: '55k-110k km', lowPrice: 2500000, highPrice: 4500000, averagePrice: 3500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Sedan variant popular, Belgium grade' },
  { make: 'Audi', model: 'A3', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-85k km', lowPrice: 3500000, highPrice: 6000000, averagePrice: 4800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Facelifted 8V, virtual cockpit optional' },
  { make: 'Audi', model: 'A3', year: 2018, conditionCategory: 'excellent', mileageRange: '30k-65k km', lowPrice: 4500000, highPrice: 8000000, averagePrice: 6300000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Pre-update 8V, 1.4 TFSI fuel-efficient' },
  { make: 'Audi', model: 'A3', year: 2020, conditionCategory: 'excellent', mileageRange: '15k-45k km', lowPrice: 11000000, highPrice: 18000000, averagePrice: 14500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '4th gen (8Y), fully digital cabin, limited supply' },
  { make: 'Audi', model: 'A3', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', lowPrice: 16000000, highPrice: 24000000, averagePrice: 20000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Almost new tokunbo, 35TFSI standard' },
  { make: 'Audi', model: 'A3', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', lowPrice: 22000000, highPrice: 32000000, averagePrice: 27000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Latest A3, limited dealer availability' },
  
  // A4 Models (most widely traded)
  { make: 'Audi', model: 'A4', year: 2000, conditionCategory: 'fair', mileageRange: '160k-260k km', lowPrice: 500000, highPrice: 900000, averagePrice: 700000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B5 gen, very old, good for spare parts' },
  { make: 'Audi', model: 'A4', year: 2002, conditionCategory: 'fair', mileageRange: '140k-240k km', lowPrice: 600000, highPrice: 1100000, averagePrice: 850000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B6 gen, Quattro AWD rarer, 1.8T petrol' },
  { make: 'Audi', model: 'A4', year: 2004, conditionCategory: 'fair', mileageRange: '130k-220k km', lowPrice: 700000, highPrice: 1300000, averagePrice: 1000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B6 facelifted, 2.0 TDI diesel available' },
  { make: 'Audi', model: 'A4', year: 2006, conditionCategory: 'good', mileageRange: '110k-200k km', lowPrice: 900000, highPrice: 1700000, averagePrice: 1300000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B7 gen, 2.0T TFSI, Belgium grade exists' },
  { make: 'Audi', model: 'A4', year: 2008, conditionCategory: 'good', mileageRange: '100k-180k km', lowPrice: 1200000, highPrice: 2200000, averagePrice: 1700000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B8 gen (major redesign), 2.0 TFSI, DSG smoother' },
  { make: 'Audi', model: 'A4', year: 2010, conditionCategory: 'good', mileageRange: '85k-160k km', lowPrice: 1500000, highPrice: 2800000, averagePrice: 2100000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B8 facelift, Quattro versions available' },
  { make: 'Audi', model: 'A4', year: 2012, conditionCategory: 'good', mileageRange: '70k-140k km', lowPrice: 2000000, highPrice: 3800000, averagePrice: 2900000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B8, clean Belgium-grade' },
  { make: 'Audi', model: 'A4', year: 2014, conditionCategory: 'excellent', mileageRange: '55k-110k km', lowPrice: 2800000, highPrice: 5000000, averagePrice: 3900000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B8 last year, high demand, fullest option' },
  { make: 'Audi', model: 'A4', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-90k km', lowPrice: 4000000, highPrice: 7000000, averagePrice: 5500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B9 gen (major redesign), virtual cockpit standard' },
  { make: 'Audi', model: 'A4', year: 2018, conditionCategory: 'excellent', mileageRange: '25k-65k km', lowPrice: 5500000, highPrice: 9500000, averagePrice: 7500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'B9 facelift, 2.0T 248hp, clean Tokunbo' },
  { make: 'Audi', model: 'A4', year: 2020, conditionCategory: 'excellent', mileageRange: '10k-40k km', lowPrice: 17000000, highPrice: 26000000, averagePrice: 21500000, source: 'Jiji.ng, NigerianPrice.com Feb 2026', notes: 'B9 updated, 12.3in virtual cockpit pro' },
  { make: 'Audi', model: 'A4', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', lowPrice: 25000000, highPrice: 38000000, averagePrice: 31500000, source: 'Jiji.ng, ccarprice.com Feb 2026', notes: 'New A4 TFSI, brand new ₦55.8M' },
  { make: 'Audi', model: 'A4', year: 2024, conditionCategory: 'excellent', mileageRange: '0-10k km', lowPrice: 35000000, highPrice: 50000000, averagePrice: 42500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'A4/A5 rebadge transition, ultra-rare, grey market' },
  
  // A6 Models (executive flagship)
  { make: 'Audi', model: 'A6', year: 2000, conditionCategory: 'fair', mileageRange: '160k-270k km', lowPrice: 500000, highPrice: 900000, averagePrice: 700000, source: 'Jiji.ng, Zimcompass.com Feb 2026', notes: 'C5 gen, 2.4/2.8/3.0 V6, very old' },
  { make: 'Audi', model: 'A6', year: 2004, conditionCategory: 'fair', mileageRange: '120k-220k km', lowPrice: 700000, highPrice: 1300000, averagePrice: 1000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'C6 gen (new platform), 2.0T, 3.2 FSI' },
  { make: 'Audi', model: 'A6', year: 2008, conditionCategory: 'good', mileageRange: '95k-175k km', lowPrice: 1200000, highPrice: 2500000, averagePrice: 1900000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'C6 updated, 2.8 FSI, 3.0 TDI, 4-plug engine' },
  { make: 'Audi', model: 'A6', year: 2012, conditionCategory: 'good', mileageRange: '65k-130k km', lowPrice: 2500000, highPrice: 5000000, averagePrice: 3800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'C7 gen, 3.0 TFSI supercharged, extremely clean' },
  { make: 'Audi', model: 'A6', year: 2016, conditionCategory: 'excellent', mileageRange: '35k-80k km', lowPrice: 5000000, highPrice: 9000000, averagePrice: 7000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'C7 facelifted, LED matrix lights' },
  { make: 'Audi', model: 'A6', year: 2020, conditionCategory: 'excellent', mileageRange: '10k-35k km', lowPrice: 25000000, highPrice: 38000000, averagePrice: 31500000, source: 'Jiji.ng, NigerianPrice.com Feb 2026', notes: 'C8, 3.0T TFSI' },
  
  // Q3 Models (compact luxury SUV)
  { make: 'Audi', model: 'Q3', year: 2012, conditionCategory: 'good', mileageRange: '70k-130k km', lowPrice: 2000000, highPrice: 4000000, averagePrice: 3000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '1st gen (8U), 2.0T TFSI Quattro, limited Nigeria supply' },
  { make: 'Audi', model: 'Q3', year: 2016, conditionCategory: 'excellent', mileageRange: '40k-80k km', lowPrice: 3500000, highPrice: 6500000, averagePrice: 5000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Updated 8U, good entry-level Audi SUV' },
  { make: 'Audi', model: 'Q3', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', lowPrice: 20000000, highPrice: 30000000, averagePrice: 25000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'F3 updated, RS Q3 variant, grey market' },
  
  // Q5 Models (mid-size luxury SUV - sweet spot)
  { make: 'Audi', model: 'Q5', year: 2009, conditionCategory: 'good', mileageRange: '100k-180k km', lowPrice: 1500000, highPrice: 2800000, averagePrice: 2100000, source: 'Jiji.ng, NigerianPrice.com Feb 2026', notes: '1st gen (8R), 2.0T TFSI Quattro, V6 3.2 FSI' },
  { make: 'Audi', model: 'Q5', year: 2013, conditionCategory: 'good', mileageRange: '70k-140k km', lowPrice: 2500000, highPrice: 4800000, averagePrice: 3600000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '1st gen final, Premium Plus trim, 3.0 TDI diesel' },
  { make: 'Audi', model: 'Q5', year: 2017, conditionCategory: 'excellent', mileageRange: '35k-80k km', lowPrice: 5000000, highPrice: 8500000, averagePrice: 6800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '2nd gen (FY), completely redesigned, lighter' },
  { make: 'Audi', model: 'Q5', year: 2021, conditionCategory: 'excellent', mileageRange: '10k-35k km', lowPrice: 22000000, highPrice: 33000000, averagePrice: 27500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Sportback variant (coupe-SUV), very desirable' },
  
  // Q7 Models (full-size luxury SUV - most recognized)
  { make: 'Audi', model: 'Q7', year: 2007, conditionCategory: 'good', mileageRange: '120k-220k km', lowPrice: 1500000, highPrice: 3000000, averagePrice: 2300000, source: 'Jiji.ng, Zimcompass.com Feb 2026', notes: '1st gen (4L), 3.6 V6 FSI, 7-seater, 280hp' },
  { make: 'Audi', model: 'Q7', year: 2011, conditionCategory: 'good', mileageRange: '85k-165k km', lowPrice: 2500000, highPrice: 5000000, averagePrice: 3800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '4L facelift, LED headlights, MMI 3G' },
  { make: 'Audi', model: 'Q7', year: 2014, conditionCategory: 'excellent', mileageRange: '60k-120k km', lowPrice: 4000000, highPrice: 7500000, averagePrice: 5800000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Peak 1st gen supply, black on black leather, 67 Jiji ads' },
  { make: 'Audi', model: 'Q7', year: 2018, conditionCategory: 'excellent', mileageRange: '25k-65k km', lowPrice: 8000000, highPrice: 14000000, averagePrice: 11000000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: '4M premium, top grade fully loaded' },
  { make: 'Audi', model: 'Q7', year: 2022, conditionCategory: 'excellent', mileageRange: '5k-20k km', lowPrice: 38000000, highPrice: 55000000, averagePrice: 46500000, source: 'Jiji.ng, Carlots.ng Feb 2026', notes: 'Very limited, 3.0T 340hp, TFSI e plug-in hybrid' },
];

async function importAudiData() {
  console.log('🚗 Starting Audi vehicle valuation data import...\n');

  try {
    const systemUserId = await getSystemUserId();
    console.log(`✅ Found system user: ${systemUserId}\n`);

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const record of audiData) {
      try {
        const mileage = parseMileageRange(record.mileageRange);
        
        // Check if record exists
        const existing = await db
          .select()
          .from(vehicleValuations)
          .where(
            and(
              eq(vehicleValuations.make, record.make),
              eq(vehicleValuations.model, record.model),
              eq(vehicleValuations.year, record.year),
              eq(vehicleValuations.conditionCategory, record.conditionCategory)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(vehicleValuations)
            .set({
              lowPrice: record.lowPrice.toString(),
              highPrice: record.highPrice.toString(),
              averagePrice: record.averagePrice.toString(),
              mileageLow: mileage.low,
              mileageHigh: mileage.high,
              marketNotes: record.notes,
              dataSource: record.source,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(vehicleValuations.make, record.make),
                eq(vehicleValuations.model, record.model),
                eq(vehicleValuations.year, record.year),
                eq(vehicleValuations.conditionCategory, record.conditionCategory)
              )
            );
          updatedCount++;
        } else {
          // Insert new
          await db.insert(vehicleValuations).values({
            make: record.make,
            model: record.model,
            year: record.year,
            conditionCategory: record.conditionCategory,
            lowPrice: record.lowPrice.toString(),
            highPrice: record.highPrice.toString(),
            averagePrice: record.averagePrice.toString(),
            mileageLow: mileage.low,
            mileageHigh: mileage.high,
            marketNotes: record.notes,
            dataSource: record.source,
            createdBy: systemUserId,
          });
          importedCount++;
        }
      } catch (error) {
        console.error(`❌ Error importing ${record.year} ${record.make} ${record.model}:`, error);
        errorCount++;
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`   ✅ Imported: ${importedCount} new records`);
    console.log(`   ♻️  Updated: ${updatedCount} existing records`);
    console.log(`   ❌ Errors: ${errorCount} records`);
    console.log(`   📊 Total processed: ${audiData.length} records`);
    console.log('\n✅ Audi data import complete!');
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  }
}

importAudiData()
  .then(() => {
    console.log('\n🎉 All done! Audi vehicle valuation data has been imported.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
