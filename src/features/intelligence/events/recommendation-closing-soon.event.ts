/**
 * Recommendation Closing Soon Event Emitter
 * Task 8.1.3: Implement recommendation:closing_soon event emission
 * 
 * Emits closing soon alerts for recommended auctions (< 1 hour remaining).
 */

import { getSocketServer } from '@/lib/socket/server';

export interface RecommendationClosingSoonPayload {
  vendorId: string;
  auctionId: string;
  timeRemaining: number; // minutes
  currentBid: number;
  matchScore: number;
  timestamp: Date;
}

/**
 * Emit closing soon event to specific vendor
 * 
 * @param vendorId - UUID of the vendor
 * @param auctionId - UUID of the auction
 * @param timeRemaining - Minutes remaining until auction closes
 * @param currentBid - Current bid amount
 * @param matchScore - Recommendation match score
 */
export async function emitRecommendationClosingSoon(
  vendorId: string,
  auctionId: string,
  timeRemaining: number,
  currentBid: number,
  matchScore: number
): Promise<void> {
  const io = getSocketServer();
  
  if (!io) {
    console.warn('Socket.IO server not initialized - cannot emit recommendation:closing_soon');
    return;
  }

  const payload: RecommendationClosingSoonPayload = {
    vendorId,
    auctionId,
    timeRemaining,
    currentBid,
    matchScore,
    timestamp: new Date(),
  };

  try {
    console.log(`📢 Emitting recommendation:closing_soon to vendor:${vendorId} for auction ${auctionId} (${timeRemaining} min remaining)`);
    io.to(`vendor:${vendorId}`).emit('recommendation:closing_soon', payload);
    console.log(`✅ Closing soon notification emitted successfully to vendor ${vendorId}`);
  } catch (error) {
    console.error(`❌ Failed to emit recommendation:closing_soon for vendor ${vendorId}:`, error);
  }
}
