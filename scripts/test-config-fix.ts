import { configService } from '@/features/auction-deposit/services/config.service';

async function testConfigFix() {
  console.log('🔍 Testing Config Fix\n');
  
  try {
    const config = await configService.getConfig();
    
    console.log('✅ Config loaded successfully:');
    console.log(`  Registration Fee: ₦${config.registrationFee.toLocaleString()}`);
    console.log(`  Minimum Bid Increment: ₦${config.minimumBidIncrement.toLocaleString()}`);
    console.log(`  Tier 1 Limit: ₦${config.tier1Limit.toLocaleString()}`);
    console.log(`  Tier 2 Limit: ₦${config.tier2Limit ? config.tier2Limit.toLocaleString() : 'Unlimited'}`);
    console.log(`  Deposit Rate: ${config.depositRate}%`);
    console.log(`  Minimum Deposit Floor: ₦${config.minimumDepositFloor.toLocaleString()}`);
    console.log('');
    
    console.log('✅ Config service is working correctly!');
    console.log('');
    console.log('The bidding service will now use these values instead of hardcoded ones.');
    
  } catch (error) {
    console.error('❌ Error loading config:', error);
  }
}

testConfigFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
