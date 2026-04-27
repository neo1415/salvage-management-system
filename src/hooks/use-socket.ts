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
  connectionMethod: 'websocket' | 'polling' | 'disconnected';
}

/**
 * Hook for managing Socket.io connection
 */
export function useSocket(): UseSocketReturn {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'websocket' | 'polling' | 'disconnected'>('disconnected');
  const socketRef = useRef<SocketClient | null>(null);
  const isConnectingRef = useRef(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't connect if not authenticated
    if (status !== 'authenticated' || !session?.accessToken) {
      return;
    }

    // Don't create multiple connections
    if (socketRef.current || isConnectingRef.current) {
      return;
    }

    // Validate access token format (should be a JWT)
    if (!session.accessToken.startsWith('eyJ')) {
      console.error('Invalid access token format. Expected JWT.');
      setError(new Error('Invalid access token format'));
      return;
    }

    // Mark as connecting to prevent duplicate connections
    isConnectingRef.current = true;

    // Get Socket.io URL from environment or default to current origin
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;

    // Create Socket.io client with exponential backoff
    const newSocket: SocketClient = io(socketUrl, {
      auth: {
        token: session.accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Increased from 5000 to 10000
      timeout: 20000,
      randomizationFactor: 0.5, // Add jitter to prevent thundering herd
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket.io connected');
      console.log(`   - Transport: ${newSocket.io.engine.transport.name}`);
      console.log(`   - Socket ID: ${newSocket.id}`);
      setIsConnected(true);
      setConnectionMethod(newSocket.io.engine.transport.name === 'websocket' ? 'websocket' : 'polling');
      setError(null);
      isConnectingRef.current = false;
      
      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.io disconnected:', reason);
      console.log(`   - Reason: ${reason}`);
      setIsConnected(false);
      setConnectionMethod('disconnected');

      // Only attempt manual reconnect if server initiated disconnect
      // Socket.io will handle automatic reconnection for other cases
      if (reason === 'io server disconnect') {
        // Add delay before reconnecting to prevent rapid reconnection
        setTimeout(() => {
          if (socketRef.current && !socketRef.current.connected) {
            console.log('🔄 Attempting manual reconnection...');
            newSocket.connect();
          }
        }, 2000);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('❌ Socket.io connection error:', err);
      console.error(`   - Error message: ${err.message}`);
      setError(err);
      setIsConnected(false);
      setConnectionMethod('disconnected');
      isConnectingRef.current = false;
    });

    // Set connection timeout - if not connected after 10 seconds, log warning
    connectionTimeoutRef.current = setTimeout(() => {
      if (!newSocket.connected) {
        console.warn('⚠️  Socket.io connection timeout after 10 seconds');
        console.warn('   - Connection may be blocked or server may be unavailable');
        console.warn('   - Polling fallback will be used if available');
      }
    }, 10000);

    // Store socket reference
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      if (socketRef.current) {
        console.log('🔌 Disconnecting Socket.io');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setConnectionMethod('disconnected');
        isConnectingRef.current = false;
      }
    };
  }, [session?.accessToken, status]);

  return { socket, isConnected, error, connectionMethod };
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

    console.log(`👁️  Joining auction room: auction:${auctionId}`);
    
    // Start watching auction
    socket.emit('auction:watch', { auctionId });

    // Listen for watching count updates
    const handleWatchingCount = (data: { auctionId: string; count: number }) => {
      if (data.auctionId === auctionId) {
        console.log(`👥 Watching count updated for auction ${auctionId}: ${data.count}`);
        setWatchingCount(data.count);
      }
    };

    socket.on('auction:watching-count', handleWatchingCount);

    // Stop watching on unmount
    return () => {
      console.log(`👁️  Leaving auction room: auction:${auctionId}`);
      socket.emit('auction:unwatch', { auctionId });
      socket.off('auction:watching-count', handleWatchingCount);
    };
  }, [socket, isConnected, auctionId]);

  return { watchingCount };
}

/**
 * Hook for listening to auction updates with polling fallback
 * 
 * Primary: Uses WebSocket for real-time updates
 * Fallback: Uses polling API if WebSocket fails after 10 seconds
 */
export function useAuctionUpdates(auctionId: string | null) {
  const { socket, isConnected, connectionMethod } = useSocket();
  const [auction, setAuction] = useState<any>(null);
  const [latestBid, setLatestBid] = useState<any>(null);
  const [isExtended, setIsExtended] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [usingPolling, setUsingPolling] = useState(false);
  
  // NEW: Document generation tracking
  const [isClosing, setIsClosing] = useState(false);
  const [documentsGenerating, setDocumentsGenerating] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<string[]>([]);
  
  // Track last processed event IDs to prevent duplicate processing
  const lastBidIdRef = useRef<string | null>(null);
  const lastAuctionUpdateRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEtagRef = useRef<string | null>(null);

  // CRITICAL FIX: Use useRef to store stable handler functions
  // This prevents listener re-registration on every render
  const handlersRef = useRef({
    handleAuctionUpdate: (data: { auctionId: string; auction: any }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction update for ${auctionId}`);
        console.log(`   - Status: ${data.auction.status}`);
        
        // Create a hash of the auction data to detect actual changes
        const updateHash = JSON.stringify({
          currentBid: data.auction.currentBid,
          status: data.auction.status,
          endTime: data.auction.endTime,
        });
        
        // Only update if data actually changed
        if (lastAuctionUpdateRef.current !== updateHash) {
          lastAuctionUpdateRef.current = updateHash;
          setAuction(data.auction);
          console.log(`✅ Auction state updated`);
        }
      }
    },
    
    handleNewBid: (data: { auctionId: string; bid: any }) => {
      console.log(`🔔 handleNewBid() CALLED!`);
      console.log(`   - Received auction ID: ${data.auctionId}`);
      console.log(`   - Expected auction ID: ${auctionId}`);
      console.log(`   - Match: ${data.auctionId === auctionId}`);
      console.log(`   - Bid data:`, JSON.stringify(data.bid, null, 2));
      
      // CRITICAL FIX: Only check auction ID match, not bid ID
      // The bid ID is the same for all clients, so checking it prevents other vendors from receiving updates
      // Instead, we rely on React's state management to handle updates correctly
      if (data.auctionId === auctionId) {
        console.log(`📡 Received new bid event for ${auctionId}`);
        console.log(`   - Bid amount: ₦${Number(data.bid.amount).toLocaleString()}`);
        console.log(`   - Vendor ID: ${data.bid.vendorId}`);
        console.log(`   - Bid ID: ${data.bid.id}`);
        
        // Update the latest bid - React will handle re-renders efficiently
        setLatestBid(data.bid);
        
        // Track the last bid ID for reference (but don't use it to block updates)
        lastBidIdRef.current = data.bid.id;
      } else {
        console.log(`❌ Auction ID mismatch - ignoring bid event`);
      }
    },
    
    handleExtension: (data: { auctionId: string; newEndTime: Date }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction extension for ${auctionId}`);
        console.log(`   - New end time: ${data.newEndTime}`);
        
        setIsExtended(true);
        // Reset after 5 seconds
        setTimeout(() => setIsExtended(false), 5000);
      }
    },
    
    handleClosure: (data: { auctionId: string; winnerId: string }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction closure for ${auctionId}`);
        console.log(`   - Winner ID: ${data.winnerId}`);
        
        setIsClosed(true);
        setIsClosing(false);
        setDocumentsGenerating(false);
      }
    },
    
    handleClosing: (data: { auctionId: string }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction closing for ${auctionId}`);
        console.log(`   - Documents are being generated...`);
        
        setIsClosing(true);
        setDocumentsGenerating(true);
        setGeneratedDocuments([]);
      }
    },
    
    handleDocumentGenerated: (data: {
      auctionId: string;
      documentType: string;
      documentId: string;
    }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received document generated for ${auctionId}`);
        console.log(`   - Document type: ${data.documentType}`);
        console.log(`   - Document ID: ${data.documentId}`);
        
        setGeneratedDocuments(prev => [...prev, data.documentType]);
      }
    },
    
    handleGenerationComplete: (data: {
      auctionId: string;
      totalDocuments: number;
    }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received document generation complete for ${auctionId}`);
        console.log(`   - Total documents: ${data.totalDocuments}`);
        
        setDocumentsGenerating(false);
      }
    },
  });

  // Update handlers when auctionId changes
  useEffect(() => {
    handlersRef.current.handleAuctionUpdate = (data: { auctionId: string; auction: any }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction update for ${auctionId}`);
        console.log(`   - Status: ${data.auction.status}`);
        
        const updateHash = JSON.stringify({
          currentBid: data.auction.currentBid,
          status: data.auction.status,
          endTime: data.auction.endTime,
        });
        
        if (lastAuctionUpdateRef.current !== updateHash) {
          lastAuctionUpdateRef.current = updateHash;
          setAuction(data.auction);
          console.log(`✅ Auction state updated`);
        }
      }
    };
    
    handlersRef.current.handleNewBid = (data: { auctionId: string; bid: any }) => {
      console.log(`🔔 handleNewBid() CALLED!`);
      console.log(`   - Received auction ID: ${data.auctionId}`);
      console.log(`   - Expected auction ID: ${auctionId}`);
      console.log(`   - Match: ${data.auctionId === auctionId}`);
      console.log(`   - Bid data:`, JSON.stringify(data.bid, null, 2));
      
      if (data.auctionId === auctionId) {
        console.log(`📡 Received new bid event for ${auctionId}`);
        console.log(`   - Bid amount: ₦${Number(data.bid.amount).toLocaleString()}`);
        console.log(`   - Vendor ID: ${data.bid.vendorId}`);
        console.log(`   - Bid ID: ${data.bid.id}`);
        
        setLatestBid(data.bid);
        lastBidIdRef.current = data.bid.id;
      } else {
        console.log(`❌ Auction ID mismatch - ignoring bid event`);
      }
    };
    
    handlersRef.current.handleExtension = (data: { auctionId: string; newEndTime: Date }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction extension for ${auctionId}`);
        console.log(`   - New end time: ${data.newEndTime}`);
        
        setIsExtended(true);
        setTimeout(() => setIsExtended(false), 5000);
      }
    };
    
    handlersRef.current.handleClosure = (data: { auctionId: string; winnerId: string }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction closure for ${auctionId}`);
        console.log(`   - Winner ID: ${data.winnerId}`);
        
        setIsClosed(true);
        setIsClosing(false);
        setDocumentsGenerating(false);
        
        // CRITICAL FIX: Update auction state with closed status
        // This ensures the UI reflects the closure immediately
        setAuction((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'closed',
            currentBidder: data.winnerId,
          };
        });
        console.log(`✅ Auction state updated to 'closed'`);
      }
    };
    
    handlersRef.current.handleClosing = (data: { auctionId: string }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received auction closing for ${auctionId}`);
        console.log(`   - Documents are being generated...`);
        
        setIsClosing(true);
        setDocumentsGenerating(true);
        setGeneratedDocuments([]);
      }
    };
    
    handlersRef.current.handleDocumentGenerated = (data: {
      auctionId: string;
      documentType: string;
      documentId: string;
    }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received document generated for ${auctionId}`);
        console.log(`   - Document type: ${data.documentType}`);
        console.log(`   - Document ID: ${data.documentId}`);
        
        setGeneratedDocuments(prev => [...prev, data.documentType]);
      }
    };
    
    handlersRef.current.handleGenerationComplete = (data: {
      auctionId: string;
      totalDocuments: number;
    }) => {
      if (data.auctionId === auctionId) {
        console.log(`📡 Received document generation complete for ${auctionId}`);
        console.log(`   - Total documents: ${data.totalDocuments}`);
        
        setDocumentsGenerating(false);
      }
    };
  }, [auctionId]);

  // Store wrapper functions in ref to prevent re-creation
  const wrappersRef = useRef<{
    auctionUpdate: ((data: { auctionId: string; auction: any }) => void) | null;
    newBid: ((data: { auctionId: string; bid: any }) => void) | null;
    extension: ((data: { auctionId: string; newEndTime: Date }) => void) | null;
    closure: ((data: { auctionId: string; winnerId: string }) => void) | null;
    closing: ((data: { auctionId: string }) => void) | null;
    documentGenerated: ((data: { auctionId: string; documentType: string; documentId: string }) => void) | null;
    generationComplete: ((data: { auctionId: string; totalDocuments: number }) => void) | null;
  }>({
    auctionUpdate: null,
    newBid: null,
    extension: null,
    closure: null,
    closing: null,
    documentGenerated: null,
    generationComplete: null,
  });

  // WebSocket event handlers - use stable function references
  useEffect(() => {
    if (!socket || !isConnected || !auctionId) {
      return;
    }

    console.log(`📡 Setting up WebSocket listeners for auction ${auctionId}`);
    console.log(`   - Socket ID: ${socket.id}`);
    console.log(`   - Is connected: ${isConnected}`);
    console.log(`   - Registering listener for: 'auction:new-bid'`);

    // CRITICAL: Create wrapper functions ONCE and store in ref
    // This ensures the same function reference is used across HMR reloads
    if (!wrappersRef.current.auctionUpdate) {
      wrappersRef.current.auctionUpdate = (data: { auctionId: string; auction: any }) => handlersRef.current.handleAuctionUpdate(data);
    }
    if (!wrappersRef.current.newBid) {
      wrappersRef.current.newBid = (data: { auctionId: string; bid: any }) => handlersRef.current.handleNewBid(data);
    }
    if (!wrappersRef.current.extension) {
      wrappersRef.current.extension = (data: { auctionId: string; newEndTime: Date }) => handlersRef.current.handleExtension(data);
    }
    if (!wrappersRef.current.closure) {
      wrappersRef.current.closure = (data: { auctionId: string; winnerId: string }) => handlersRef.current.handleClosure(data);
    }
    if (!wrappersRef.current.closing) {
      wrappersRef.current.closing = (data: { auctionId: string }) => handlersRef.current.handleClosing(data);
    }
    if (!wrappersRef.current.documentGenerated) {
      wrappersRef.current.documentGenerated = (data: { auctionId: string; documentType: string; documentId: string }) => handlersRef.current.handleDocumentGenerated(data);
    }
    if (!wrappersRef.current.generationComplete) {
      wrappersRef.current.generationComplete = (data: { auctionId: string; totalDocuments: number }) => handlersRef.current.handleGenerationComplete(data);
    }

    // Remove any existing listeners first (in case of HMR)
    socket.off('auction:updated', wrappersRef.current.auctionUpdate);
    socket.off('auction:new-bid', wrappersRef.current.newBid);
    socket.off('auction:extended', wrappersRef.current.extension);
    socket.off('auction:closed', wrappersRef.current.closure);
    socket.off('auction:closing', wrappersRef.current.closing);
    socket.off('auction:document-generated', wrappersRef.current.documentGenerated);
    socket.off('auction:document-generation-complete', wrappersRef.current.generationComplete);

    // Register listeners with stable references
    socket.on('auction:updated', wrappersRef.current.auctionUpdate);
    socket.on('auction:new-bid', wrappersRef.current.newBid);
    socket.on('auction:extended', wrappersRef.current.extension);
    socket.on('auction:closed', wrappersRef.current.closure);
    socket.on('auction:closing', wrappersRef.current.closing);
    socket.on('auction:document-generated', wrappersRef.current.documentGenerated);
    socket.on('auction:document-generation-complete', wrappersRef.current.generationComplete);

    console.log(`✅ Event listeners registered for auction ${auctionId}`);
    console.log(`   - Listeners: auction:updated, auction:new-bid, auction:extended, auction:closed, auction:closing, auction:document-generated, auction:document-generation-complete`);

    return () => {
      console.log(`🧹 Cleaning up event listeners for auction ${auctionId}`);
      // Don't remove listeners on cleanup - they persist across HMR
      // Only remove when socket/auctionId actually changes
    };
  }, [socket, isConnected, auctionId]);

  // CHANGED: Use polling as PRIMARY method (not fallback)
  // Socket.IO is kept for future use but polling is more reliable for now
  useEffect(() => {
    if (!auctionId) {
      return;
    }

    // Always use polling as primary method
    console.log('🔄 Using polling as primary update method');
    setUsingPolling(true);

    // Cleanup
    return () => {
      if (pollingFallbackTimeoutRef.current) {
        clearTimeout(pollingFallbackTimeoutRef.current);
        pollingFallbackTimeoutRef.current = null;
      }
    };
  }, [auctionId]);

  // Polling implementation
  useEffect(() => {
    if (!usingPolling || !auctionId) {
      return;
    }

    console.log(`🔄 Starting polling fallback for auction ${auctionId}`);
    console.log('   - Polling every 3 seconds');

    const pollAuction = async () => {
      try {
        const headers: HeadersInit = {};
        if (lastEtagRef.current) {
          headers['If-None-Match'] = lastEtagRef.current;
        }

        const response = await fetch(`/api/auctions/${auctionId}/poll`, {
          headers,
        });

        // 304 Not Modified - no changes
        if (response.status === 304) {
          console.log(`📊 Poll: No changes for auction ${auctionId}`);
          return;
        }

        // 429 Rate Limited - wait and retry
        if (response.status === 429) {
          const data = await response.json();
          console.warn(`⚠️  Rate limited. Retry after ${data.retryAfter}s`);
          return;
        }

        if (!response.ok) {
          console.error(`❌ Polling failed: ${response.status}`);
          return;
        }

        // Update ETag
        const etag = response.headers.get('etag');
        if (etag) {
          lastEtagRef.current = etag;
        }

        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          
          console.log(`📊 Poll: Auction ${auctionId} updated`);
          console.log(`   - Current bid: ₦${data.currentBid?.toLocaleString() || 'None'}`);
          console.log(`   - Status: ${data.status}`);

          // Update auction state
          setAuction({
            currentBid: data.currentBid?.toString(),
            currentBidder: data.currentBidder,
            status: data.status,
            endTime: data.endTime,
            hasVerifiedPayment: data.hasVerifiedPayment,
          });

          // If there's a new bid, update latestBid
          if (data.currentBid && data.currentBidder) {
            const bidHash = `${data.currentBid}-${data.currentBidder}`;
            if (lastBidIdRef.current !== bidHash) {
              lastBidIdRef.current = bidHash;
              setLatestBid({
                id: bidHash,
                amount: data.currentBid,
                vendorId: data.currentBidder,
                minimumBid: data.minimumBid,
              });
            }
          }

          // Check if auction closed
          if (data.status === 'closed' && !isClosed) {
            setIsClosed(true);
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    };

    // Poll immediately
    pollAuction();

    // Then poll every 2 seconds (faster updates)
    pollingIntervalRef.current = setInterval(pollAuction, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        console.log(`🛑 Stopping polling for auction ${auctionId}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [usingPolling, auctionId, isClosed]);

  return { auction, latestBid, isExtended, isClosed, usingPolling, isClosing, documentsGenerating, generatedDocuments };
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

/**
 * Hook for real-time notifications
 * Listens for new notifications via Socket.IO
 */
export function useRealtimeNotifications() {
  const { socket, isConnected } = useSocket();
  const [newNotification, setNewNotification] = useState<any>(null);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    console.log('📬 Setting up real-time notification listener');

    const handleNewNotification = (notification: any) => {
      console.log('📬 New notification received:', notification);
      setNewNotification(notification);
      
      // Clear after 5 seconds to allow next notification
      setTimeout(() => setNewNotification(null), 5000);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      console.log('🧹 Cleaning up notification listener');
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, isConnected]);

  return { newNotification };
}
