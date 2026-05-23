import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocketUser, InternalBroadcast } from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuthenticatedSocket = Socket & {
  data: {
    user: AuthenticatedSocketUser;
  };
};

function joinBaseRooms(socket: AuthenticatedSocket): void {
  const user = socket.data.user;

  socket.join(`user:${user.id}`);

  if (user.vendorId) {
    socket.join(`vendor:${user.vendorId}`);
  }

  if (user.role === 'system_admin') {
    socket.join('admins');
    socket.join('fraud:alerts');
  }

  if (user.role === 'salvage_manager') {
    socket.join('salvage_managers');
    socket.join('auctions:management');
  }

  if (user.role === 'finance_officer') {
    socket.join('finance_officers');
    socket.join('payments:management');
  }

  if (user.role === 'claims_adjuster') {
    socket.join(`adjuster:${user.id}`);
  }
}

export function registerSocketHandlers(io: Server, socket: AuthenticatedSocket): void {
  joinBaseRooms(socket);

  socket.emit('connected', {
    userId: socket.data.user.id,
    role: socket.data.user.role,
    connectedAt: new Date().toISOString()
  });

  socket.on('auction:join', (auctionId: unknown) => {
    if (typeof auctionId !== 'string' || !uuidPattern.test(auctionId)) {
      socket.emit('error', { message: 'Invalid auction id' });
      return;
    }

    socket.join(`auction:${auctionId}`);
    socket.join('auctions:all');
    socket.emit('auction:joined', { auctionId });
  });

  socket.on('auction:leave', (auctionId: unknown) => {
    if (typeof auctionId !== 'string' || !uuidPattern.test(auctionId)) {
      return;
    }

    socket.leave(`auction:${auctionId}`);
    socket.emit('auction:left', { auctionId });
  });

  socket.on('bid:place', () => {
    socket.emit('bid:error', {
      message: 'Realtime bidding is disabled. Use the secure REST bidding endpoint.'
    });
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
}

export function emitInternalBroadcast(io: Server, broadcast: InternalBroadcast): void {
  const { target, type, payload } = broadcast;

  if (target.room) {
    io.to(target.room).emit(type, payload);
  }

  if (target.userId) {
    io.to(`user:${target.userId}`).emit(type, payload);
  }

  if (target.vendorId) {
    io.to(`vendor:${target.vendorId}`).emit(type, payload);
  }

  if (target.auctionId) {
    io.to(`auction:${target.auctionId}`).emit(type, payload);
  }

  if (target.allAuctions) {
    io.to('auctions:all').emit(type, payload);
  }
}
