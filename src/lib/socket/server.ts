/**
 * Socket.io Server Configuration
 * 
 * Provides real-time bidding and auction updates via WebSocket connections.
 * Implements authentication middleware and event handlers for:
 * - Auction watching/unwatching
 * - Bid placement and broadcasting
 * - Real-time auction updates
 * - Vendor notifications
 * 
 * SCALABILITY: Uses Redis adapter for horizontal scaling across multiple servers
 * 
 * Requirements: 16-21, NFR1.1
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';

// Socket.io event types
export interface ServerToClientEvents {
  // Auction updates
  'auction:updated': (data: { auctionId: string; auction: any }) => void;
  'auction:new-bid': (data: { auctionId: string; bid: any }) => void;
  'auction:extended': (data: { auctionId: string; newEndTime: Date }) => void;
  'auction:closed': (data: { auctionId: string; winnerId: string }) => void;
  'auction:watching-count': (data: { auctionId: string; count: number }) => void;

  // NEW: Auction closure with document generation
  'auction:closing': (data: { auctionId: string }) => void;
  'auction:document-generated': (data: { 
    auctionId: string; 
    documentType: string;
    documentId: string;
  }) => void;
  'auction:document-generation-complete': (data: { 
    auctionId: string;
    totalDocuments: number;
  }) => void;

  // Vendor notifications
  'vendor:outbid': (data: { auctionId: string; newBid: number }) => void;
  'vendor:won': (data: { auctionId: string; amount: number }) => void;

  // System notifications
  'notification:new': (data: { notification: any }) => void;

  // Connection events
  'connect_error': (error: Error) => void;
}

export interface ClientToServerEvents {
  // Auction watching
  'auction:watch': (data: { auctionId: string }) => void;
  'auction:unwatch': (data: { auctionId: string }) => void;

  // Bidding
  'bid:place': (data: { auctionId: string; amount: number; otp: string }) => void;

  // Subscriptions
  'subscribe:auctions': (data: { filters?: any }) => void;
  'unsubscribe:auctions': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  role: string;
  vendorId?: string;
}

// Authenticated socket type
export type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Global Socket.io server instance
// CRITICAL FIX: Use Node.js global object to share instance across module boundaries
// This fixes Next.js module loading issues where different compilations create separate instances
declare global {
  var __socketIOServer: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null | undefined;
}

// Initialize global if it doesn't exist
if (typeof global.__socketIOServer === 'undefined') {
  global.__socketIOServer = null;
}

// Module-level reference (for backward compatibility)
let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = global.__socketIOServer || null;

/**
 * Initialize Socket.io server
 * 
 * SCALABILITY: Configures Redis adapter for pub/sub across multiple server instances
 * This enables horizontal scaling - messages are broadcast to all servers
 */
export function initializeSocketServer(httpServer: HTTPServer): SocketIOServer {
  console.log('🔧 initializeSocketServer() called');
  
  // Check global first
  if (global.__socketIOServer) {
    console.log('✅ Socket.io server already initialized (from global), returning existing instance');
    io = global.__socketIOServer;
    return io;
  }
  
  if (io) {
    console.log('✅ Socket.io server already initialized (from module), returning existing instance');
    global.__socketIOServer = io;
    return io;
  }

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    // SCALABILITY: Connection limits per server instance
    // Prevents memory exhaustion from too many connections
    maxHttpBufferSize: 1e6, // 1MB max message size
    connectTimeout: 45000, // 45 second connection timeout
  });

  // CRITICAL: Store in global object to share across module boundaries
  global.__socketIOServer = io;

  // SCALABILITY: Configure Redis adapter for horizontal scaling
  // This enables pub/sub across multiple server instances
  // Note: Vercel KV Redis is used (already configured in redis/client.ts)
  // For production with multiple servers, uncomment the adapter setup below:
  
  /*
  // Import Redis adapter (requires @socket.io/redis-adapter package)
  import { createAdapter } from '@socket.io/redis-adapter';
  
  // Create Redis pub/sub clients using Vercel KV
  const pubClient = redis;
  const subClient = redis.duplicate();
  
  // Set up adapter
  io.adapter(createAdapter(pubClient, subClient));
  
  console.log('✅ Socket.io Redis adapter configured for horizontal scaling');
  */

  // For now, log that Redis adapter should be configured for production scaling
  console.log('⚠️ Socket.io running in single-server mode. For horizontal scaling, configure Redis adapter.');

  // Authentication middleware
  io.use(authenticationMiddleware);

  // Connection handler
  io.on('connection', handleConnection);

  console.log('✅ Socket.io server initialized successfully');
  console.log(`   - CORS origin: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);
  console.log(`   - Transports: websocket, polling`);
  console.log(`   - Server instance created and ready`);
  console.log(`   - Stored in global.__socketIOServer for cross-module access`);

  return io;
}

/**
 * Authentication middleware for Socket.io
 * Verifies JWT token and attaches user data to socket
 */
async function authenticationMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as {
      sub: string;
      role: string;
      vendorId?: string;
    };

    // Fetch user from database to ensure they still exist and are active
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.sub))
      .limit(1);

    if (!user) {
      return next(new Error('User not found'));
    }

    if (user.status === 'suspended' || user.status === 'deleted') {
      return next(new Error('Account is suspended or deleted'));
    }

    // Attach user data to socket
    socket.data.userId = user.id;
    socket.data.role = user.role;
    socket.data.vendorId = decoded.vendorId;

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Invalid authentication token'));
  }
}

/**
 * Handle new socket connection
 */
function handleConnection(socket: AuthenticatedSocket) {
  const { userId, role } = socket.data;

  console.log(`✅ User connected: ${userId} (${role})`);

  // Join user-specific room for targeted notifications
  socket.join(`user:${userId}`);

  if (socket.data.vendorId) {
    socket.join(`vendor:${socket.data.vendorId}`);
  }

  // Register event handlers
  registerAuctionWatchingHandlers(socket);
  registerBiddingHandlers(socket);
  registerSubscriptionHandlers(socket);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${userId}`);
    handleDisconnection(socket);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for user ${userId}:`, error);
  });
}

/**
 * Register auction watching event handlers
 */
function registerAuctionWatchingHandlers(socket: AuthenticatedSocket) {
  // Watch auction
  socket.on('auction:watch', async ({ auctionId }) => {
    try {
      console.log(`👁️ auction:watch event received`);
      console.log(`   - User ID: ${socket.data.userId}`);
      console.log(`   - Auction ID: ${auctionId}`);
      console.log(`   - Socket ID: ${socket.id}`);
      
      // Join auction room
      socket.join(`auction:${auctionId}`);
      
      console.log(`✅ User ${socket.data.userId} joined room: auction:${auctionId}`);
      
      // Verify room membership
      const rooms = Array.from(socket.rooms);
      console.log(`   - Socket rooms: ${rooms.join(', ')}`);

      // Track auction view (will increment after 10 seconds)
      if (socket.data.vendorId) {
        const { trackAuctionView } = await import('@/features/auctions/services/watching.service');
        await trackAuctionView(auctionId, socket.data.vendorId, socket.data.userId);
      }

      console.log(`👁️ User ${socket.data.userId} watching auction ${auctionId}`);
    } catch (error) {
      console.error('Error watching auction:', error);
      socket.emit('connect_error', error as Error);
    }
  });

  // Unwatch auction
  socket.on('auction:unwatch', async ({ auctionId }) => {
    try {
      // Leave auction room
      socket.leave(`auction:${auctionId}`);

      // Decrement watching count
      if (socket.data.vendorId) {
        const { decrementWatchingCount } = await import('@/features/auctions/services/watching.service');
        await decrementWatchingCount(auctionId, socket.data.vendorId, socket.data.userId);
      }

      console.log(`👁️ User ${socket.data.userId} stopped watching auction ${auctionId}`);
    } catch (error) {
      console.error('Error unwatching auction:', error);
    }
  });
}

/**
 * Register bidding event handlers
 */
function registerBiddingHandlers(socket: AuthenticatedSocket) {
  // Note: Actual bid placement is handled via REST API for security
  // This is just for real-time updates
  socket.on('bid:place', async () => {
    // Redirect to REST API
    socket.emit('connect_error', new Error('Please use REST API for bid placement'));
  });
}

/**
 * Register subscription event handlers
 */
function registerSubscriptionHandlers(socket: AuthenticatedSocket) {
  // Subscribe to auction updates
  socket.on('subscribe:auctions', ({ filters }) => {
    // Join general auctions room
    socket.join('auctions:all');

    // Apply filters if provided
    if (filters?.assetType) {
      socket.join(`auctions:type:${filters.assetType}`);
    }

    console.log(`📡 User ${socket.data.userId} subscribed to auctions`);
  });

  // Unsubscribe from auction updates
  socket.on('unsubscribe:auctions', () => {
    socket.leave('auctions:all');
    console.log(`📡 User ${socket.data.userId} unsubscribed from auctions`);
  });
}

/**
 * Handle socket disconnection
 */
async function handleDisconnection(socket: AuthenticatedSocket) {
  // Get all auction rooms the user was watching
  const rooms = Array.from(socket.rooms);
  const auctionRooms = rooms.filter((room) => room.startsWith('auction:'));

  // Decrement watching count for all watched auctions
  if (socket.data.vendorId) {
    const { decrementWatchingCount } = await import('@/features/auctions/services/watching.service');
    
    for (const room of auctionRooms) {
      const auctionId = room.replace('auction:', '');
      try {
        await decrementWatchingCount(auctionId, socket.data.vendorId, socket.data.userId);
      } catch (error) {
        console.error(`Error updating watching count for ${auctionId}:`, error);
      }
    }
  }
}

/**
 * Broadcast new bid to all auction viewers
 */
export async function broadcastNewBid(auctionId: string, bid: any) {
  console.log(`🔔 broadcastNewBid() called for auction ${auctionId}`);
  
  // CRITICAL FIX: Use getSocketServer() instead of module-level io variable
  // This fixes Next.js module loading issues where API routes see io as null
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast bid');
    console.error('   - This means io is null/undefined');
    console.error('   - Check that initializeSocketServer() was called in server.ts');
    return;
  }

  try {
    // Calculate new minimum bid (current bid + ₦20,000)
    const currentBid = Number(bid.amount);
    const minimumBid = currentBid + 20000;

    // Get room info for debugging
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);
    console.log(`   - Bid amount: ₦${currentBid.toLocaleString()}`);
    console.log(`   - New minimum bid: ₦${minimumBid.toLocaleString()}`);
    console.log(`   - EVENT NAME: 'auction:new-bid'`);
    console.log(`   - Payload:`, JSON.stringify({
      auctionId,
      bid: {
        ...bid,
        minimumBid,
      },
    }, null, 2));

    socketServer.to(`auction:${auctionId}`).emit('auction:new-bid', {
      auctionId,
      bid: {
        ...bid,
        minimumBid, // Include the new minimum bid for realtime updates
      },
    });

    console.log(`✅ Broadcast successful for auction ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast new bid for auction ${auctionId}:`, error);
    console.error('   - Error details:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Broadcast auction update
 */
export async function broadcastAuctionUpdate(auctionId: string, auction: any) {
  console.log(`🔔 broadcastAuctionUpdate() called for auction ${auctionId}`);
  
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast update');
    return;
  }

  try {
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting auction update to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);
    console.log(`   - Status: ${auction.status}`);

    socketServer.to(`auction:${auctionId}`).emit('auction:updated', {
      auctionId,
      auction,
    });

    console.log(`✅ Auction update broadcast successful for ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast auction update for ${auctionId}:`, error);
  }
}

/**
 * Broadcast auction extension
 */
export async function broadcastAuctionExtension(auctionId: string, newEndTime: Date) {
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.warn('Socket.io server not initialized');
    return;
  }

  socketServer.to(`auction:${auctionId}`).emit('auction:extended', {
    auctionId,
    newEndTime,
  });

  console.log(`📢 Broadcasted auction extension for ${auctionId}`);
}

/**
 * Broadcast auction closure
 */
export async function broadcastAuctionClosure(auctionId: string, winnerId: string) {
  console.log(`🔔 broadcastAuctionClosure() called for auction ${auctionId}`);
  
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast closure');
    return;
  }

  try {
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting auction closure to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);
    console.log(`   - Winner ID: ${winnerId}`);

    socketServer.to(`auction:${auctionId}`).emit('auction:closed', {
      auctionId,
      winnerId,
    });

    console.log(`✅ Auction closure broadcast successful for ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast auction closure for ${auctionId}:`, error);
  }
}

/**
 * Notify vendor they've been outbid
 */
export async function notifyVendorOutbid(vendorId: string, auctionId: string, newBid: number) {
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.warn('Socket.io server not initialized');
    return;
  }

  socketServer.to(`vendor:${vendorId}`).emit('vendor:outbid', {
    auctionId,
    newBid,
  });

  console.log(`📢 Notified vendor ${vendorId} they've been outbid`);
}

/**
 * Notify vendor they've won auction
 */
export async function notifyVendorWon(vendorId: string, auctionId: string, amount: number) {
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.warn('Socket.io server not initialized');
    return;
  }

  socketServer.to(`vendor:${vendorId}`).emit('vendor:won', {
    auctionId,
    amount,
  });

  console.log(`📢 Notified vendor ${vendorId} they won auction ${auctionId}`);
}

/**
 * Send notification to specific user
 */
export async function sendNotificationToUser(userId: string, notification: any) {
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.warn('Socket.io server not initialized');
    return;
  }

  socketServer.to(`user:${userId}`).emit('notification:new', {
    notification,
  });

  console.log(`📢 Sent notification to user ${userId}`);
}

/**
 * Broadcast auction closing (document generation starting)
 */
export async function broadcastAuctionClosing(auctionId: string) {
  console.log(`🔔 broadcastAuctionClosing() called for auction ${auctionId}`);
  
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast closing');
    return;
  }

  try {
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting auction closing to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);

    socketServer.to(`auction:${auctionId}`).emit('auction:closing', {
      auctionId,
    });

    console.log(`✅ Auction closing broadcast successful for ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast auction closing for ${auctionId}:`, error);
  }
}

/**
 * Broadcast document generated
 */
export async function broadcastDocumentGenerated(
  auctionId: string,
  documentType: string,
  documentId: string
) {
  console.log(`🔔 broadcastDocumentGenerated() called for auction ${auctionId}`);
  console.log(`   - Document type: ${documentType}`);
  console.log(`   - Document ID: ${documentId}`);
  
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast document');
    return;
  }

  try {
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting document generated to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);

    socketServer.to(`auction:${auctionId}`).emit('auction:document-generated', {
      auctionId,
      documentType,
      documentId,
    });

    console.log(`✅ Document generated broadcast successful for ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast document generated for ${auctionId}:`, error);
  }
}

/**
 * Broadcast document generation complete
 */
export async function broadcastDocumentGenerationComplete(
  auctionId: string,
  totalDocuments: number
) {
  console.log(`🔔 broadcastDocumentGenerationComplete() called for auction ${auctionId}`);
  console.log(`   - Total documents: ${totalDocuments}`);
  
  const socketServer = getSocketServer();
  
  if (!socketServer) {
    console.error('❌ Socket.io server not initialized - cannot broadcast completion');
    return;
  }

  try {
    const room = socketServer.sockets.adapter.rooms.get(`auction:${auctionId}`);
    const clientCount = room ? room.size : 0;
    
    console.log(`📢 Broadcasting document generation complete to room: auction:${auctionId}`);
    console.log(`   - Clients in room: ${clientCount}`);

    socketServer.to(`auction:${auctionId}`).emit('auction:document-generation-complete', {
      auctionId,
      totalDocuments,
    });

    console.log(`✅ Document generation complete broadcast successful for ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to broadcast document generation complete for ${auctionId}:`, error);
  }
}

/**
 * Get Socket.io server instance
 * CRITICAL: Always check global first to handle Next.js module loading
 */
export function getSocketServer(): SocketIOServer | null {
  // Check global first (cross-module access)
  if (global.__socketIOServer) {
    return global.__socketIOServer;
  }
  
  // Fallback to module-level variable
  return io;
}
