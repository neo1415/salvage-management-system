#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

// Let's trace exactly what happens to storageCapacity
console.log('🔍 Debugging Storage Capacity Mapping...\n');

// Test the universal item info structure
const universalItemInfo = {
  type: 'electronics' as const,
  condition: 'Brand New' as const,
  brand: 'Apple',
  model: 'iPhone 17 Pro Max',
  storageCapacity: '512GB',
  brandPrestige: 'luxury' as const
};

console.log('📱 Original Universal Item Info:');
console.log(JSON.stringify(universalItemInfo, null, 2));

// Simulate the mapping that happens in ai-assessment-enhanced.service.ts
const itemIdentifier = universalItemInfo.type === 'electronics' ? {
  type: 'electronics',
  brand: universalItemInfo.brand,
  model: universalItemInfo.model,
  storage: universalItemInfo.storageCapacity,
  condition: universalItemInfo.condition
} : {
  type: 'other' as any,
  brand: universalItemInfo.brand,
  model: universalItemInfo.model,
  year: undefined
};

console.log('\n🔄 Mapped Item Identifier:');
console.log(JSON.stringify(itemIdentifier, null, 2));

// Test the query builder
import { QueryBuilderService } from '../src/features/internet-search/services/query-builder.service';

const queryBuilder = new QueryBuilderService();
const query = queryBuilder.buildMarketQuery(itemIdentifier as any);

console.log('\n🔍 Generated Search Query:');
console.log(`"${query}"`);

// Check if storage is included
if (query.includes('512GB')) {
  console.log('✅ Storage capacity IS included in the query');
} else {
  console.log('❌ Storage capacity is NOT included in the query');
  console.log('🔍 Debugging query construction...');
  
  // Let's manually test the buildElectronicsQuery method
  const electronicsQuery = (queryBuilder as any).buildElectronicsQuery(itemIdentifier);
  console.log(`📱 Electronics query: "${electronicsQuery}"`);
  
  // Check what properties are available
  console.log('🔍 Available properties on itemIdentifier:');
  Object.keys(itemIdentifier).forEach(key => {
    console.log(`  ${key}: ${(itemIdentifier as any)[key]}`);
  });
}