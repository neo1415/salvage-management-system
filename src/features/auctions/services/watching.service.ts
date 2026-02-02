/**
 * Auction Watching Service
 * 
 * Tracks vendors viewing auctions and manages watching counts.
 * Implements real-time watching count updates via Socket.io.
 * 
 * Features:
 * - Track vendors viewing auction >10 seconds
 * - Increment/decrement watching count
 * - Broadcast updated count via Socket.io
 * - Anonymize vendor names for privacy
 * - Use Redis for distributed tracking
 * 
 * Requirements: 20, Enterprise Standards Section 5
 */

import { kv } from '@vercel/kv';
import { getSocketServer } from '@/lib/socket/server';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

// Redis key prefixes
const WATCHING_KEY_PREFIX = 'auction:watching:';
const VIEWER_KEY_PREFIX = 'auction:viewer:';

// Watching timeout (10 seconds)
const WATCHING_THRESHOLD_MS = 10000;

/**
 * Track vendor viewing an auction
 * Increments watching count after 10 seconds of viewing
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID
 * @param userId - User ID for audit logging
 * @returns Updated watching count
 */
export async function trackAuctionView(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<number> {
  try {
    const viewerKey = `${VIEWER_KEY_PREFIX}${auctionId}:${vendorId}`;

    // Check if vendor is already being tracked
    const existingTimestamp = await kv.get<number>(viewerKey);

    if (!existingTimestamp) {
      // Store timestamp when vendor started viewing
      const timestamp = Date.now();
      await kv.set(viewerKey, timestamp, { ex: 300 }); // 5 minute expiry

      // Schedule watching count increment after 10 seconds
      setTimeout(async () => {
        await incrementWatchingCount(auctionId, vendorId, userId);
      }, WATCHING_THRESHOLD_MS);
    }

    // Return current watching count
    return await getWatchingCount(auctionId);
  } catch (error) {
    console.error('Error tracking auction view:', error);
    throw new Error('Failed to track auction view');
  }
}

/**
 * Increment watching count for an auction
 * Called after vendor has viewed auction for >10 seconds
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID
 * @param userId - User ID for audit logging
 * @returns Updated watching count
 */
export async function incrementWatchingCount(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<number> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;
    const viewerKey = `${VIEWER_KEY_PREFIX}${auctionId}:${vendorId}`;

    // Check if vendor has been viewing for at least 10 seconds
    const viewStartTime = await kv.get<number>(viewerKey);
    if (!viewStartTime) {
      return await getWatchingCount(auctionId);
    }

    const viewDuration = Date.now() - viewStartTime;
    if (viewDuration < WATCHING_THRESHOLD_MS) {
      return await getWatchingCount(auctionId);
    }

    // Add vendor to watching set
    await kv.sadd(watchingKey, vendorId);

    // Set expiry on watching set (1 hour)
    await kv.expire(watchingKey, 3600);

    // Get updated count
    const count = await getWatchingCount(auctionId);

    // Broadcast updated count via Socket.io
    await broadcastWatchingCount(auctionId, count);

    // Log action
    await logAction({
      userId,
      actionType: AuditActionType.AUCTION_CREATED, // Using closest available action type
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      afterState: {
        vendorId,
        watchingCount: count,
        action: 'watching_incremented',
      },
    });

    return count;
  } catch (error) {
    console.error('Error incrementing watching count:', error);
    throw new Error('Failed to increment watching count');
  }
}

/**
 * Decrement watching count for an auction
 * Called when vendor stops viewing auction
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID
 * @param userId - User ID for audit logging
 * @returns Updated watching count
 */
export async function decrementWatchingCount(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<number> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;
    const viewerKey = `${VIEWER_KEY_PREFIX}${auctionId}:${vendorId}`;

    // Remove vendor from watching set
    await kv.srem(watchingKey, vendorId);

    // Remove viewer tracking
    await kv.del(viewerKey);

    // Get updated count
    const count = await getWatchingCount(auctionId);

    // Broadcast updated count via Socket.io
    await broadcastWatchingCount(auctionId, count);

    // Log action
    await logAction({
      userId,
      actionType: AuditActionType.AUCTION_CREATED, // Using closest available action type
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      afterState: {
        vendorId,
        watchingCount: count,
        action: 'watching_decremented',
      },
    });

    return count;
  } catch (error) {
    console.error('Error decrementing watching count:', error);
    throw new Error('Failed to decrement watching count');
  }
}

/**
 * Get current watching count for an auction
 * 
 * @param auctionId - Auction ID
 * @returns Number of vendors watching
 */
export async function getWatchingCount(auctionId: string): Promise<number> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;

    // Get size of watching set
    const count = await kv.scard(watchingKey);

    return count || 0;
  } catch (error) {
    console.error('Error getting watching count:', error);
    return 0;
  }
}

/**
 * Get anonymized list of vendors watching an auction
 * Returns anonymized identifiers (Vendor A, Vendor B, etc.)
 * 
 * @param auctionId - Auction ID
 * @returns Array of anonymized vendor identifiers
 */
export async function getAnonymizedWatchers(auctionId: string): Promise<string[]> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;

    // Get all vendor IDs watching
    const vendorIds = await kv.smembers(watchingKey);

    if (!vendorIds || vendorIds.length === 0) {
      return [];
    }

    // Anonymize vendor IDs
    const anonymized = vendorIds.map((_, index) => {
      const letter = String.fromCharCode(65 + index); // A, B, C, etc.
      return `Vendor ${letter}`;
    });

    return anonymized;
  } catch (error) {
    console.error('Error getting anonymized watchers:', error);
    return [];
  }
}

/**
 * Check if a specific vendor is watching an auction
 * 
 * @param auctionId - Auction ID
 * @param vendorId - Vendor ID
 * @returns True if vendor is watching
 */
export async function isVendorWatching(
  auctionId: string,
  vendorId: string
): Promise<boolean> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;

    // Check if vendor is in watching set
    const isMember = await kv.sismember(watchingKey, vendorId);

    return isMember === 1;
  } catch (error) {
    console.error('Error checking if vendor is watching:', error);
    return false;
  }
}

/**
 * Broadcast watching count update via Socket.io
 * 
 * @param auctionId - Auction ID
 * @param count - Updated watching count
 */
async function broadcastWatchingCount(
  auctionId: string,
  count: number
): Promise<void> {
  try {
    const io = getSocketServer();

    if (!io) {
      console.warn('Socket.io server not initialized, skipping broadcast');
      return;
    }

    // Broadcast to all viewers in auction room
    io.to(`auction:${auctionId}`).emit('auction:watching-count', {
      auctionId,
      count,
    });

    console.log(`📢 Broadcasted watching count for auction ${auctionId}: ${count}`);
  } catch (error) {
    console.error('Error broadcasting watching count:', error);
  }
}

/**
 * Clean up expired viewer tracking
 * Should be called periodically (e.g., via cron job)
 * 
 * @param auctionId - Auction ID
 */
export async function cleanupExpiredViewers(auctionId: string): Promise<void> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;

    // Get all vendor IDs in watching set
    const vendorIds = await kv.smembers(watchingKey);

    if (!vendorIds || vendorIds.length === 0) {
      return;
    }

    // Check each vendor's viewer tracking
    for (const vendorId of vendorIds) {
      const viewerKey = `${VIEWER_KEY_PREFIX}${auctionId}:${vendorId}`;
      const viewStartTime = await kv.get<number>(viewerKey);

      // If viewer tracking expired, remove from watching set
      if (!viewStartTime) {
        await kv.srem(watchingKey, vendorId);
      }
    }

    // Get updated count and broadcast
    const count = await getWatchingCount(auctionId);
    await broadcastWatchingCount(auctionId, count);
  } catch (error) {
    console.error('Error cleaning up expired viewers:', error);
  }
}

/**
 * Reset watching count for an auction
 * Useful when auction closes or is cancelled
 * 
 * @param auctionId - Auction ID
 */
export async function resetWatchingCount(auctionId: string): Promise<void> {
  try {
    const watchingKey = `${WATCHING_KEY_PREFIX}${auctionId}`;

    // Get all vendor IDs to clean up viewer tracking
    const vendorIds = await kv.smembers(watchingKey);

    if (vendorIds && vendorIds.length > 0) {
      // Remove all viewer tracking
      for (const vendorId of vendorIds) {
        const viewerKey = `${VIEWER_KEY_PREFIX}${auctionId}:${vendorId}`;
        await kv.del(viewerKey);
      }
    }

    // Delete watching set
    await kv.del(watchingKey);

    // Broadcast zero count
    await broadcastWatchingCount(auctionId, 0);

    console.log(`🧹 Reset watching count for auction ${auctionId}`);
  } catch (error) {
    console.error('Error resetting watching count:', error);
  }
}
