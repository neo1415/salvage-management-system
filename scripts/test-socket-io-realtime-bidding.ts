/**
 * Socket.io Real-Time Bidding Test Script
 * 
 * This script tests the Socket.io real-time bidding system to ensure:
 * 1. Socket.io server initializes properly
 * 2. Clients can connect and join auction rooms
 * 3. Bid broadcasts reach all connected clients
 * 4. Auction closure broadcasts work correctly
 * 5. Polling fallback API works as expected
 * 
 * Usage:
 * 1. Start the development server: npm run dev
 * 2. Run this script: npx tsx scripts/test-socket-io-realtime-bidding.ts
 * 3. Open 2 browser windows to the same auction
 * 4. Place a bid in one window
 * 5. Verify the other window updates within 1-3 seconds
 */

import { io, Socket } from 'socket.io-client';

// Configuration
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const TEST_AUCTION_ID = process.env.TEST_AUCTION_ID || 'test-auction-123';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || 'your-jwt-token-here';

console.log('🧪 Socket.io Real-Time Bidding Test');
console.log('=====================================\n');

console.log('Configuration:');
console.log(`  - Socket URL: ${SOCKET_URL}`);
console.log(`  - Test Auction ID: ${TEST_AUCTION_ID}`);
console.log(`  - Token: ${TEST_TOKEN.substring(0, 20)}...`);
console.log('');

// Test 1: Socket.io Connection
console.log('Test 1: Socket.io Connection');
console.log('------------------------------');

const socket: Socket = io(SOCKET_URL, {
  auth: {
    token: TEST_TOKEN,
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('✅ Socket.io connected');
  console.log(`   - Socket ID: ${socket.id}`);
  console.log(`   - Transport: ${socket.io.engine.transport.name}`);
  console.log('');

  // Test 2: Join Auction Room
  console.log('Test 2: Join Auction Room');
  console.log('-------------------------');
  console.log(`   - Emitting 'auction:watch' for ${TEST_AUCTION_ID}`);
  
  socket.emit('auction:watch', { auctionId: TEST_AUCTION_ID });
  
  console.log('✅ Watch event emitted');
  console.log('   - Waiting for broadcasts...');
  console.log('');

  // Test 3: Listen for Broadcasts
  console.log('Test 3: Listen for Broadcasts');
  console.log('-----------------------------');

  socket.on('auction:new-bid', (data) => {
    console.log('✅ Received new bid broadcast:');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Bid Amount: ₦${Number(data.bid.amount).toLocaleString()}`);
    console.log(`   - Minimum Bid: ₦${Number(data.bid.minimumBid).toLocaleString()}`);
    console.log(`   - Vendor ID: ${data.bid.vendorId}`);
    console.log('');
  });

  socket.on('auction:updated', (data) => {
    console.log('✅ Received auction update:');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Status: ${data.auction.status}`);
    console.log('');
  });

  socket.on('auction:closed', (data) => {
    console.log('✅ Received auction closure:');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Winner ID: ${data.winnerId}`);
    console.log('');
  });

  socket.on('auction:watching-count', (data) => {
    console.log('✅ Received watching count update:');
    console.log(`   - Auction ID: ${data.auctionId}`);
    console.log(`   - Count: ${data.count}`);
    console.log('');
  });

  // Keep connection alive for 60 seconds to listen for broadcasts
  console.log('⏳ Listening for broadcasts for 60 seconds...');
  console.log('   - Place a bid in the browser to test');
  console.log('');

  setTimeout(() => {
    console.log('⏱️  Test timeout reached');
    console.log('   - Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 60000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.io connection error:');
  console.error(`   - Error: ${error.message}`);
  console.error('');
  console.error('Troubleshooting:');
  console.error('  1. Ensure development server is running (npm run dev)');
  console.error('  2. Check that TEST_JWT_TOKEN is valid');
  console.error('  3. Verify Socket.io server is initialized in server.ts');
  console.error('');
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.io disconnected:');
  console.log(`   - Reason: ${reason}`);
  console.log('');
});

// Test 4: Polling Fallback API
console.log('Test 4: Polling Fallback API');
console.log('----------------------------');
console.log('   - Testing polling endpoint...');
console.log('');

async function testPollingAPI() {
  try {
    const response = await fetch(`${SOCKET_URL}/api/auctions/${TEST_AUCTION_ID}/poll`, {
      headers: {
        'Cookie': `next-auth.session-token=${TEST_TOKEN}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Polling API works:');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Current Bid: ₦${data.data?.currentBid?.toLocaleString() || 'None'}`);
      console.log(`   - Auction Status: ${data.data?.status}`);
      console.log(`   - ETag: ${response.headers.get('etag')}`);
      console.log('');
    } else if (response.status === 401) {
      console.log('⚠️  Polling API requires authentication');
      console.log('   - This is expected - polling works in browser with session');
      console.log('');
    } else {
      console.error(`❌ Polling API failed: ${response.status}`);
      console.error(`   - Response: ${await response.text()}`);
      console.error('');
    }
  } catch (error) {
    console.error('❌ Polling API error:', error);
    console.error('');
  }
}

// Test polling after 2 seconds
setTimeout(testPollingAPI, 2000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  socket.disconnect();
  process.exit(0);
});
