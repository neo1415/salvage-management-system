import { db } from '../src/lib/db/drizzle.ts';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations.ts';
import { eq, and } from 'drizzle-orm';

async function testLexusLS460Pricing() {
  console.log('🚗 TESTING LEXUS LS460 PRICING');
  console.log('='.repeat(50));
  
  // Check all Lexus models first
  const lexusModels = await db.selectDistinct({ model: vehicleValuations.model })
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Lexus'))
    .orderBy(vehicleValuations.model);
  
  console.log('Available Lexus models:');
  lexusModels.forEach(m => console.log(`  - ${m.model}`));
  
  // Check for LS460 specifically
  const ls460Records = await db.select()
    .from(vehicleValuations)
    .where(and(
      eq(vehicleValuations.make, 'Lexus'),
      eq(vehicleValuations.model, 'LS460')
    ));
  
  console.log(`\nFound ${ls460Records.length} LS460 records:`);
  
  if (ls460Records.length > 0) {
    ls460Records.forEach(record => {
      console.log(`${record.year} Lexus LS460 (${record.conditionCategory}): ₦${record.averagePrice} (Range: ₦${record.lowPrice} - ₦${record.highPrice})`);
    });
    
    // Find the highest priced one (should be excellent condition, latest year)
    const bestCondition = ls460Records
      .filter(r => r.conditionCategory === 'excellent')
      .sort((a, b) => b.year - a.year)[0];
    
    if (bestCondition) {
      const priceInMillions = parseInt(bestCondition.averagePrice) / 1000000;
      console.log(`\n🔍 ANALYSIS:`);
      console.log(`   Best condition LS460 (${bestCondition.year} excellent): ₦${bestCondition.averagePrice}`);
      console.log(`   That's ₦${priceInMillions.toFixed(1)}M`);
      console.log(`   Internet says ₦15-33M for brand new`);
      
      if (priceInMillions < 15) {
        console.log(`   ❌ PROBLEM: Our price (₦${priceInMillions.toFixed(1)}M) is below market range (₦15-33M)`);
      } else {
        console.log(`   ✅ OK: Our price is within market range`);
      }
    }
  } else {
    console.log('❌ No LS460 records found in database');
    
    // Check what LS models we do have
    const lsModels = await db.selectDistinct({ model: vehicleValuations.model })
      .from(vehicleValuations)
      .where(and(
        eq(vehicleValuations.make, 'Lexus'),
        // Look for models containing 'LS'
      ));
    
    console.log('\nLooking for any LS models...');
    const allLexusModels = await db.selectDistinct({ model: vehicleValuations.model })
      .from(vehicleValuations)
      .where(eq(vehicleValuations.make, 'Lexus'));
    
    const lsRelated = allLexusModels.filter(m => m.model.toLowerCase().includes('ls'));
    if (lsRelated.length > 0) {
      console.log('Found LS-related models:');
      lsRelated.forEach(m => console.log(`  - ${m.model}`));
    } else {
      console.log('No LS models found at all');
    }
  }
}

testLexusLS460Pricing().catch(console.error);