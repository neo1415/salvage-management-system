/**
 * Check Market Data in Database
 * 
 * This script checks what market data has been scraped and cached
 */

import { db } from '../src/lib/db/drizzle';
import { marketDataCache, marketDataSources, scrapingLogs } from '../src/lib/db/schema/market-data';
import { desc } from 'drizzle-orm';

async function checkMarketData() {
  console.log('🔍 Checking Market Data System...\n');
  
  // Check cache entries
  console.log('📦 CACHED MARKET DATA:');
  console.log('='.repeat(80));
  
  const cacheEntries = await db
    .select()
    .from(marketDataCache)
    .orderBy(desc(marketDataCache.scrapedAt))
    .limit(10);
  
  if (cacheEntries.length === 0) {
    console.log('❌ No cached market data found\n');
  } else {
    for (const entry of cacheEntries) {
      console.log(`\n🚗 ${entry.propertyType.toUpperCase()}`);
      console.log(`   Details: ${JSON.stringify(entry.propertyDetails)}`);
      console.log(`   Median Price: ₦${parseFloat(entry.medianPrice).toLocaleString()}`);
      console.log(`   Min: ₦${parseFloat(entry.minPrice).toLocaleString()}`);
      console.log(`   Max: ₦${parseFloat(entry.maxPrice).toLocaleString()}`);
      console.log(`   Sources: ${entry.sourceCount}`);
      console.log(`   Scraped: ${entry.scrapedAt.toLocaleString()}`);
      console.log(`   Stale At: ${entry.staleAt.toLocaleString()}`);
      console.log(`   Is Stale: ${new Date() > entry.staleAt ? 'YES' : 'NO'}`);
      
      // Get sources for this cache entry
      const sources = await db
        .select()
        .from(marketDataSources)
        .where(eq(marketDataSources.cacheId, entry.id));
      
      if (sources.length > 0) {
        console.log(`   \n   📊 Sources:`);
        for (const source of sources) {
          console.log(`      - ${source.sourceName}: ₦${parseFloat(source.price).toLocaleString()}`);
          console.log(`        ${source.listingTitle}`);
          console.log(`        ${source.listingUrl}`);
        }
      }
    }
  }
  
  // Check scraping logs
  console.log('\n\n📝 RECENT SCRAPING LOGS:');
  console.log('='.repeat(80));
  
  const logs = await db
    .select()
    .from(scrapingLogs)
    .orderBy(desc(scrapingLogs.createdAt))
    .limit(20);
  
  if (logs.length === 0) {
    console.log('❌ No scraping logs found\n');
  } else {
    for (const log of logs) {
      const statusEmoji = log.status === 'success' ? '✅' : 
                         log.status === 'failed' ? '❌' : 
                         log.status === 'timeout' ? '⏱️' : '🔄';
      
      console.log(`\n${statusEmoji} ${log.status.toUpperCase()}`);
      console.log(`   Source: ${log.sourceName}`);
      console.log(`   Property Hash: ${log.propertyHash.substring(0, 16)}...`);
      console.log(`   Prices Found: ${log.pricesFound}`);
      console.log(`   Duration: ${log.durationMs}ms`);
      if (log.errorMessage) {
        console.log(`   Error: ${log.errorMessage}`);
      }
      console.log(`   Time: ${log.createdAt.toLocaleString()}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Cache Entries: ${cacheEntries.length}`);
  console.log(`   Total Scraping Logs: ${logs.length}`);
  
  const successLogs = logs.filter(l => l.status === 'success');
  const failedLogs = logs.filter(l => l.status === 'failed');
  console.log(`   Successful Scrapes: ${successLogs.length}`);
  console.log(`   Failed Scrapes: ${failedLogs.length}`);
  
  if (successLogs.length > 0) {
    const totalPrices = successLogs.reduce((sum, log) => sum + log.pricesFound, 0);
    console.log(`   Total Prices Scraped: ${totalPrices}`);
  }
}

// Import eq function
import { eq } from 'drizzle-orm';

checkMarketData()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
