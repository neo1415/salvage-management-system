#!/usr/bin/env node

/**
 * Debug internet search condition-specific results
 * Tests if internet search actually returns different prices for different conditions
 */

console.log('🔍 Debugging Internet Search Condition Results\n');

// Mock the internet search to see what should happen
interface MockPrice {
  price: number;
  url: string;
  title: string;
}

interface MockSearchResult {
  priceData: {
    prices: MockPrice[];
    averagePrice: number;
    confidence: number;
    currency: string;
    extractedAt: Date;
  };
  success: boolean;
}

// Simulate what internet search SHOULD return for different conditions
function simulateInternetSearch(condition: string): MockSearchResult {
  const basePrice = 1000000; // 1M Naira base
  
  // Different conditions should return different price ranges
  let priceMultiplier: number;
  let priceVariation: number;
  
  switch (condition) {
    case 'Brand New':
      priceMultiplier = 1.2; // +20% for brand new
      priceVariation = 0.05; // ±5% variation
      break;
    case 'Foreign Used (Tokunbo)':
      priceMultiplier = 1.0; // Base price for tokunbo
      priceVariation = 0.1; // ±10% variation
      break;
    case 'Nigerian Used':
      priceMultiplier = 0.8; // -20% for local used
      priceVariation = 0.15; // ±15% variation
      break;
    case 'Heavily Used':
      priceMultiplier = 0.6; // -40% for heavily used
      priceVariation = 0.2; // ±20% variation
      break;
    default:
      priceMultiplier = 1.0;
      priceVariation = 0.1;
  }
  
  const centerPrice = basePrice * priceMultiplier;
  
  // Generate 5 mock prices with variation
  const prices: MockPrice[] = [];
  for (let i = 0; i < 5; i++) {
    const variation = (Math.random() - 0.5) * 2 * priceVariation;
    const price = Math.round(centerPrice * (1 + variation));
    
    prices.push({
      price,
      url: `https://example.com/listing-${i}`,
      title: `Lamborghini Revuelto 2023 ${condition} - Listing ${i + 1}`
    });
  }
  
  const averagePrice = Math.round(prices.reduce((sum, p) => sum + p.price, 0) / prices.length);
  
  return {
    priceData: {
      prices,
      averagePrice,
      confidence: 85,
      currency: 'NGN',
      extractedAt: new Date()
    },
    success: true
  };
}

// Test the market data service logic with mock data
function processMarketDataServiceLogic(searchResult: MockSearchResult): {
  median: number;
  min: number;
  max: number;
  count: number;
} {
  // This is the exact logic from market-data.service.ts
  const prices = searchResult.priceData.prices;
  const conditionSpecificPrice = searchResult.priceData.averagePrice;
  
  // For condition-specific searches, use the search service's average
  // This preserves the condition differentiation from search queries
  const median = conditionSpecificPrice;
  const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
  const min = Math.min(...sortedPrices);
  const max = Math.max(...sortedPrices);
  
  return {
    median,
    min,
    max,
    count: prices.length
  };
}

async function debugInternetSearchConditions() {
  const conditions = [
    'Brand New',
    'Foreign Used (Tokunbo)',
    'Nigerian Used', 
    'Heavily Used'
  ];
  
  console.log('='.repeat(80));
  console.log('SIMULATED INTERNET SEARCH RESULTS');
  console.log('='.repeat(80));
  console.log('Vehicle: Lamborghini Revuelto 2023\n');
  
  const results = [];
  
  for (const condition of conditions) {
    console.log(`Condition: ${condition}`);
    console.log('-'.repeat(50));
    
    // Simulate internet search
    const searchResult = simulateInternetSearch(condition);
    
    console.log('Internet Search Results:');
    searchResult.priceData.prices.forEach((price, index) => {
      console.log(`  ${index + 1}. ₦${price.price.toLocaleString()} - ${price.title}`);
    });
    
    console.log(`Average Price: ₦${searchResult.priceData.averagePrice.toLocaleString()}`);
    console.log(`Confidence: ${searchResult.priceData.confidence}%`);
    
    // Process through market data service logic
    const marketResult = processMarketDataServiceLogic(searchResult);
    
    console.log('\nMarket Data Service Output:');
    console.log(`  Median (used as final price): ₦${marketResult.median.toLocaleString()}`);
    console.log(`  Min: ₦${marketResult.min.toLocaleString()}`);
    console.log(`  Max: ₦${marketResult.max.toLocaleString()}`);
    console.log(`  Count: ${marketResult.count}`);
    
    results.push({
      condition,
      averagePrice: searchResult.priceData.averagePrice,
      finalPrice: marketResult.median,
      priceRange: `₦${marketResult.min.toLocaleString()} - ₦${marketResult.max.toLocaleString()}`
    });
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('CONDITION DIFFERENTIATION ANALYSIS');
  console.log('='.repeat(80));
  
  console.log('\n📊 Final Prices by Condition:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.condition}: ₦${result.finalPrice.toLocaleString()}`);
  });
  
  // Calculate price differentiation
  const prices = results.map(r => r.finalPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = ((maxPrice - minPrice) / minPrice) * 100;
  
  console.log('\n📈 Differentiation Metrics:');
  console.log(`Lowest Price: ₦${minPrice.toLocaleString()}`);
  console.log(`Highest Price: ₦${maxPrice.toLocaleString()}`);
  console.log(`Price Range: ${priceRange.toFixed(1)}%`);
  
  if (priceRange >= 20) {
    console.log('✅ EXCELLENT: Strong price differentiation');
  } else if (priceRange >= 10) {
    console.log('✅ GOOD: Meaningful price differentiation');
  } else if (priceRange >= 5) {
    console.log('⚠️ WEAK: Some price differentiation');
  } else {
    console.log('❌ POOR: No meaningful price differentiation');
  }
  
  console.log('\n='.repeat(80));
  console.log('DIAGNOSIS');
  console.log('='.repeat(80));
  
  console.log('\n🔍 What this test shows:');
  console.log('- If internet search returns different prices for different conditions');
  console.log('- If market data service preserves those differences');
  console.log('- Expected behavior vs actual behavior');
  
  console.log('\n💡 If real results differ from this simulation:');
  console.log('1. Internet search may not be finding condition-specific results');
  console.log('2. Caching may be returning same results for all conditions');
  console.log('3. The specific vehicle (Lamborghini Revuelto) may have limited listings');
  console.log('4. Search queries may not be differentiated enough');
  
  console.log('\n🎯 Next steps:');
  console.log('- Test with a more common vehicle (Toyota Camry)');
  console.log('- Check if cache is being cleared between condition tests');
  console.log('- Verify actual search queries being sent to Serper API');
  console.log('- Check if Serper API returns different results for different queries');
}

debugInternetSearchConditions().catch(console.error);