/**
 * Verify Luxury Lexus Pricing Consistency
 * 
 * Check that other luxury Lexus models (LS500, LX570, LX600) 
 * have realistic pricing compared to the fixed LS460
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, desc } from 'drizzle-orm';

async function main() {
  console.log('🏆 VERIFYING LUXURY LEXUS PRICING CONSISTENCY');
  console.log('==================================================');
  
  const luxuryModels = ['LS460', 'LS500', 'LX570', 'LX600'];
  
  for (const model of luxuryModels) {
    console.log(`\n📊 ${model} PRICING:`);
    console.log('-'.repeat(50));
    
    // Get latest year data for each condition
    const records = await db
      .select()
      .from(vehicleValuations)
      .where(
        and(
          eq(vehicleValuations.make, 'Lexus'),
          eq(vehicleValuations.model, model)
        )
      )
      .orderBy(desc(vehicleValuations.year));
    
    if (records.length === 0) {
      console.log('   No data found');
      continue;
    }
    
    // Group by year and condition
    const yearData: Record<number, Record<string, any>> = {};
    
    for (const record of records) {
      if (!yearData[record.year]) {
        yearData[record.year] = {};
      }
      yearData[record.year][record.conditionCategory] = record;
    }
    
    // Show latest 3 years
    const years = Object.keys(yearData).map(Number).sort((a, b) => b - a).slice(0, 3);
    
    for (const year of years) {
      console.log(`   ${year}:`);
      const conditions = ['fair', 'good', 'excellent'];
      
      for (const condition of conditions) {
        const record = yearData[year][condition];
        if (record) {
          console.log(`     ${condition}: ₦${record.averagePrice.toLocaleString()}`);
        }
      }
    }
  }
  
  console.log('\n==================================================');
  console.log('🎯 PRICING ANALYSIS:');
  console.log('==================================================');
  
  // Compare 2024 excellent condition prices
  const models2024 = await db
    .select()
    .from(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Lexus'),
        eq(vehicleValuations.year, 2024),
        eq(vehicleValuations.conditionCategory, 'excellent')
      )
    );
  
  console.log('2024 EXCELLENT CONDITION COMPARISON:');
  const luxuryPrices: Array<{model: string, price: number}> = [];
  
  for (const record of models2024) {
    if (luxuryModels.includes(record.model)) {
      luxuryPrices.push({
        model: record.model,
        price: record.averagePrice
      });
      console.log(`   ${record.model}: ₦${record.averagePrice.toLocaleString()}`);
    }
  }
  
  // Sort by price
  luxuryPrices.sort((a, b) => b.price - a.price);
  
  console.log('\n🏆 LUXURY HIERARCHY (2024 excellent):');
  luxuryPrices.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.model}: ₦${item.price.toLocaleString()}`);
  });
  
  console.log('\n✅ Verification completed!');
}

main().catch(console.error);