/**
 * Test Script: Socket.io Broadcast Fix Verification
 * 
 * This script verifies that the Socket.io broadcast fix allows multiple vendors
 * watching the same auction to receive bid updates.
 * 
 * Test Scenario:
 * 1. Vendor A and Vendor B both watch auction a46c4199-da09-4946-9ad2-42df791c50e2
 * 2. Vendor A places a bid
 * 3. Verify Vendor B receives the bid update event
 * 
 * Expected Results:
 * - Both vendors should see "📡 Received new bid event" in console
 * - Both vendors should see the updated bid amount
 * - UI should update without refresh
 */

import { io, Socket } from 'socket.io-client';

const AUCTION_ID = 'a46c4199-da09-4946-9ad2-42df791c50e2';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

// Mock JWT tokens (replace with real tokens for testing)
const VENDOR_A_TOKEN = 'VENDOR_A_JWT_TOKEN_HERE';
const VENDOR_B_TOKEN = 'VENDOR_B_JWT_TOKEN_HERE';

interface BidEvent {
  auctionId: string;
  bid: {
    id: string;
    amount: string;
    vendorId: string;
    createdAt: string;
  };
}

async function testSocketBroadcast() {
  console.log('🧪 Testing Socket.io Broadcast Fix\n');
  console.log(`Auction ID: ${AUCTION_ID}`);
  console.log(`Socket URL: ${SOCKET_URL}\n`);

  // Create two socket connections (simulating two vendors)
  console.log('📡 Creating socket connections...\n');

  const vendorASocket: Socket = io(SOCKET_URL, {
    auth: { token: VENDOR_A_TOKEN },
    transports: ['websocket', 'polling'],
  });

  const vendorBSocket: Socket = io(SOCKET_URL, {
    auth: { token: VENDOR_B_TOKEN },
    transports: ['websocket', 'polling'],
  });

  // Track events received
  let vendorAReceivedBid = false;
  let vendorBReceivedBid = false;

  // Vendor A connection
  vendorASocket.on('connect', () => {
    console.log('✅ Vendor A connected');
    console.log(`   - Socket ID: ${vendorASocket.id}\n`);

    // Join auction room
    vendorASocket.emit('auction:watch', { auctionId: AUCTION_ID });
    console.log(`👁️  Vendor A watching auction ${AUCTION_ID}\n`);
  });

  vendorASocket.on('auction:new-bid', (data: BidEvent) => {
    console.log('📡 Vendor A received new bid event!');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Bid ID: ${data.bid.id}`);
    console.log(`   - Amount: ₦${Number(data.bid.amount).toLocaleString()}`);
    console.log(`   - Vendor ID: ${data.bid.vendorId}\n`);
    vendorAReceivedBid = true;
  });

  // Vendor B connection
  vendorBSocket.on('connect', () => {
    console.log('✅ Vendor B connected');
    console.log(`   - Socket ID: ${vendorBSocket.id}\n`);

    // Join auction room
    vendorBSocket.emit('auction:watch', { auctionId: AUCTION_ID });
    console.log(`👁️  Vendor B watching auction ${AUCTION_ID}\n`);
  });

  vendorBSocket.on('auction:new-bid', (data: BidEvent) => {
    console.log('📡 Vendor B received new bid event!');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Bid ID: ${data.bid.id}`);
    console.log(`   - Amount: ₦${Number(data.bid.amount).toLocaleString()}`);
    console.log(`   - Vendor ID: ${data.bid.vendorId}\n`);
    vendorBReceivedBid = true;
  });

  // Error handlers
  vendorASocket.on('connect_error', (error) => {
    console.error('❌ Vendor A connection error:', error.message);
  });

  vendorBSocket.on('connect_error', (error) => {
    console.error('❌ Vendor B connection error:', error.message);
  });

  // Wait for connections to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('⏳ Waiting for bid placement...');
  console.log('   Please place a bid on the auction through the UI\n');

  // Wait for 60 seconds to allow manual bid placement
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Check results
  console.log('\n📊 Test Results:');
  console.log('─────────────────────────────────────');
  console.log(`Vendor A received bid: ${vendorAReceivedBid ? '✅ YES' : '❌ NO'}`);
  console.log(`Vendor B received bid: ${vendorBReceivedBid ? '✅ YES' : '❌ NO'}`);
  console.log('─────────────────────────────────────\n');

  if (vendorAReceivedBid && vendorBReceivedBid) {
    console.log('✅ TEST PASSED: Both vendors received bid updates!');
    console.log('   The Socket.io broadcast fix is working correctly.\n');
  } else {
    console.log('❌ TEST FAILED: Not all vendors received bid updates');
    console.log('   Please check the following:');
    console.log('   1. Are both vendors in the same auction room?');
    console.log('   2. Is the Socket.io server broadcasting correctly?');
    console.log('   3. Are the event handlers set up correctly?\n');
  }

  // Cleanup
  vendorASocket.disconnect();
  vendorBSocket.disconnect();
  process.exit(0);
}

// Run test
testSocketBroadcast().catch((error) => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
