/**
 * Test Query Builder with Real Examples
 */

import 'dotenv/config';
import { queryBuilder, type VehicleIdentifier, type ElectronicsIdentifier, type PartIdentifier } from '@/features/internet-search/services/query-builder.service';

async function testQueryBuilder() {
  console.log('🔧 Testing Query Builder Service...\n');

  // Test 1: Vehicle Query
  console.log('1. Vehicle Query Examples:');
  const vehicle: VehicleIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    condition: 'Foreign Used (Tokunbo)'
  };

  const vehicleQuery = queryBuilder.buildMarketQuery(vehicle);
  console.log(`   Basic: ${vehicleQuery}`);

  const vehicleVariations = queryBuilder.generateQueryVariations(vehicle, 3);
  console.log('   Variations:');
  vehicleVariations.forEach((query, index) => {
    console.log(`     ${index + 1}. ${query}`);
  });

  // Test 2: Electronics Query
  console.log('\n2. Electronics Query Examples:');
  const electronics: ElectronicsIdentifier = {
    type: 'electronics',
    brand: 'iPhone',
    model: '13 Pro',
    storage: '256GB',
    condition: 'Brand New'
  };

  const electronicsQuery = queryBuilder.buildMarketQuery(electronics);
  console.log(`   Basic: ${electronicsQuery}`);

  // Test 3: Part Query
  console.log('\n3. Part Query Examples:');
  const part: PartIdentifier = {
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    vehicleYear: 2021,
    partName: 'bumper',
    partType: 'body',
    damageLevel: 'moderate'
  };

  const partQuery = queryBuilder.buildPartQuery(part);
  console.log(`   Basic: ${partQuery}`);

  const partQueryNoYear = queryBuilder.buildPartQuery(part, { includeYear: false });
  console.log(`   No Year: ${partQueryNoYear}`);

  // Test 4: Condition Variations
  console.log('\n4. Condition Variations:');
  const conditionVariations = queryBuilder.buildConditionQuery('Toyota Camry 2021', 'Nigerian Used');
  conditionVariations.forEach((query, index) => {
    console.log(`   ${index + 1}. ${query}`);
  });

  // Test 5: Localization
  console.log('\n5. Localization Examples:');
  const baseQuery = 'iPhone 13 price';
  const nigerianQuery = queryBuilder.localizeQuery(baseQuery, 'nigeria');
  const globalQuery = queryBuilder.localizeQuery(baseQuery, 'global');
  console.log(`   Nigerian: ${nigerianQuery}`);
  console.log(`   Global: ${globalQuery}`);

  console.log('\n✅ Query Builder testing complete!');
}

testQueryBuilder().catch(console.error);