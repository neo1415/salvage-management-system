import { QueryBuilderService } from '../src/features/internet-search/services/query-builder.service';
import { PriceExtractionService } from '../src/features/internet-search/services/price-extraction.service';

async function testLuxuryVehicleFixes() {
  console.log('🧪 Testing Luxury Vehicle Pricing Fixes...');
  
  const queryBuilder = new QueryBuilderService();
  const priceExtractor = new PriceExtractionService();
  
  // Test 1: Query building for luxury vehicles
  console.log('\n📋 Test 1: Query Building');
  
  const lamborghini = {
    type: 'vehicle' as const,
    make: 'Lamborghini',
    model: 'Revuelto',
    year: 2023,
    condition: 'excellent'
  };
  
  const regularCar = {
    type: 'vehicle' as const,
    make: 'Toyota',
    model: 'Camry',
    year: 2023,
    condition: 'excellent'
  };
  
  const lamborghiniQuery = queryBuilder.buildMarketQuery(lamborghini);
  const regularCarQuery = queryBuilder.buildMarketQuery(regularCar);
  
  console.log('Lamborghini Query:', lamborghiniQuery);
  console.log('Regular Car Query:', regularCarQuery);
  
  // Test 2: Price validation for luxury vehicles
  console.log('\n📋 Test 2: Price Validation');
  
  const mockSearchResults = [
    {
      title: 'Lamborghini Revuelto 2023 Price in Nigeria',
      snippet: 'The new Lamborghini Revuelto costs ₦960,000 down payment',
      link: 'https://example.com/lamborghini'
    },
    {
      title: 'Lamborghini Revuelto 2023 Full Price',
      snippet: 'Brand new Lamborghini Revuelto price is ₦450 million in Nigeria',
      link: 'https://luxury-cars.com/lamborghini'
    }
  ];
  
  const extractedPrices = priceExtractor.extractPrices(mockSearchResults, 'vehicle');
  
  console.log('Extracted Prices:', JSON.stringify(extractedPrices, null, 2));
  
  console.log('\n✅ Luxury vehicle pricing fixes tested!');
}

testLuxuryVehicleFixes().catch(console.error);