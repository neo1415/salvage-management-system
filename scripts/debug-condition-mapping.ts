#!/usr/bin/env tsx

/**
 * Debug condition mapping and query building
 */

// Mock the condition mapping functions to test locally
type UniversalCondition = 
  | 'Brand New'
  | 'Foreign Used (Tokunbo)'
  | 'Nigerian Used'
  | 'Heavily Used';

const CONDITION_SEARCH_TERMS: Record<UniversalCondition, string[]> = {
  'Brand New': ['brand new', 'new', 'unused'],
  'Foreign Used (Tokunbo)': ['tokunbo', 'foreign used', 'uk used', 'us used', 'clean'],
  'Nigerian Used': ['nigerian used', 'locally used', 'naija used'],
  'Heavily Used': ['fairly used', 'old', 'used', 'cheap']
};

const QUALITY_TO_CONDITION_MAPPING: Record<string, UniversalCondition> = {
  'excellent': 'Brand New',
  'good': 'Foreign Used (Tokunbo)',
  'fair': 'Nigerian Used',
  'poor': 'Heavily Used',
  // Also support the correct condition values
  'Brand New': 'Brand New',
  'Foreign Used (Tokunbo)': 'Foreign Used (Tokunbo)',
  'Nigerian Used': 'Nigerian Used',
  'Heavily Used': 'Heavily Used'
};

function normalizeCondition(condition: string): UniversalCondition | null {
  const normalized = QUALITY_TO_CONDITION_MAPPING[condition];
  return normalized || null;
}

function buildVehicleQuery(item: any): string {
  let query = '';
  
  if (item.make) {
    query += item.make;
  }
  
  if (item.model) {
    query += ` ${item.model}`;
  }
  
  if (item.year) {
    query += ` ${item.year}`;
  }
  
  return query.trim();
}

function buildMarketQuery(item: any, options: {
  includeCondition?: boolean;
  includeLocation?: boolean;
} = {}): string {
  const { includeCondition = true, includeLocation = true } = options;
  
  let query = buildVehicleQuery(item);
  
  // Add condition terms
  if (includeCondition && item.condition) {
    const normalizedCondition = normalizeCondition(item.condition);
    console.log(`  Condition "${item.condition}" -> normalized: "${normalizedCondition}"`);
    
    if (normalizedCondition) {
      const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
      if (conditionTerms && conditionTerms.length > 0) {
        query += ` ${conditionTerms[0]}`;
        console.log(`  Added condition term: "${conditionTerms[0]}"`);
      }
    } else {
      console.log(`  ⚠️ No normalized condition found for "${item.condition}"`);
    }
  }
  
  // Add price and location terms
  query += ' price';
  
  if (includeLocation) {
    query += ' Nigeria';
  }
  
  return query;
}

async function debugConditionMapping() {
  console.log('🔍 Debugging Condition Mapping and Query Building\n');
  
  const baseVehicle = {
    type: 'vehicle',
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023
  };
  
  const testConditions = [
    'excellent',
    'good', 
    'fair',
    'poor',
    'Brand New',
    'Foreign Used (Tokunbo)',
    'Nigerian Used',
    'Heavily Used'
  ];
  
  console.log('='.repeat(80));
  console.log('CONDITION MAPPING TEST');
  console.log('='.repeat(80));
  console.log(`Base Vehicle: ${baseVehicle.make} ${baseVehicle.model} ${baseVehicle.year}\n`);
  
  for (const condition of testConditions) {
    console.log(`Testing condition: "${condition}"`);
    console.log('-'.repeat(50));
    
    const vehicleWithCondition = { ...baseVehicle, condition };
    
    // Test query building
    const query = buildMarketQuery(vehicleWithCondition);
    console.log(`  Final Query: "${query}"`);
    
    // Test normalization directly
    const normalized = normalizeCondition(condition);
    console.log(`  Direct normalization: "${condition}" -> "${normalized}"`);
    
    if (normalized) {
      const searchTerms = CONDITION_SEARCH_TERMS[normalized];
      console.log(`  Available search terms: [${searchTerms.join(', ')}]`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));
  
  console.log('\n✅ Expected Behavior:');
  console.log('- Each condition should map to different search terms');
  console.log('- Quality tiers (excellent, good, fair, poor) should map to universal conditions');
  console.log('- Universal conditions should map to themselves');
  console.log('- Each query should include condition-specific terms');
  
  console.log('\n🔍 Key Mappings:');
  console.log('- excellent -> Brand New -> "brand new"');
  console.log('- good -> Foreign Used (Tokunbo) -> "tokunbo"');
  console.log('- fair -> Nigerian Used -> "nigerian used"');
  console.log('- poor -> Heavily Used -> "fairly used"');
  
  console.log('\n🎯 Expected Queries:');
  console.log('- excellent: "Lamborghini Revuelto 2023 brand new price Nigeria"');
  console.log('- good: "Lamborghini Revuelto 2023 tokunbo price Nigeria"');
  console.log('- fair: "Lamborghini Revuelto 2023 nigerian used price Nigeria"');
  console.log('- poor: "Lamborghini Revuelto 2023 fairly used price Nigeria"');
  
  console.log('\n💡 If queries are different but prices are the same:');
  console.log('- Internet search is working correctly');
  console.log('- The issue may be in price aggregation or market data service');
  console.log('- Check if search results actually contain different prices');
}

debugConditionMapping().catch(console.error);