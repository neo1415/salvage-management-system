/**
 * Socket.io Client Hook
 * 
 * React hook for managing Socket.io connections in client components.
 * Provides automatic connection management, authentication, and event handling.
 * 
 * Usage:
 * ```tsx
 * const { socket, isConnected, error } = useSocket();
 * 
 * useEffect(() => {
 *   if (!socket) return;
 *   
 *   socket.on('auction:new-bid', (data) => {
 *     console.log('New bid:', data);
 *   });
 *   
 *   return () => {
 *     socket.off('auction:new-bid');
 *   };
 * }, [socket]);
 * ```
 * 
 * Requirements: 16-21, NFR1.1
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import type { ServerToClientEvents, ClientToServerEvents } from '@/lib/socket/server';

type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  socket: SocketClient | null;
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook for managing Socket.io connection
 */
export function useSocket(): UseSocketReturn {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const socketRef = useRef<SocketClient | null>(null);

  useEffect(() => {
    // Don't connect if not authenticated
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    // Don't create multiple connections
    if (socketRef.current) {
      return;
    }

    // Validate access token format (should be a JWT)
    if (!session.accessToken.startsWith('eyJ')) {
      console.error('Invalid access token format. Expected JWT.');
      setError(new Error('Invalid access token format'));
      return;
    }

    // Get Socket.io URL from environment or default to current origin
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;

    // Create Socket.io client
    const newSocket: SocketClient = io(socketUrl, {
      auth: {
        token: session.accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket.io connected');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.io disconnected:', reason);
      setIsConnected(false);

      // Attempt to reconnect if disconnected unexpectedly
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket.io connection error:', err);
      setError(err);
      setIsConnected(false);
    });

    // Store socket reference
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 Disconnecting Socket.io');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [session?.accessToken, status]);

  return { socket, isConnected, error };
}

/**
 * Hook for watching an auction
 */
export function useAuctionWatch(auctionId: string | null) {
  const { socket, isConnected } = useSocket();
  const [watchingCount, setWatchingCount] = useState(0);

  useEffect(() => {
    if (!socket || !isConnected || !auctionId) {
      return;
    }

    // Start watching auction
    socket.emit('auction:watch', { auctionId });

    // Listen for watching count updates
    const handleWatchingCount = (data: { auctionId: string; count: number }) => {
      if (data.auctionId === auctionId) {
        setWatchingCount(data.count);
      }
    };

    socket.on('auction:watching-count', handleWatchingCount);

    // Stop watching on unmount
    return () => {
      socket.emit('auction:unwatch', { auctionId });
      socket.off('auction:watching-count', handleWatchingCount);
    };
  }, [socket, isConnected, auctionId]);

  return { watchingCount };
}

/**
 * Hook for listening to auction updates
 */
export function useAuctionUpdates(auctionId: string | null) {
  const { socket, isConnected } = useSocket();
  const [auction, setAuction] = useState<any>(null);
  const [latestBid, setLatestBid] = useState<any>(null);
  const [isExtended, setIsExtended] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    if (!socket || !isConnected || !auctionId) {
      return;
    }

    // Listen for auction updates
    const handleAuctionUpdate = (data: { auctionId: string; auction: any }) => {
      if (data.auctionId === auctionId) {
        setAuction(data.auction);
      }
    };

    const handleNewBid = (data: { auctionId: string; bid: any }) => {
      if (data.auctionId === auctionId) {
        setLatestBid(data.bid);
      }
    };

    const handleExtension = (data: { auctionId: string; newEndTime: Date }) => {
      if (data.auctionId === auctionId) {
        setIsExtended(true);
        // Reset after 5 seconds
        setTimeout(() => setIsExtended(false), 5000);
      }
    };

    const handleClosure = (data: { auctionId: string; winnerId: string }) => {
      if (data.auctionId === auctionId) {
        setIsClosed(true);
      }
    };

    socket.on('auction:updated', handleAuctionUpdate);
    socket.on('auction:new-bid', handleNewBid);
    socket.on('auction:extended', handleExtension);
    socket.on('auction:closed', handleClosure);

    return () => {
      socket.off('auction:updated', handleAuctionUpdate);
      socket.off('auction:new-bid', handleNewBid);
      socket.off('auction:extended', handleExtension);
      socket.off('auction:closed', handleClosure);
    };
  }, [socket, isConnected, auctionId]);

  return { auction, latestBid, isExtended, isClosed };
}

/**
 * Hook for vendor notifications
 */
export function useVendorNotifications() {
  const { socket, isConnected } = useSocket();
  const [outbidNotification, setOutbidNotification] = useState<{
    auctionId: string;
    newBid: number;
  } | null>(null);
  const [wonNotification, setWonNotification] = useState<{
    auctionId: string;
    amount: number;
  } | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handleOutbid = (data: { auctionId: string; newBid: number }) => {
      setOutbidNotification(data);
      // Clear after 10 seconds
      setTimeout(() => setOutbidNotification(null), 10000);
    };

    const handleWon = (data: { auctionId: string; amount: number }) => {
      setWonNotification(data);
      // Clear after 30 seconds
      setTimeout(() => setWonNotification(null), 30000);
    };

    socket.on('vendor:outbid', handleOutbid);
    socket.on('vendor:won', handleWon);

    return () => {
      socket.off('vendor:outbid', handleOutbid);
      socket.off('vendor:won', handleWon);
    };
  }, [socket, isConnected]);

  return { outbidNotification, wonNotification };
}
