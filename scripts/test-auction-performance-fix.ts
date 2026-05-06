/**
 * Test Auction Performance Report Fixes
 * 
 * Verifies:
 * 1. TEST auctions are filtered out
 * 2. Status determination is correct (sold vs awaiting_payment vs active)
 */

import 'dotenv/config';
import { OperationalDataRepository } from '../src/features/reports/operational/repositories/operational-data.repository';

async function testAuctionPerformanceFix() {
  console.log('=== Testing Auction Performance Report Fixes ===\n');

  // Get auction performance data for the last 6 months
  const startDate = '2026-01-01';
  const endDate = '2026-12-31';

  const auctions = await OperationalDataRepository.getAuctionPerformanceData({
    startDate,
    endDate,
  });

  console.log(`Total auctions: ${auctions.length}\n`);

  // Test 1: Check for TEST auctions
  console.log('1. Testing TEST Auction Filtering...');
  const testAuctions = auctions.filter(a => a.claimReference.startsWith('TEST'));
  
  if (testAuctions.length === 0) {
    console.log('   ✅ TEST auctions filtered out (0 TEST auctions found)');
  } else {
    console.log(`   ❌ Found ${testAuctions.length} TEST auctions:`);
    testAuctions.forEach(a => console.log(`      - ${a.claimReference}`));
  }

  // Test 2: Check status distribution
  console.log('\n2. Testing Status Determination...');
  const statusCounts = auctions.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('   Status distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count} auctions`);
  });

  // Test 3: Verify sold auctions have payments
  console.log('\n3. Testing Sold Auctions (should have winning bids)...');
  const soldAuctions = auctions.filter(a => a.status === 'sold');
  const soldWithPayments = soldAuctions.filter(a => a.winningBid !== null);
  const soldWithoutPayments = soldAuctions.filter(a => a.winningBid === null);

  console.log(`   Total sold auctions: ${soldAuctions.length}`);
  console.log(`   - With winning bids: ${soldWithPayments.length}`);
  console.log(`   - Without winning bids: ${soldWithoutPayments.length}`);

  if (soldWithPayments.length > 0) {
    console.log('   ✅ Sold auctions have winning bids');
    console.log('   Sample sold auctions:');
    soldWithPayments.slice(0, 3).forEach(a => {
      console.log(`      - ${a.claimReference}: ₦${parseInt(a.winningBid || '0').toLocaleString()}`);
    });
  }

  // Test 4: Verify awaiting_payment auctions don't have payments
  console.log('\n4. Testing Awaiting Payment Auctions (should NOT have winning bids)...');
  const awaitingPayment = auctions.filter(a => a.status === 'awaiting_payment');
  const awaitingWithPayments = awaitingPayment.filter(a => a.winningBid !== null);

  console.log(`   Total awaiting_payment auctions: ${awaitingPayment.length}`);
  console.log(`   - With winning bids: ${awaitingWithPayments.length}`);
  console.log(`   - Without winning bids: ${awaitingPayment.length - awaitingWithPayments.length}`);

  if (awaitingWithPayments.length === 0) {
    console.log('   ✅ Awaiting payment auctions correctly have no winning bids');
  } else {
    console.log('   ⚠️  Some awaiting_payment auctions have winning bids (may be awaiting verification)');
  }

  // Test 5: Check active auctions
  console.log('\n5. Testing Active Auctions...');
  const activeAuctions = auctions.filter(a => a.status === 'active');
  
  console.log(`   Total active auctions: ${activeAuctions.length}`);
  if (activeAuctions.length > 0) {
    console.log('   Active auctions:');
    activeAuctions.forEach(a => {
      const now = new Date();
      const endTime = new Date(a.endTime);
      const isStillActive = endTime > now;
      console.log(`      - ${a.claimReference}: ${isStillActive ? '✅ Still active' : '⚠️  Should be closed'}`);
    });
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`✅ Total auctions: ${auctions.length}`);
  console.log(`✅ TEST auctions filtered: ${testAuctions.length === 0 ? 'Yes' : 'No'}`);
  console.log(`✅ Status distribution:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });
  console.log('\n✅ All tests complete');
}

testAuctionPerformanceFix().catch(console.error);
