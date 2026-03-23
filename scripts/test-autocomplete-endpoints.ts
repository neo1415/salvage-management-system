/**
 * Test autocomplete endpoints directly
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

async function testEndpoints() {
  console.log('🧪 Testing Autocomplete Endpoints\n');
  console.log('='.repeat(80));

  try {
    // Test 1: Get all makes
    console.log('\n📊 TEST 1: Get All Makes');
    console.log('-'.repeat(80));
    
    const makes = await db
      .selectDistinct({ make: vehicleValuations.make })
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make);
    
    console.log(`Found ${makes.length} makes:`);
    makes.forEach((m, i) => {
      console.log(`  ${i + 1}. "${m.make}"`);
    });

    // Test 2: Get models for each make
    console.log('\n\n📊 TEST 2: Get Models for Each Make');
    console.log('-'.repeat(80));
    
    for (const makeRow of makes) {
      const makeName = makeRow.make;
      
      const models = await db
        .selectDistinct({ model: vehicleValuations.model })
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, makeName))
        .orderBy(vehicleValuations.model);
      
      console.log(`\n${makeName}: ${models.length} models`);
      if (models.length > 0) {
        console.log(`  First 3: ${models.slice(0, 3).map(m => m.model).join(', ')}`);
      } else {
        console.log(`  ⚠️ NO MODELS FOUND!`);
      }
    }

    // Test 3: Test specific makes that aren't working
    console.log('\n\n📊 TEST 3: Test Specific Makes (Audi, Hyundai, Kia)');
    console.log('-'.repeat(80));
    
    const testMakes = ['Audi', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Nissan'];
    
    for (const testMake of testMakes) {
      console.log(`\n${testMake}:`);
      
      // Test exact match
      const exactModels = await db
        .selectDistinct({ model: vehicleValuations.model })
        .from(vehicleValuations)
        .where(eq(vehicleValuations.make, testMake))
        .orderBy(vehicleValuations.model);
      
      console.log(`  Exact match: ${exactModels.length} models`);
      if (exactModels.length > 0) {
        console.log(`  Sample: ${exactModels.slice(0, 3).map(m => m.model).join(', ')}`);
      }
      
      // Also check years for first model
      if (exactModels.length > 0) {
        const firstModel = exactModels[0].model;
        const years = await db
          .selectDistinct({ year: vehicleValuations.year })
          .from(vehicleValuations)
          .where(eq(vehicleValuations.make, testMake))
          .where(eq(vehicleValuations.model, firstModel))
          .orderBy(vehicleValuations.year);
        
        console.log(`  Years for ${firstModel}: ${years.length} years`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testEndpoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
