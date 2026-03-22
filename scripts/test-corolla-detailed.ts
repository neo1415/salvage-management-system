/**
 * Detailed test for 2020 Toyota Corolla
 * Shows results from each source individually
 */

import 'dotenv/config';
import { scrapeAllSources } from '../src/features/market-data/services/scraper.service';
import type { PropertyIdentifier } from '../src/features/market-data/types';

async function testCorollaDetailed() {
  console.log('🚗 Testing 2020 Toyota Corolla - Detailed Source Analysis\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const vehicle: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Corolla',
    year: 2020,
  };

  console.log('📊 Scraping all sources...\n');
  
  const results = await scrapeAllSources(vehicle);

  console.log('📋 Results by Source:\n');
  
  for (const result of results) {
    console.log(`\n🔍 Source: ${result.source.toUpperCase()}`);
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Duration: ${result.duration}ms`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.prices.length > 0) {
      console.log(`   Listings Found: ${result.prices.length}`);
      
      if (result.yearFilterMetadata) {
        console.log(`\n   📅 Year Filtering:`);
        console.log(`      Target Year: ${result.yearFilterMetadata.targetYear}`);
        console.log(`      Total Scraped: ${result.yearFilterMetadata.totalListings}`);
        console.log(`      Year-Matched: ${result.yearFilterMetadata.validListings}`);
        console.log(`      Rejected: ${result.yearFilterMetadata.rejectedListings}`);
        console.log(`      Match Rate: ${(result.yearFilterMetadata.yearMatchRate * 100).toFixed(1)}%`);
        
        if (result.yearFilterMetadata.rejectionReasons) {
          console.log(`\n      Rejection Reasons:`);
          for (const [reason, count] of Object.entries(result.yearFilterMetadata.rejectionReasons)) {
            console.log(`         ${reason}: ${count}`);
          }
        }
      }
      
      console.log(`\n   💰 Year-Matched Prices:`);
      const yearMatched = result.prices.filter(p => p.yearMatched);
      if (yearMatched.length > 0) {
        yearMatched.slice(0, 5).forEach((price, idx) => {
          console.log(`      ${idx + 1}. ₦${price.price.toLocaleString()} - ${price.listingTitle.substring(0, 60)}...`);
        });
        if (yearMatched.length > 5) {
          console.log(`      ... and ${yearMatched.length - 5} more`);
        }
      } else {
        console.log(`      (none)`);
      }
    } else {
      console.log(`   Listings Found: 0`);
    }
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('📊 SUMMARY\n');
  
  const successfulSources = results.filter(r => r.success);
  const totalListings = results.reduce((sum, r) => sum + r.prices.length, 0);
  const yearMatchedListings = results.reduce((sum, r) => 
    sum + r.prices.filter(p => p.yearMatched).length, 0
  );
  
  console.log(`Sources Scraped: ${results.length}`);
  console.log(`Successful: ${successfulSources.length}`);
  console.log(`Failed: ${results.length - successfulSources.length}`);
  console.log(`Total Year-Matched Listings: ${yearMatchedListings}`);
  console.log(`Minimum Required: 3`);
  console.log(`\nStatus: ${yearMatchedListings >= 3 ? '✅ SUFFICIENT DATA' : '❌ INSUFFICIENT DATA'}`);
}

testCorollaDetailed().catch(console.error);
