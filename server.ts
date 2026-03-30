/**
 * Custom Next.js Server with Socket.io
 * 
 * This custom server integrates Socket.io with Next.js for real-time functionality.
 * It creates an HTTP server, attaches Socket.io, and then starts the Next.js app.
 * 
 * To use this server:
 * 1. Update package.json scripts:
 *    "dev": "tsx server.ts"
 *    "build": "next build"
 *    "start": "NODE_ENV=production tsx server.ts"
 * 
 * Requirements: 16-21, NFR1.1
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from './src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize Socket.io server
  const io = initializeSocketServer(httpServer);
  
  // Verify initialization
  if (!io) {
    console.error('❌ CRITICAL: Socket.io server failed to initialize!');
    process.exit(1);
  }
  
  console.log('✅ Socket.io server stored and accessible');

  // Start server
  httpServer.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🚀 NEM Salvage Management System                         ║
║                                                            ║
║  ✅ Next.js server ready                                  ║
║  ✅ Socket.io server ready                                ║
║                                                            ║
║  🌐 Local:    http://${hostname}:${port}                  ║
║  📡 Socket:   ws://${hostname}:${port}                    ║
║                                                            ║
║  Environment: ${dev ? 'development' : 'production'}       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});
