/**
 * Test Honda Accord with year filtering enabled
 * This should filter out 2003, 2018 models and only keep 2022
 */

import 'dotenv/config';
import { serperApi } from '@/lib/integrations/serper-api';
import { queryBuilder } from '@/features/internet-search/services/query-builder.service';
import { priceExtractor } from '@/features/internet-search/services/price-extraction.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

async function testYearFiltering() {
  console.log('🔍 TESTING YEAR FILTERING FOR HONDA ACCORD 2022\n');
  
  const vehicleItem: ItemIdentifier = {
    type: 'vehicle',
    make: 'Honda',
    model: 'Accord',
    year: 2022,
    condition: 'Foreign Used (Tokunbo)'
  };
  
  console.log('📋 Test Vehicle:', vehicleItem);
  console.log('🎯 Target Year: 2022 (±2 years tolerance)\n');
  
  // Build query and search
  const query = queryBuilder.buildMarketQuery(vehicleItem);
  console.log('🔍 Query:', query);
  
  const serperResults = await serperApi.search(query, { num: 15 });
  console.log('✅ Serper returned:', serperResults.organic?.length || 0, 'results\n');
  
  // Extract prices WITHOUT year filtering
  console.log('=' .repeat(80));
  console.log('WITHOUT YEAR FILTERING');
  console.log('='.repeat(80));
  
  const withoutFiltering = priceExtractor.extractPrices(serperResults.organic || [], 'vehicle');
  
  console.log('\nPrices extracted:', withoutFiltering.prices.length);
  console.log('Average:', withoutFiltering.averagePrice?.toLocaleString());
  console.log('Median:', withoutFiltering.medianPrice?.toLocaleString());
  
  console.log('\nAll prices:');
  withoutFiltering.prices.forEach((price, index) => {
    console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} - Year: ${price.extractedYear || 'unknown'}`);
  });
  
  // Extract prices WITH year filtering
  console.log('\n' + '='.repeat(80));
  console.log('WITH YEAR FILTERING (2022 ±2 years)');
  console.log('='.repeat(80));
  
  const withFiltering = priceExtractor.extractPrices(serperResults.organic || [], 'vehicle', 2022);
  
  console.log('\nPrices extracted:', withFiltering.prices.length);
  console.log('Average:', withFiltering.averagePrice?.toLocaleString());
  console.log('Median:', withFiltering.medianPrice?.toLocaleString());
  
  console.log('\nFiltered prices:');
  withFiltering.prices.forEach((price, index) => {
    console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} - Year: ${price.extractedYear || 'unknown'} - Matched: ${price.yearMatched}`);
  });
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const pricesRemoved = withoutFiltering.prices.length - withFiltering.prices.length;
  const avgDiff = (withFiltering.averagePrice || 0) - (withoutFiltering.averagePrice || 0);
  const medianDiff = (withFiltering.medianPrice || 0) - (withoutFiltering.medianPrice || 0);
  
  console.log(`\n📊 Prices removed by filtering: ${pricesRemoved}`);
  console.log(`📈 Average price change: ${avgDiff >= 0 ? '+' : ''}₦${avgDiff.toLocaleString()}`);
  console.log(`📈 Median price change: ${medianDiff >= 0 ? '+' : ''}₦${medianDiff.toLocaleString()}`);
  
  if (withFiltering.medianPrice && withFiltering.medianPrice >= 25000000 && withFiltering.medianPrice <= 40000000) {
    console.log('\n✅ YEAR FILTERING WORKS: Median is now in correct range (₦25-40M for 2022 tokunbo)');
  } else if (withFiltering.medianPrice && withFiltering.medianPrice < 25000000) {
    console.log('\n⚠️ STILL TOO LOW: Median is below expected range');
  } else {
    console.log('\n⚠️ NO PRICES: Year filtering removed all prices');
  }
}

testYearFiltering()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
