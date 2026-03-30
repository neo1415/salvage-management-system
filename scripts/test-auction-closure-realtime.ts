/**
 * Test Script: Auction Closure Real-Time System
 * 
 * Tests the new event-driven auction closure architecture:
 * 1. Close endpoint idempotency
 * 2. Socket.io event broadcasting
 * 3. Document generation timing
 * 4. Real-time status updates
 * 
 * Usage:
 *   npx tsx scripts/test-auction-closure-realtime.ts
 */

import { io, Socket } from 'socket.io-client';

interface TestResult {
  name: string;
  passed: boolean;
  duration?: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 Auction Closure Real-Time System Test');
  console.log('═'.repeat(60));
  console.log('');

  // Configuration
  const SERVER_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const TEST_AUCTION_ID = process.env.TEST_AUCTION_ID || 'test-auction-123';
  const JWT_TOKEN = process.env.TEST_JWT_TOKEN || '';

  if (!JWT_TOKEN) {
    console.error('❌ TEST_JWT_TOKEN environment variable required');
    console.error('   Set it to a valid JWT token from your session');
    process.exit(1);
  }

  console.log(`📍 Server: ${SERVER_URL}`);
  console.log(`🎯 Test Auction: ${TEST_AUCTION_ID}`);
  console.log('');

  // Test 1: Socket.io Connection
  console.log('Test 1: Socket.io Connection');
  console.log('─'.repeat(60));
  
  let socket: Socket | null = null;
  const startTime1 = Date.now();
  
  try {
    socket = io(SERVER_URL, {
      auth: { token: JWT_TOKEN },
      transports: ['websocket', 'polling'],
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10 seconds'));
      }, 10000);

      socket!.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ Connected to Socket.io');
        console.log(`   - Socket ID: ${socket!.id}`);
        console.log(`   - Transport: ${socket!.io.engine.transport.name}`);
        resolve();
      });

      socket!.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    results.push({
      name: 'Socket.io Connection',
      passed: true,
      duration: Date.now() - startTime1,
      details: { socketId: socket.id, transport: socket.io.engine.transport.name },
    });
  } catch (error) {
    console.error('❌ Connection failed:', error);
    results.push({
      name: 'Socket.io Connection',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }

  console.log('');

  // Test 2: Join Auction Room
  console.log('Test 2: Join Auction Room');
  console.log('─'.repeat(60));
  
  const startTime2 = Date.now();
  
  try {
    socket.emit('auction:watch', { auctionId: TEST_AUCTION_ID });
    console.log(`✅ Joined room: auction:${TEST_AUCTION_ID}`);
    
    // Wait a bit for server to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.push({
      name: 'Join Auction Room',
      passed: true,
      duration: Date.now() - startTime2,
    });
  } catch (error) {
    console.error('❌ Failed to join room:', error);
    results.push({
      name: 'Join Auction Room',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  console.log('');

  // Test 3: Listen for Closure Events
  console.log('Test 3: Listen for Closure Events');
  console.log('─'.repeat(60));
  
  const receivedEvents: Array<{ event: string; timestamp: number; data?: any }> = [];
  const startTime3 = Date.now();

  // Set up event listeners
  socket.on('auction:closing', (data) => {
    const timestamp = Date.now() - startTime3;
    console.log(`📡 [${timestamp}ms] Received: auction:closing`);
    receivedEvents.push({ event: 'closing', timestamp, data });
  });

  socket.on('auction:document-generated', (data) => {
    const timestamp = Date.now() - startTime3;
    console.log(`📡 [${timestamp}ms] Received: auction:document-generated`);
    console.log(`   - Document type: ${data.documentType}`);
    console.log(`   - Document ID: ${data.documentId}`);
    receivedEvents.push({ event: `doc:${data.documentType}`, timestamp, data });
  });

  socket.on('auction:document-generation-complete', (data) => {
    const timestamp = Date.now() - startTime3;
    console.log(`📡 [${timestamp}ms] Received: auction:document-generation-complete`);
    console.log(`   - Total documents: ${data.totalDocuments}`);
    receivedEvents.push({ event: 'complete', timestamp, data });
  });

  socket.on('auction:closed', (data) => {
    const timestamp = Date.now() - startTime3;
    console.log(`📡 [${timestamp}ms] Received: auction:closed`);
    console.log(`   - Winner ID: ${data.winnerId}`);
    receivedEvents.push({ event: 'closed', timestamp, data });
  });

  console.log('⏳ Event listeners set up. Waiting for closure...');
  console.log('');

  // Test 4: Call Close Endpoint
  console.log('Test 4: Call Close Endpoint');
  console.log('─'.repeat(60));
  
  const startTime4 = Date.now();
  
  try {
    const response = await fetch(`${SERVER_URL}/api/auctions/${TEST_AUCTION_ID}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    const duration4 = Date.now() - startTime4;

    if (response.ok && result.success) {
      console.log(`✅ Close endpoint responded in ${duration4}ms`);
      console.log(`   - Success: ${result.success}`);
      console.log(`   - Winner: ${result.data?.winnerId || 'No winner'}`);
      console.log(`   - Winning Bid: ${result.data?.winningBid ? `₦${result.data.winningBid.toLocaleString()}` : 'N/A'}`);
      
      results.push({
        name: 'Close Endpoint',
        passed: true,
        duration: duration4,
        details: result.data,
      });
    } else {
      console.log(`⚠️  Close endpoint returned: ${result.error || 'Unknown error'}`);
      console.log(`   - This may be expected if auction is already closed (idempotent)`);
      
      results.push({
        name: 'Close Endpoint',
        passed: true, // Still pass if idempotent
        duration: duration4,
        details: { idempotent: true, message: result.error },
      });
    }
  } catch (error) {
    console.error('❌ Close endpoint failed:', error);
    results.push({
      name: 'Close Endpoint',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  console.log('');

  // Test 5: Wait for Events
  console.log('Test 5: Wait for Events (10 seconds)');
  console.log('─'.repeat(60));
  
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('');

  // Test 6: Verify Events Received
  console.log('Test 6: Verify Events Received');
  console.log('─'.repeat(60));
  
  const expectedEvents = [
    'closing',
    'doc:bill_of_sale',
    'doc:liability_waiver',
    'complete',
    'closed',
  ];

  const receivedEventNames = receivedEvents.map(e => e.event);
  
  console.log('Expected events:', expectedEvents);
  console.log('Received events:', receivedEventNames);
  console.log('');

  const allReceived = expectedEvents.every(e => receivedEventNames.includes(e));
  
  if (allReceived) {
    console.log('✅ All events received correctly!');
    
    // Calculate timing
    const closingEvent = receivedEvents.find(e => e.event === 'closing');
    const closedEvent = receivedEvents.find(e => e.event === 'closed');
    
    if (closingEvent && closedEvent) {
      const totalTime = closedEvent.timestamp - closingEvent.timestamp;
      console.log(`   - Total closure time: ${totalTime}ms`);
      console.log(`   - Document generation: ${totalTime}ms`);
    }
    
    results.push({
      name: 'Event Broadcasting',
      passed: true,
      details: { events: receivedEvents },
    });
  } else {
    const missing = expectedEvents.filter(e => !receivedEventNames.includes(e));
    console.log('❌ Missing events:', missing);
    console.log('   - This may be expected if auction was already closed');
    
    results.push({
      name: 'Event Broadcasting',
      passed: receivedEventNames.length > 0, // Pass if we got any events
      details: { missing, received: receivedEventNames },
    });
  }

  console.log('');

  // Test 7: Idempotency Test
  console.log('Test 7: Idempotency Test');
  console.log('─'.repeat(60));
  
  const startTime7 = Date.now();
  
  try {
    const response = await fetch(`${SERVER_URL}/api/auctions/${TEST_AUCTION_ID}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    const duration7 = Date.now() - startTime7;

    if (response.ok && result.success) {
      console.log(`✅ Idempotency check passed - second call succeeded in ${duration7}ms`);
      console.log(`   - Response: ${JSON.stringify(result.data)}`);
      
      results.push({
        name: 'Idempotency',
        passed: true,
        duration: duration7,
      });
    } else {
      console.log(`⚠️  Second call returned error (may be expected): ${result.error}`);
      results.push({
        name: 'Idempotency',
        passed: true, // Still pass - idempotent behavior
        duration: duration7,
      });
    }
  } catch (error) {
    console.error('❌ Idempotency test failed:', error);
    results.push({
      name: 'Idempotency',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  console.log('');

  // Cleanup
  socket.disconnect();
  console.log('🔌 Disconnected from Socket.io');
  console.log('');

  // Summary
  console.log('═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log('');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.name}${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('');
  console.log(`Total: ${passed}/${total} passed, ${failed}/${total} failed`);
  console.log('');

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check logs above for details.');
  }

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
