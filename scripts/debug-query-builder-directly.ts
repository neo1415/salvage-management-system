#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { QueryBuilderService } from '../src/features/internet-search/services/query-builder.service';

async function debugQueryBuilderDirectly() {
  console.log('🔍 Testing Query Builder Directly...\n');

  const queryBuilder = new QueryBuilderService();

  const testItems = [
    {
      name: 'iPhone 17 Pro Max 128GB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '128GB',
        condition: 'Brand New' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 512GB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '512GB',
        condition: 'Brand New' as const
      }
    },
    {
      name: 'iPhone 17 Pro Max 1TB',
      item: {
        type: 'electronics' as const,
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        storage: '1TB',
        condition: 'Brand New' as const
      }
    }
  ];

  console.log('📱 Testing Query Generation:');
  console.log('=' .repeat(50));

  testItems.forEach(testItem => {
    console.log(`\n${testItem.name}:`);
    console.log(`Input item:`, JSON.stringify(testItem.item, null, 2));
    
    const query = queryBuilder.buildMarketQuery(testItem.item);
    console.log(`Generated query: "${query}"`);
    
    // Test the electronics query specifically
    const electronicsQuery = (queryBuilder as any).buildElectronicsQuery(testItem.item);
    console.log(`Electronics query part: "${electronicsQuery}"`);
  });

  // Check if queries are unique
  const queries = testItems.map(testItem => queryBuilder.buildMarketQuery(testItem.item));
  const uniqueQueries = [...new Set(queries)];
  
  console.log('\n🔍 ANALYSIS:');
  console.log('=' .repeat(30));
  console.log(`Total queries: ${queries.length}`);
  console.log(`Unique queries: ${uniqueQueries.length}`);
  
  if (uniqueQueries.length === queries.length) {
    console.log('✅ All queries are unique - Query Builder is working correctly');
  } else {
    console.log('❌ Some queries are identical - Query Builder has an issue');
    console.log('\nGenerated queries:');
    queries.forEach((query, index) => {
      console.log(`  ${index + 1}. "${query}"`);
    });
  }
}

debugQueryBuilderDirectly().catch(console.error);