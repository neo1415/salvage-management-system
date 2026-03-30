/**
 * Test Socket.io Event Flow
 * 
 * This script tests the complete Socket.io event flow:
 * 1. Server emits 'auction:new-bid' event
 * 2. Client receives 'auction:new-bid' event
 * 3. Verify event data matches
 * 
 * Run: npx tsx scripts/test-socket-event-flow.ts
 */

import { io, Socket } from 'socket.io-client';

// Test configuration
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const TEST_AUCTION_ID = 'b67579f1-5cc4-4b91-a8c9-d491db359033';

// Mock JWT token (replace with real token for testing)
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || 'your-jwt-token-here';

interface TestResult {
  step: string;
  status: 'success' | 'failed' | 'pending';
  message: string;
  timestamp: Date;
}

const results: TestResult[] = [];

function logResult(step: string, status: 'success' | 'failed' | 'pending', message: string) {
  const result: TestResult = {
    step,
    status,
    message,
    timestamp: new Date(),
  };
  results.push(result);
  
  const emoji = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
  console.log(`${emoji} [${step}] ${message}`);
}

async function testSocketEventFlow() {
  console.log('🧪 Testing Socket.io Event Flow\n');
  console.log(`Socket URL: ${SOCKET_URL}`);
  console.log(`Test Auction ID: ${TEST_AUCTION_ID}\n`);

  // Step 1: Connect to Socket.io
  logResult('CONNECT', 'pending', 'Connecting to Socket.io server...');
  
  const socket: Socket = io(SOCKET_URL, {
    auth: {
      token: TEST_TOKEN,
    },
    transports: ['websocket', 'polling'],
    reconnection: false,
  });

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout after 10 seconds'));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      logResult('CONNECT', 'success', `Connected with socket ID: ${socket.id}`);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      logResult('CONNECT', 'failed', `Connection error: ${error.message}`);
      reject(error);
    });
  });

  // Step 2: Join auction room
  logResult('JOIN_ROOM', 'pending', `Joining auction room: auction:${TEST_AUCTION_ID}`);
  
  socket.emit('auction:watch', { auctionId: TEST_AUCTION_ID });
  
  // Wait a bit for room join to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  logResult('JOIN_ROOM', 'success', 'Joined auction room');

  // Step 3: Register event listener
  logResult('REGISTER_LISTENER', 'pending', 'Registering listener for auction:new-bid');
  
  let eventReceived = false;
  let receivedData: any = null;

  socket.on('auction:new-bid', (data) => {
    eventReceived = true;
    receivedData = data;
    logResult('RECEIVE_EVENT', 'success', `Received auction:new-bid event!`);
    console.log('   Event data:', JSON.stringify(data, null, 2));
  });

  logResult('REGISTER_LISTENER', 'success', 'Listener registered');

  // Step 4: Wait for events (or timeout after 30 seconds)
  logResult('WAIT_FOR_EVENT', 'pending', 'Waiting for auction:new-bid event (30 seconds)...');
  console.log('   💡 Place a bid on the auction to trigger the event');
  
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (!eventReceived) {
        logResult('WAIT_FOR_EVENT', 'failed', 'No event received within 30 seconds');
      }
      resolve();
    }, 30000);

    // Check every second if event was received
    const checkInterval = setInterval(() => {
      if (eventReceived) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        logResult('WAIT_FOR_EVENT', 'success', 'Event received!');
        resolve();
      }
    }, 1000);
  });

  // Step 5: Verify event data
  if (eventReceived && receivedData) {
    logResult('VERIFY_DATA', 'pending', 'Verifying event data...');
    
    const hasAuctionId = receivedData.auctionId === TEST_AUCTION_ID;
    const hasBidData = receivedData.bid && typeof receivedData.bid === 'object';
    const hasBidAmount = receivedData.bid?.amount !== undefined;
    const hasVendorId = receivedData.bid?.vendorId !== undefined;
    
    if (hasAuctionId && hasBidData && hasBidAmount && hasVendorId) {
      logResult('VERIFY_DATA', 'success', 'Event data is valid');
      console.log('   ✓ Auction ID matches');
      console.log('   ✓ Bid data present');
      console.log('   ✓ Bid amount present');
      console.log('   ✓ Vendor ID present');
    } else {
      logResult('VERIFY_DATA', 'failed', 'Event data is invalid');
      if (!hasAuctionId) console.log('   ✗ Auction ID mismatch');
      if (!hasBidData) console.log('   ✗ Bid data missing');
      if (!hasBidAmount) console.log('   ✗ Bid amount missing');
      if (!hasVendorId) console.log('   ✗ Vendor ID missing');
    }
  }

  // Step 6: Disconnect
  logResult('DISCONNECT', 'pending', 'Disconnecting...');
  socket.disconnect();
  logResult('DISCONNECT', 'success', 'Disconnected');

  // Print summary
  console.log('\n📊 Test Summary\n');
  console.log('═'.repeat(60));
  
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;
  
  console.log(`Total Steps: ${results.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`⏳ Pending: ${pendingCount}`);
  console.log('═'.repeat(60));

  if (failedCount === 0 && eventReceived) {
    console.log('\n🎉 All tests passed! Socket.io event flow is working correctly.');
  } else if (!eventReceived) {
    console.log('\n⚠️  No event received. This could mean:');
    console.log('   1. No bid was placed during the test');
    console.log('   2. Socket.io server is not broadcasting events');
    console.log('   3. Client is not properly listening to events');
    console.log('   4. Room join failed');
  } else {
    console.log('\n❌ Some tests failed. Please review the results above.');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

// Run test
testSocketEventFlow().catch((error) => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
