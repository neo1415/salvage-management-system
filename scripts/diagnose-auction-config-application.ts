import { db } from '@/lib/db';
import { auctionConfigs } from '@/lib/db/schema/auction-deposit';
import { desc } from 'drizzle-orm';

async function diagnoseAuctionConfig() {
  console.log('🔍 AUCTION CONFIG DIAGNOSIS\n');
  
  // 1. Check current config in database
  console.log('1️⃣ Current Config in Database:');
  const configs = await db
    .select()
    .from(auctionConfigs)
    .orderBy(desc(auctionConfigs.createdAt))
    .limit(5);
  
  if (configs.length === 0) {
    console.log('❌ No configs found in database!\n');
    return;
  }
  
  const latestConfig = configs[0];
  console.log(`Latest Config (ID: ${latestConfig.id}):`);
  console.log(`  Created: ${latestConfig.createdAt}`);
  console.log(`  Active: ${latestConfig.isActive}`);
  console.log(`  Registration Fee: ₦${latestConfig.registrationFee}`);
  console.log(`  Minimum Bid Increment: ₦${latestConfig.minimumBidIncrement}`);
  console.log(`  Tier 1 Bid Limit: ${latestConfig.tier1BidLimit}`);
  console.log(`  Tier 2 Bid Limit: ${latestConfig.tier2BidLimit}`);
  console.log(`  Deposit Percentage: ${latestConfig.depositPercentage}%`);
  console.log(`  Payment Deadline Hours: ${latestConfig.paymentDeadlineHours}`);
  console.log(`  Document Deadline Hours: ${latestConfig.documentDeadlineHours}`);
  console.log('');
  
  // 2. Show all recent configs
  console.log('2️⃣ Recent Config History:');
  configs.forEach((config, index) => {
    console.log(`Config ${index + 1}:`);
    console.log(`  ID: ${config.id}`);
    console.log(`  Active: ${config.isActive}`);
    console.log(`  Min Bid Increment: ₦${config.minimumBidIncrement}`);
    console.log(`  Tier 1 Limit: ${config.tier1BidLimit}`);
    console.log(`  Created: ${config.createdAt}`);
    console.log('');
  });
  
  // 3. Check if there are multiple active configs (should only be one)
  const activeConfigs = configs.filter(c => c.isActive);
  console.log(`3️⃣ Active Configs Count: ${activeConfigs.length}`);
  if (activeConfigs.length > 1) {
    console.log('⚠️  WARNING: Multiple active configs found! This could cause issues.');
    activeConfigs.forEach((config, index) => {
      console.log(`  Active Config ${index + 1}: ${config.id} (created ${config.createdAt})`);
    });
  } else if (activeConfigs.length === 1) {
    console.log('✅ Only one active config (correct)');
  } else {
    console.log('❌ No active config found!');
  }
  console.log('');
  
  // 4. Test the config service
  console.log('4️⃣ Testing Config Service:');
  try {
    const { ConfigService } = await import('@/features/auction-deposit/services/config.service');
    const serviceConfig = await ConfigService.getActiveConfig();
    
    console.log('Config from Service:');
    console.log(`  Registration Fee: ₦${serviceConfig.registrationFee}`);
    console.log(`  Minimum Bid Increment: ₦${serviceConfig.minimumBidIncrement}`);
    console.log(`  Tier 1 Bid Limit: ${serviceConfig.tier1BidLimit}`);
    console.log(`  Tier 2 Bid Limit: ${serviceConfig.tier2BidLimit}`);
    console.log('');
    
    // Compare with database
    if (serviceConfig.minimumBidIncrement !== latestConfig.minimumBidIncrement) {
      console.log('⚠️  MISMATCH: Service config differs from database!');
      console.log(`  DB: ₦${latestConfig.minimumBidIncrement}`);
      console.log(`  Service: ₦${serviceConfig.minimumBidIncrement}`);
    } else {
      console.log('✅ Service config matches database');
    }
  } catch (error) {
    console.error('❌ Error loading config service:', error);
  }
  console.log('');
  
  // 5. Check API endpoint
  console.log('5️⃣ Testing API Endpoint:');
  try {
    const response = await fetch('http://localhost:3000/api/admin/config');
    console.log(`  Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('  API Response:');
      console.log(`    Min Bid Increment: ₦${data.minimumBidIncrement}`);
      console.log(`    Tier 1 Limit: ${data.tier1BidLimit}`);
    } else {
      console.log(`  ❌ API Error: ${response.status}`);
      const text = await response.text();
      console.log(`  Response: ${text.substring(0, 200)}`);
    }
  } catch (error: any) {
    console.log(`  ❌ Cannot reach API: ${error.message}`);
    console.log('  (This is expected if server is not running)');
  }
}

diagnoseAuctionConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
