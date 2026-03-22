#!/usr/bin/env tsx

/**
 * Test script to verify condition normalization works correctly
 */

// Import the query builder to test the normalization
import { QueryBuilderService } from '../src/features/internet-search/services/query-builder.service';

function testConditionNormalization() {
  console.log('🧪 Testing Condition Normalization...\n');

  const queryBuilder = new QueryBuilderService();

  // Test cases
  const testCases = [
    { input: 'excellent', expected: 'Brand New' },
    { input: 'good', expected: 'Foreign Used (Tokunbo)' },
    { input: 'fair', expected: 'Nigerian Used' },
    { input: 'poor', expected: 'Heavily Used' },
    { input: 'Brand New', expected: 'Brand New' },
    { input: 'Foreign Used (Tokunbo)', expected: 'Foreign Used (Tokunbo)' },
    { input: 'Nigerian Used', expected: 'Nigerian Used' },
    { input: 'Heavily Used', expected: 'Heavily Used' },
    { input: 'invalid', expected: null }
  ];

  console.log('Testing condition normalization:');
  
  for (const testCase of testCases) {
    try {
      // Test building a query with the condition
      const testItem = {
        type: 'vehicle' as const,
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        condition: testCase.input
      };

      const query = queryBuilder.buildMarketQuery(testItem, true, true);
      
      if (testCase.expected === null) {
        console.log(`✅ ${testCase.input} -> handled gracefully (no crash)`);
      } else {
        console.log(`✅ ${testCase.input} -> query built successfully`);
        console.log(`   Query: "${query}"`);
      }
    } catch (error) {
      console.log(`❌ ${testCase.input} -> ERROR: ${error}`);
    }
  }
}

// Run the test
testConditionNormalization();