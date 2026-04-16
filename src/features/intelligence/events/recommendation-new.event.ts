/**
 * Recommendation New Event Emitter
 * Task 8.1.2: Implement recommendation:new event emission
 * 
 * Emits new recommendation events to specific vendors with rate limiting.
 */

import { getSocketServer } from '@/lib/socket/server';
import { redis } from '@/lib/cache/redis';

export interface RecommendationNewPayload {
  vendorId: string;
  recommendation: {
    auctionId: string;
    matchScore: number;
    reasonCodes: string[];
    auction: {
      title: string;
      currentBid: number;
      endTime: Date;
    };
  };
  timestamp: Date;
}

/**
 * Check if vendor can receive notification (rate limiting: 5 per day)
 */
async function canSendNotification(vendorId: string): Promise<boolean> {
  const key = `notification:count:${vendorId}`;
  
  try {
    const count = await redis.get(key);
    
    if (!count) {
      // First notification today
      await redis.set(key, '1', { ex: 86400 }); // 24 hours
      return true;
    }
    
    const currentCount = parseInt(count);
    if (currentCount >= 5) {
      console.log(`⚠️ Rate limit exceeded for vendor ${vendorId} (${currentCount}/5 notifications today)`);
      return false; // Rate limit exceeded
    }
    
    await redis.incr(key);
    return true;
  } catch (error) {
    console.error('Error checking notification rate limit:', error);
    // Allow notification on error to avoid blocking
    return true;
  }
}

/**
 * Emit new recommendation event to specific vendor
 * 
 * @param vendorId - UUID of the vendor
 * @param recommendation - Recommendation result data
 */
export async function emitRecommendationNew(
  vendorId: string,
  recommendation: {
    auctionId: string;
    matchScore: number;
    reasonCodes: string[];
    auction: {
      title: string;
      currentBid: number;
      endTime: Date;
    };
  }
): Promise<void> {
  const io = getSocketServer();
  
  if (!io) {
    console.warn('Socket.IO server not initialized - cannot emit recommendation:new');
    return;
  }

  // Check rate limiting
  const canSend = await canSendNotification(vendorId);
  if (!canSend) {
    console.log(`⚠️ Skipping recommendation notification for vendor ${vendorId} due to rate limit`);
    return;
  }

  const payload: RecommendationNewPayload = {
    vendorId,
    recommendation: {
      auctionId: recommendation.auctionId,
      matchScore: recommendation.matchScore,
      reasonCodes: recommendation.reasonCodes,
      auction: {
        title: recommendation.auction.title,
        currentBid: recommendation.auction.currentBid,
        endTime: recommendation.auction.endTime,
      },
    },
    timestamp: new Date(),
  };

  try {
    console.log(`📢 Emitting recommendation:new to vendor:${vendorId} for auction ${recommendation.auctionId}`);
    io.to(`vendor:${vendorId}`).emit('recommendation:new', payload);
    console.log(`✅ Recommendation notification emitted successfully to vendor ${vendorId}`);
  } catch (error) {
    console.error(`❌ Failed to emit recommendation:new for vendor ${vendorId}:`, error);
  }
}
