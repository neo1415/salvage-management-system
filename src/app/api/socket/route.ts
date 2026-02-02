/**
 * Socket.io API Route
 * 
 * Integrates Socket.io with Next.js App Router.
 * This route initializes the Socket.io server and attaches it to the HTTP server.
 * 
 * Requirements: 16-21, NFR1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSocketServer } from '@/lib/socket/server';

/**
 * GET /api/socket
 * 
 * Returns Socket.io connection information
 */
export async function GET(_request: NextRequest) {
  try {
    const socketServer = getSocketServer();

    if (!socketServer) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'SOCKET_NOT_INITIALIZED',
            message: 'Socket.io server not initialized',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 503 }
      );
    }

    // Get connection stats
    const sockets = await socketServer.fetchSockets();
    const connectedUsers = sockets.length;

    return NextResponse.json({
      status: 'success',
      data: {
        initialized: true,
        connectedUsers,
        endpoint: process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3000',
        transports: ['websocket', 'polling'],
      },
    });
  } catch (error) {
    console.error('Error fetching Socket.io status:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch Socket.io status',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/socket
 * 
 * Initialize Socket.io server (for development/testing)
 */
export async function POST(_request: NextRequest) {
  try {
    // Check if already initialized
    const existingServer = getSocketServer();
    if (existingServer) {
      return NextResponse.json({
        status: 'success',
        data: {
          message: 'Socket.io server already initialized',
          initialized: true,
        },
      });
    }

    // Note: In Next.js App Router, we can't directly access the HTTP server
    // Socket.io initialization should happen in server.ts or custom server
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INITIALIZATION_ERROR',
          message: 'Socket.io must be initialized in custom server or server.ts',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error initializing Socket.io:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to initialize Socket.io server',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
