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
 * Requirements: 16-21, NFR1.1
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

// Socket.io event types
export interface ServerToClientEvents {
  // Auction updates
  'auction:updated': (data: { auctionId: string; auction: any }) => void;
  'auction:new-bid': (data: { auctionId: string; bid: any }) => void;
  'auction:extended': (data: { auctionId: string; newEndTime: Date }) => void;
  'auction:closed': (data: { auctionId: string; winnerId: string }) => void;
  'auction:watching-count': (data: { auctionId: string; count: number }) => void;

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
let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = null;

/**
 * Initialize Socket.io server
 */
export function initializeSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
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
  });

  // Authentication middleware
  io.use(authenticationMiddleware);

  // Connection handler
  io.on('connection', handleConnection);

  console.log('✅ Socket.io server initialized');

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
      // Join auction room
      socket.join(`auction:${auctionId}`);

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
  socket.on('bid:place', async ({ auctionId, amount, otp }) => {
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
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`auction:${auctionId}`).emit('auction:new-bid', {
    auctionId,
    bid,
  });

  console.log(`📢 Broadcasted new bid for auction ${auctionId}`);
}

/**
 * Broadcast auction update
 */
export async function broadcastAuctionUpdate(auctionId: string, auction: any) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`auction:${auctionId}`).emit('auction:updated', {
    auctionId,
    auction,
  });

  console.log(`📢 Broadcasted auction update for ${auctionId}`);
}

/**
 * Broadcast auction extension
 */
export async function broadcastAuctionExtension(auctionId: string, newEndTime: Date) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`auction:${auctionId}`).emit('auction:extended', {
    auctionId,
    newEndTime,
  });

  console.log(`📢 Broadcasted auction extension for ${auctionId}`);
}

/**
 * Broadcast auction closure
 */
export async function broadcastAuctionClosure(auctionId: string, winnerId: string) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`auction:${auctionId}`).emit('auction:closed', {
    auctionId,
    winnerId,
  });

  console.log(`📢 Broadcasted auction closure for ${auctionId}`);
}

/**
 * Notify vendor they've been outbid
 */
export async function notifyVendorOutbid(vendorId: string, auctionId: string, newBid: number) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`vendor:${vendorId}`).emit('vendor:outbid', {
    auctionId,
    newBid,
  });

  console.log(`📢 Notified vendor ${vendorId} they've been outbid`);
}

/**
 * Notify vendor they've won auction
 */
export async function notifyVendorWon(vendorId: string, auctionId: string, amount: number) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`vendor:${vendorId}`).emit('vendor:won', {
    auctionId,
    amount,
  });

  console.log(`📢 Notified vendor ${vendorId} they won auction ${auctionId}`);
}

/**
 * Send notification to specific user
 */
export async function sendNotificationToUser(userId: string, notification: any) {
  if (!io) {
    console.warn('Socket.io server not initialized');
    return;
  }

  io.to(`user:${userId}`).emit('notification:new', {
    notification,
  });

  console.log(`📢 Sent notification to user ${userId}`);
}

/**
 * Get Socket.io server instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}
