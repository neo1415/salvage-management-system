/**
 * Test script for Internet Search Service
 */

import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Set the API key explicitly if needed
if (!process.env.SERPER_API_KEY) {
  process.env.SERPER_API_KEY = 'deaf9e2d081861f916db5db41e7c0001de699881';
}

import { internetSearchService } from '@/features/internet-search/services/internet-search.service';

async function testInternetSearchService() {
  console.log('🔍 Testing Internet Search Service...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResult = await internetSearchService.healthCheck();
    console.log('Health Status:', healthResult.status);
    console.log('API Status:', healthResult.apiStatus);
    console.log('Response Time:', healthResult.responseTime, 'ms');
    if (healthResult.error) {
      console.log('Error:', healthResult.error);
    }
    console.log('');

    // Test 2: Vehicle Market Price Search
    console.log('2. Testing vehicle market price search...');
    const vehicleResult = await internetSearchService.searchMarketPrice({
      item: {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        condition: 'Foreign Used (Tokunbo)'
      },
      maxResults: 5,
      timeout: 5000
    });

    console.log('Search Success:', vehicleResult.success);
    console.log('Query Used:', vehicleResult.query);
    console.log('Results Processed:', vehicleResult.resultsProcessed);
    console.log('Execution Time:', vehicleResult.executionTime, 'ms');
    console.log('Prices Found:', vehicleResult.priceData.prices.length);
    
    if (vehicleResult.priceData.prices.length > 0) {
      console.log('Average Price:', vehicleResult.priceData.averagePrice?.toLocaleString(), 'NGN');
      console.log('Price Range:', 
        vehicleResult.priceData.priceRange?.min.toLocaleString(), 
        '-', 
        vehicleResult.priceData.priceRange?.max.toLocaleString(), 
        'NGN'
      );
      console.log('Confidence:', vehicleResult.priceData.confidence + '%');
    }
    
    if (vehicleResult.error) {
      console.log('Error:', vehicleResult.error);
    }
    console.log('');

    // Test 3: Electronics Market Price Search
    console.log('3. Testing electronics market price search...');
    const electronicsResult = await internetSearchService.searchMarketPrice({
      item: {
        type: 'electronics',
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        condition: 'Foreign Used (Tokunbo)'
      },
      maxResults: 5,
      timeout: 5000
    });

    console.log('Search Success:', electronicsResult.success);
    console.log('Query Used:', electronicsResult.query);
    console.log('Results Processed:', electronicsResult.resultsProcessed);
    console.log('Prices Found:', electronicsResult.priceData.prices.length);
    
    if (electronicsResult.priceData.prices.length > 0) {
      console.log('Average Price:', electronicsResult.priceData.averagePrice?.toLocaleString(), 'NGN');
      console.log('Confidence:', electronicsResult.priceData.confidence + '%');
    }
    
    if (electronicsResult.error) {
      console.log('Error:', electronicsResult.error);
    }
    console.log('');

    // Test 4: Part Price Search
    console.log('4. Testing part price search...');
    const partResult = await internetSearchService.searchPartPrice({
      item: {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        condition: 'Foreign Used (Tokunbo)'
      },
      partName: 'windshield',
      damageType: 'glass',
      maxResults: 3,
      timeout: 5000
    });

    console.log('Part Search Success:', partResult.success);
    console.log('Part Name:', partResult.partName);
    console.log('Query Used:', partResult.query);
    console.log('Results Processed:', partResult.resultsProcessed);
    console.log('Prices Found:', partResult.priceData.prices.length);
    
    if (partResult.priceData.prices.length > 0) {
      console.log('Average Price:', partResult.priceData.averagePrice?.toLocaleString(), 'NGN');
      console.log('Confidence:', partResult.priceData.confidence + '%');
    }
    
    if (partResult.error) {
      console.log('Error:', partResult.error);
    }
    console.log('');

    // Test 5: Aggregated Market Price
    console.log('5. Testing aggregated market price...');
    const aggregatedResult = await internetSearchService.getAggregatedMarketPrice(
      {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        condition: 'Foreign Used (Tokunbo)'
      },
      { 
        maxResults: 3, 
        timeout: 5000,
        includePartPrices: true 
      }
    );

    console.log('Market Search Success:', aggregatedResult.marketPrice.success);
    console.log('Market Query:', aggregatedResult.marketPrice.query);
    console.log('Market Prices Found:', aggregatedResult.marketPrice.priceData.prices.length);
    console.log('Part Searches:', aggregatedResult.partPrices?.length || 0);
    console.log('Aggregated Confidence:', aggregatedResult.aggregatedConfidence + '%');
    console.log('Recommended Price:', aggregatedResult.recommendedPrice?.toLocaleString(), 'NGN');
    console.log('');

    console.log('✅ Internet Search Service test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testInternetSearchService();