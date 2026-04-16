/**
 * Room Manager for Socket.IO
 * Task 8.1.7: Implement vendor-specific room targeting
 * 
 * Manages Socket.IO room joining/leaving for intelligence features.
 */

import { getSocketServer } from '@/lib/socket/server';

export class RoomManager {
  /**
   * Join vendor-specific room
   * 
   * @param socketId - Socket ID
   * @param vendorId - Vendor UUID
   */
  static joinVendorRoom(socketId: string, vendorId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(`vendor:${vendorId}`);
      console.log(`✅ Socket ${socketId} joined vendor room: vendor:${vendorId}`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Leave vendor-specific room
   * 
   * @param socketId - Socket ID
   * @param vendorId - Vendor UUID
   */
  static leaveVendorRoom(socketId: string, vendorId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`vendor:${vendorId}`);
      console.log(`✅ Socket ${socketId} left vendor room: vendor:${vendorId}`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Join auction-specific room
   * 
   * @param socketId - Socket ID
   * @param auctionId - Auction UUID
   */
  static joinAuctionRoom(socketId: string, auctionId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(`auction:${auctionId}`);
      console.log(`✅ Socket ${socketId} joined auction room: auction:${auctionId}`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Leave auction-specific room
   * 
   * @param socketId - Socket ID
   * @param auctionId - Auction UUID
   */
  static leaveAuctionRoom(socketId: string, auctionId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`auction:${auctionId}`);
      console.log(`✅ Socket ${socketId} left auction room: auction:${auctionId}`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Join admin room
   * 
   * @param socketId - Socket ID
   */
  static joinAdminRoom(socketId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join('admin');
      console.log(`✅ Socket ${socketId} joined admin room`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Leave admin room
   * 
   * @param socketId - Socket ID
   */
  static leaveAdminRoom(socketId: string): void {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return;
    }

    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave('admin');
      console.log(`✅ Socket ${socketId} left admin room`);
    } else {
      console.warn(`Socket ${socketId} not found`);
    }
  }

  /**
   * Get room member count
   * 
   * @param roomName - Room name
   * @returns Number of members in the room
   */
  static getRoomMemberCount(roomName: string): number {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return 0;
    }

    const room = io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get all rooms for a socket
   * 
   * @param socketId - Socket ID
   * @returns Array of room names
   */
  static getSocketRooms(socketId: string): string[] {
    const io = getSocketServer();
    if (!io) {
      console.warn('Socket.IO server not initialized');
      return [];
    }

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn(`Socket ${socketId} not found`);
      return [];
    }

    return Array.from(socket.rooms);
  }
}
