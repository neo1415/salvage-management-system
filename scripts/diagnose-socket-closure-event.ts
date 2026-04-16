/**
 * Diagnostic Script: Socket.IO Auction Closure Event
 * 
 * This script helps diagnose why the auction closure event isn't updating the UI.
 * 
 * Run this script to check:
 * 1. If Socket.IO server is initialized
 * 2. If clients are connected to the auction room
 * 3. If the closure event is being broadcast
 * 
 * Usage:
 *   npx tsx scripts/diagnose-socket-closure-event.ts <auction-id>
 */

import { getSocketServer } from '@/lib/socket/server';

async function diagnoseSocketClosure(auctionId: string) {
  console.log('🔍 Diagnosing Socket.IO Auction Closure Event');
  console.log('='.repeat(60));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  // Check 1: Socket.IO server initialization
  console.log('1️⃣  Checking Socket.IO server initialization...');
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.IO server is NOT initialized');
    console.error('   - This means the server was never started');
    console.error('   - Check that server.ts calls initializeSocketServer()');
    console.error('   - Restart your dev server');
    return;
  }
  
  console.log('✅ Socket.IO server is initialized');
  console.log('');

  // Check 2: Connected clients
  console.log('2️⃣  Checking connected clients...');
  const sockets = await socketServer.fetchSockets();
  console.log(`   - Total connected clients: ${sockets.length}`);
  
  if (sockets.length === 0) {
    console.warn('⚠️  No clients connected to Socket.IO server');
    console.warn('   - Make sure you have the auction details page open');
    console.warn('   - Check browser console for connection errors');
    return;
  }
  
  console.log('✅ Clients are connected');
  console.log('');

  // Check 3: Auction room membership
  console.log('3️⃣  Checking auction room membership...');
  const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
  
  if (!room) {
    console.warn(`⚠️  No clients in room: auction:${auctionId}`);
    console.warn('   - Make sure you opened the auction details page');
    console.warn('   - Check that useAuctionWatch() is being called');
    console.warn('   - Check browser console for "👁️ Joining auction room" message');
    return;
  }
  
  const clientCount = room.size;
  console.log(`✅ Clients in room: ${clientCount}`);
  console.log('');

  // Check 4: Test broadcast
  console.log('4️⃣  Testing broadcast to auction room...');
  try {
    socketServer.to(`auction:${auctionId}`).emit('auction:closed', {
      auctionId,
      winnerId: 'test-winner-id',
    });
    console.log('✅ Test broadcast sent successfully');
    console.log('   - Check browser console for "📡 Received auction closure" message');
    console.log('   - If you see the message, Socket.IO is working correctly');
    console.log('   - If you don\'t see it, there\'s an event listener issue');
  } catch (error) {
    console.error('❌ Failed to send test broadcast:', error);
  }
  console.log('');

  // Summary
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Socket.IO Server: ${socketServer ? '✅ Initialized' : '❌ Not initialized'}`);
  console.log(`Connected Clients: ${sockets.length}`);
  console.log(`Clients in Room: ${clientCount}`);
  console.log('');
  console.log('🔍 NEXT STEPS:');
  console.log('1. Open the auction details page in your browser');
  console.log('2. Open browser DevTools console (F12)');
  console.log('3. Look for these messages:');
  console.log('   - "✅ Socket.io connected"');
  console.log('   - "👁️ Joining auction room: auction:..."');
  console.log('   - "📡 Received auction closure for..."');
  console.log('4. If you see "📡 Received auction closure" but UI doesn\'t update:');
  console.log('   - Check for "✅ Auction state updated to \'closed\'" message');
  console.log('   - If missing, the state update is failing');
  console.log('   - Try hard refresh (Ctrl+Shift+R)');
  console.log('5. If you DON\'T see "📡 Received auction closure":');
  console.log('   - Socket.IO event listener is not registered');
  console.log('   - Restart dev server and try again');
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('❌ Please provide an auction ID');
  console.error('Usage: npx tsx scripts/diagnose-socket-closure-event.ts <auction-id>');
  process.exit(1);
}

diagnoseSocketClosure(auctionId)
  .then(() => {
    console.log('');
    console.log('✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });
