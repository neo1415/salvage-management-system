/**
 * Test the condition fix for 2021 Camry valuation
 */

import { config } from 'dotenv';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';

config();

async function testConditionFix() {
  console.log('🔍 Testing Condition Fix for 2021 Camry\n');
  console.log('=' .repeat(60));
  
  // Test 1: Query without condition (should return first match)
  console.log('\n📊 TEST 1: Query WITHOUT condition');
  console.log('-'.repeat(60));
  const result1 = await valuationQueryService.queryValuation({
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
  });
  
  if (result1.found && result1.valuation) {
    console.log(`✅ Found: ${result1.valuation.conditionCategory}`);
    console.log(`   Average Price: ₦${result1.valuation.averagePrice.toLocaleString()}`);
  }
  
  // Test 2: Query with "good" condition
  console.log('\n📊 TEST 2: Query WITH condition="good"');
  console.log('-'.repeat(60));
  const result2 = await valuationQueryService.queryValuation({
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    conditionCategory: 'good',
  });
  
  if (result2.found && result2.valuation) {
    console.log(`✅ Found: ${result2.valuation.conditionCategory}`);
    console.log(`   Average Price: ₦${result2.valuation.averagePrice.toLocaleString()}`);
    
    if (result2.valuation.averagePrice === 26000000) {
      console.log('   ✅ CORRECT! Got ₦26M for "good" condition');
    } else {
      console.log('   ❌ WRONG! Expected ₦26M');
    }
  }
  
  // Test 3: Query with "excellent" condition
  console.log('\n📊 TEST 3: Query WITH condition="excellent"');
  console.log('-'.repeat(60));
  const result3 = await valuationQueryService.queryValuation({
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    conditionCategory: 'excellent',
  });
  
  if (result3.found && result3.valuation) {
    console.log(`✅ Found: ${result3.valuation.conditionCategory}`);
    console.log(`   Average Price: ₦${result3.valuation.averagePrice.toLocaleString()}`);
    
    if (result3.valuation.averagePrice === 40000000) {
      console.log('   ✅ CORRECT! Got ₦40M for "excellent" condition');
    } else {
      console.log('   ❌ WRONG! Expected ₦40M');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete');
  process.exit(0);
}

testConditionFix().catch(console.error);
