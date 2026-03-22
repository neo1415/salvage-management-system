#!/usr/bin/env node

/**
 * Comprehensive diagnosis of the condition differentiation issue
 * 
 * This script will help identify exactly where the problem is occurring
 */

console.log('🔍 COMPREHENSIVE CONDITION DIFFERENTIATION DIAGNOSIS\n');

// Test the exact logic flow from AI assessment to market data service
function testConditionFlow() {
  console.log('='.repeat(80));
  console.log('STEP 1: AI ASSESSMENT SERVICE CONDITION PASSING');
  console.log('='.repeat(80));
  
  // This is the exact logic from ai-assessment-enhanced.service.ts
  const vehicleInfo = {
    make: 'Lamborghini',
    model: 'Revuelto', 
    year: 2023,
    mileage: 50000,
    condition: 'excellent' // This is what gets passed from the UI
  };
  
  console.log('VehicleInfo from UI:', vehicleInfo);
  
  // Step 1: Convert to PropertyIdentifier (from ai-assessment-enhanced.service.ts line 705)
  const property = {
    type: 'vehicle',
    make: vehicleInfo.make,
    model: vehicleInfo.model,
    year: vehicleInfo.year,
    mileage: vehicleInfo.mileage,
    condition: vehicleInfo.condition // Pass condition to market data service
  };
  
  console.log('PropertyIdentifier passed to getMarketPrice:', property);
  
  console.log('\n='.repeat(80));
  console.log('STEP 2: MARKET DATA SERVICE CONVERSION');
  console.log('='.repeat(80));
  
  // Step 2: Convert PropertyIdentifier to ItemIdentifier (from market-data.service.ts)
  function convertToItemIdentifier(property) {
    if (property.type === 'vehicle') {
      if (!property.make || !property.model) {
        return null;
      }
      return {
        type: 'vehicle',
        make: property.make,
        model: property.model,
        year: property.year,
        mileage: property.mileage,
        condition: property.condition // Pass through condition from PropertyIdentifier
      };
    }
    return null;
  }
  
  const itemIdentifier = convertToItemIdentifier(property);
  console.log('ItemIdentifier passed to internetSearchService:', itemIdentifier);
  
  console.log('\n='.repeat(80));
  console.log('STEP 3: INTERNET SEARCH SERVICE PROCESSING');
  console.log('='.repeat(80));
  
  // Step 3: Cache key generation (from cache-integration.service.ts)
  function normalizeItemIdentifier(item) {
    const normalized = {
      type: item.type
    };
    
    if (item.type === 'vehicle') {
      if (item.make) normalized.make = item.make.toLowerCase().trim();
      if (item.model) normalized.model = item.model.toLowerCase().trim();
      if (item.year) normalized.year = item.year;
      if (item.condition) normalized.condition = item.condition.toLowerCase().trim();
    }
    
    return normalized;
  }
  
  const normalizedForCache = normalizeItemIdentifier(itemIdentifier);
  console.log('Normalized for cache key:', normalizedForCache);
  
  // Generate cache key
  const cacheKeyData = JSON.stringify(normalizedForCache);
  console.log('Cache key data:', cacheKeyData);
  
  console.log('\n='.repeat(80));
  console.log('STEP 4: QUERY BUILDING');
  console.log('='.repeat(80));
  
  // Step 4: Query building (from query-builder.service.ts)
  const QUALITY_TO_CONDITION_MAPPING = {
    'excellent': 'Brand New',
    'good': 'Foreign Used (Tokunbo)',
    'fair': 'Nigerian Used',
    'poor': 'Heavily Used',
    'Brand New': 'Brand New',
    'Foreign Used (Tokunbo)': 'Foreign Used (Tokunbo)',
    'Nigerian Used': 'Nigerian Used',
    'Heavily Used': 'Heavily Used'
  };
  
  const CONDITION_SEARCH_TERMS = {
    'Brand New': ['brand new', 'new', 'unused'],
    'Foreign Used (Tokunbo)': ['tokunbo', 'foreign used', 'uk used', 'us used', 'clean'],
    'Nigerian Used': ['nigerian used', 'locally used', 'naija used'],
    'Heavily Used': ['fairly used', 'old', 'used', 'cheap']
  };
  
  function normalizeCondition(condition) {
    return QUALITY_TO_CONDITION_MAPPING[condition] || null;
  }
  
  function buildMarketQuery(item) {
    let query = `${item.make} ${item.model} ${item.year}`;
    
    if (item.condition) {
      const normalizedCondition = normalizeCondition(item.condition);
      console.log(`  Condition "${item.condition}" -> normalized: "${normalizedCondition}"`);
      
      if (normalizedCondition) {
        const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
        if (conditionTerms && conditionTerms.length > 0) {
          query += ` ${conditionTerms[0]}`;
          console.log(`  Added condition term: "${conditionTerms[0]}"`);
        }
      }
    }
    
    query += ' price Nigeria';
    return query;
  }
  
  const searchQuery = buildMarketQuery(itemIdentifier);
  console.log('Final search query:', searchQuery);
  
  return {
    vehicleInfo,
    property,
    itemIdentifier,
    normalizedForCache,
    cacheKeyData,
    searchQuery
  };
}

function testMultipleConditions() {
  console.log('\n='.repeat(80));
  console.log('STEP 5: TESTING ALL CONDITIONS');
  console.log('='.repeat(80));
  
  const conditions = ['excellent', 'good', 'fair', 'poor'];
  const results = [];
  
  conditions.forEach(condition => {
    console.log(`\nTesting condition: "${condition}"`);
    console.log('-'.repeat(50));
    
    // Simulate the full flow
    const vehicleInfo = {
      make: 'Lamborghini',
      model: 'Revuelto',
      year: 2023,
      mileage: 50000,
      condition: condition
    };
    
    const property = {
      type: 'vehicle',
      make: vehicleInfo.make,
      model: vehicleInfo.model,
      year: vehicleInfo.year,
      mileage: vehicleInfo.mileage,
      condition: vehicleInfo.condition
    };
    
    const itemIdentifier = {
      type: 'vehicle',
      make: property.make,
      model: property.model,
      year: property.year,
      mileage: property.mileage,
      condition: property.condition
    };
    
    const normalized = {
      type: itemIdentifier.type,
      make: itemIdentifier.make.toLowerCase().trim(),
      model: itemIdentifier.model.toLowerCase().trim(),
      year: itemIdentifier.year,
      condition: itemIdentifier.condition.toLowerCase().trim()
    };
    
    const cacheKey = JSON.stringify(normalized);
    
    // Build query
    const QUALITY_TO_CONDITION_MAPPING = {
      'excellent': 'Brand New',
      'good': 'Foreign Used (Tokunbo)',
      'fair': 'Nigerian Used',
      'poor': 'Heavily Used'
    };
    
    const CONDITION_SEARCH_TERMS = {
      'Brand New': ['brand new'],
      'Foreign Used (Tokunbo)': ['tokunbo'],
      'Nigerian Used': ['nigerian used'],
      'Heavily Used': ['fairly used']
    };
    
    const normalizedCondition = QUALITY_TO_CONDITION_MAPPING[condition];
    const conditionTerm = normalizedCondition ? CONDITION_SEARCH_TERMS[normalizedCondition][0] : '';
    const query = `${itemIdentifier.make} ${itemIdentifier.model} ${itemIdentifier.year} ${conditionTerm} price Nigeria`;
    
    results.push({
      condition,
      cacheKey,
      query,
      normalizedCondition,
      conditionTerm
    });
    
    console.log(`  Cache Key: ${cacheKey}`);
    console.log(`  Query: ${query}`);
  });
  
  console.log('\n='.repeat(80));
  console.log('CACHE KEY ANALYSIS');
  console.log('='.repeat(80));
  
  const cacheKeys = results.map(r => r.cacheKey);
  const uniqueCacheKeys = [...new Set(cacheKeys)];
  
  console.log(`Total conditions tested: ${results.length}`);
  console.log(`Unique cache keys: ${uniqueCacheKeys.length}`);
  
  if (uniqueCacheKeys.length === results.length) {
    console.log('✅ GOOD: Each condition has a unique cache key');
  } else {
    console.log('❌ PROBLEM: Some conditions share the same cache key!');
    console.log('This would cause cache collisions and same results for different conditions');
  }
  
  console.log('\n📋 Cache Keys:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.condition}: ${result.cacheKey}`);
  });
  
  console.log('\n='.repeat(80));
  console.log('QUERY ANALYSIS');
  console.log('='.repeat(80));
  
  const queries = results.map(r => r.query);
  const uniqueQueries = [...new Set(queries)];
  
  console.log(`Total queries: ${results.length}`);
  console.log(`Unique queries: ${uniqueQueries.length}`);
  
  if (uniqueQueries.length === results.length) {
    console.log('✅ GOOD: Each condition generates a unique search query');
  } else {
    console.log('❌ PROBLEM: Some conditions generate the same search query!');
  }
  
  console.log('\n📋 Search Queries:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.condition}: "${result.query}"`);
  });
  
  return results;
}

function provideDiagnosis() {
  console.log('\n='.repeat(80));
  console.log('DIAGNOSIS AND NEXT STEPS');
  console.log('='.repeat(80));
  
  console.log('\n🔍 What this test reveals:');
  console.log('1. Whether condition is being passed through the entire chain');
  console.log('2. Whether cache keys are unique for different conditions');
  console.log('3. Whether search queries are different for different conditions');
  
  console.log('\n💡 If everything looks correct here but prices are still the same:');
  console.log('1. The Serper API might be returning similar results for all queries');
  console.log('2. The specific vehicle might have limited listings in Nigeria');
  console.log('3. There might be an issue in the price extraction logic');
  console.log('4. The internet search service might have a bug not shown in this test');
  
  console.log('\n🎯 Recommended next steps:');
  console.log('1. Test with a more common vehicle (Toyota Camry 2020)');
  console.log('2. Clear all caches and test again');
  console.log('3. Check actual Serper API responses for different queries');
  console.log('4. Verify that price extraction is working correctly');
  
  console.log('\n⚠️ Known issue from context:');
  console.log('User reported: "Internet search WAS finding different condition-specific prices"');
  console.log('But: "Market data service was overriding condition-specific prices"');
  console.log('This suggests the issue might be in how market data service processes the results');
}

// Run the diagnosis
console.log('Starting comprehensive diagnosis...\n');

const singleTest = testConditionFlow();
const multipleTest = testMultipleConditions();
provideDiagnosis();

console.log('\n🏁 Diagnosis complete!');