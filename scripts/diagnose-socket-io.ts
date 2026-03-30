/**
 * Socket.io Diagnostic Script
 * 
 * This script checks if Socket.io server is properly initialized
 * and helps diagnose initialization issues.
 */

import { createServer } from 'http';
import { initializeSocketServer } from '../src/lib/socket/server';

console.log('🔍 Socket.io Diagnostic Script');
console.log('================================\n');

// Step 1: Create HTTP server
console.log('Step 1: Creating HTTP server...');
const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end('Test server');
});
console.log('✅ HTTP server created\n');

// Step 2: Initialize Socket.io
console.log('Step 2: Initializing Socket.io server...');
try {
  const io = initializeSocketServer(httpServer);
  
  if (io) {
    console.log('✅ Socket.io server initialized successfully!');
    console.log(`   - Server instance: ${typeof io}`);
    console.log(`   - Has emit method: ${typeof io.emit === 'function'}`);
    console.log(`   - Has to method: ${typeof io.to === 'function'}`);
    console.log(`   - Has on method: ${typeof io.on === 'function'}`);
  } else {
    console.error('❌ Socket.io server is NULL or UNDEFINED!');
    console.error('   - This means initializeSocketServer() returned null');
    console.error('   - Check src/lib/socket/server.ts for errors');
  }
} catch (error) {
  console.error('❌ Error initializing Socket.io:');
  console.error(error);
}

console.log('\n================================');
console.log('Diagnostic complete. Press Ctrl+C to exit.');

// Keep process alive
httpServer.listen(3001, () => {
  console.log('Test server listening on port 3001');
});
