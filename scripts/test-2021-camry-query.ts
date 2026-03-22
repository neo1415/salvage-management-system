/**
 * Test 2021 Toyota Camry valuation query
 * 
 * This script tests what the database returns for a 2021 Toyota Camry
 * to understand the discrepancy between user input (₦18M) and AI estimate (₦4.5M salvage)
 */

import { config } from 'dotenv';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';

config();

async function testCamry2021() {
  console.log('🔍 Testing 2021 Toyota Camry Valuation Query');
  console.log('============================================\n');
  
  try {
    // Query database for 2021 Camry
    const result = await valuationQueryService.queryValuation({
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
    });
    
    if (!result.found) {
      console.log('❌ No valuation found in database for 2021 Toyota Camry');
      console.log('\n📊 Database Status:');
      console.log('   This means the import did not include 2021 Camry data');
      return;
    }
    
    console.log('✅ Valuation found in database!');
    console.log('\n📊 Database Valuation:');
    console.log(`   Condition: ${result.valuation?.conditionCategory || 'N/A'}`);
    console.log(`   Low Price: ₦${result.valuation?.lowPrice.toLocaleString() || 'N/A'}`);
    console.log(`   High Price: ₦${result.valuation?.highPrice.toLocaleString() || 'N/A'}`);
    console.log(`   Average Price: ₦${result.valuation?.averagePrice.toLocaleString() || 'N/A'}`);
    console.log(`   Mileage Range: ${result.valuation?.mileageLow?.toLocaleString() || 'N/A'} - ${result.valuation?.mileageHigh?.toLocaleString() || 'N/A'} km`);
    console.log(`   Source: ${result.source}`);
    
    if (!result.valuation) {
      console.log('\n❌ Valuation data is missing');
      return;
    }
    
    console.log('\n🔍 Comparison with User Input:');
    console.log(`   User entered: ₦18,000,000`);
    console.log(`   Database average: ₦${result.valuation.averagePrice.toLocaleString()}`);
    
    const difference = 18000000 - result.valuation.averagePrice;
    const percentDiff = ((difference / result.valuation.averagePrice) * 100).toFixed(1);
    
    if (difference > 0) {
      console.log(`   ⚠️  User value is ₦${difference.toLocaleString()} HIGHER (${percentDiff}% more)`);
    } else {
      console.log(`   ✅ User value is within range`);
    }
    
    console.log('\n💡 AI Salvage Value Calculation:');
    console.log('   If damage is MINOR (25% salvage rate):');
    console.log(`   - From user input (₦18M): ₦${(18000000 * 0.25).toLocaleString()} salvage`);
    console.log(`   - From database (₦${result.valuation.averagePrice.toLocaleString()}): ₦${(result.valuation.averagePrice * 0.25).toLocaleString()} salvage`);
    
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
}

testCamry2021();
