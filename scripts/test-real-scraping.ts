/**
 * Test Real Web Scraping
 * 
 * This script tests if we can actually scrape real Nigerian e-commerce sites
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testJijiScraping() {
  console.log('🔍 Testing Jiji.ng scraping with actual selectors...\n');
  
  try {
    // Try to scrape a real Jiji.ng search for Toyota Camry
    const url = 'https://jiji.ng/cars/toyota-camry';
    
    console.log(`Fetching: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    console.log(`✅ Response received: ${response.status}`);
    console.log(`Content length: ${response.data.length} bytes\n`);
    
    // Parse HTML
    const $ = cheerio.load(response.data);
    
    // Test the actual selectors from our scraper config
    console.log('🔎 Testing actual scraper selectors...\n');
    
    const containerSelector = '.qa-advert-list-item';
    const priceSelector = '.qa-advert-price';
    const titleSelector = '.qa-advert-title';
    const linkSelector = 'a';
    
    const containers = $(containerSelector);
    console.log(`✅ Found ${containers.length} listings with container selector: ${containerSelector}\n`);
    
    if (containers.length === 0) {
      console.error('❌ No listings found! Selectors may be wrong.');
      return;
    }
    
    // Extract data from first 5 listings
    console.log('📋 Extracting data from first 5 listings:\n');
    
    containers.slice(0, 5).each((i, element) => {
      const $element = $(element);
      
      // Extract price
      const priceText = $element.find(priceSelector).first().text().trim();
      
      // Extract title
      const title = $element.find(titleSelector).first().text().trim();
      
      // Extract URL
      let listingUrl = $element.find(linkSelector).first().attr('href') || '';
      if (listingUrl && !listingUrl.startsWith('http')) {
        listingUrl = `https://jiji.ng${listingUrl.startsWith('/') ? '' : '/'}${listingUrl}`;
      }
      
      console.log(`Listing ${i + 1}:`);
      console.log(`  Title: ${title}`);
      console.log(`  Price: ${priceText}`);
      console.log(`  URL: ${listingUrl}`);
      console.log('');
    });
    
    // Test price parsing
    console.log('💰 Testing price parsing...\n');
    
    const testPrices = [
      '₦ 9,900,000',
      '₦ 12,600,000',
      '₦ 10,500,000',
    ];
    
    testPrices.forEach(priceText => {
      const cleaned = priceText
        .replace(/₦|NGN|N/gi, '')
        .replace(/,/g, '')
        .trim();
      
      const match = cleaned.match(/[\d.]+/);
      const price = match ? parseFloat(match[0]) : null;
      
      console.log(`  "${priceText}" → ${price ? `₦${price.toLocaleString()}` : 'FAILED'}`);
    });
    
    console.log('\n✅ Scraping test successful!');
    console.log('The selectors are working correctly.');
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('❌ Axios error:', error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers:`, error.response.headers);
      }
    } else {
      console.error('❌ Error:', error);
    }
  }
}

testJijiScraping()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
