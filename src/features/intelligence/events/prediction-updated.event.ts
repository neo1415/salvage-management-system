/**
 * Prediction Updated Event Emitter
 * Task 8.1.1: Implement prediction:updated event emission
 * 
 * Emits real-time prediction updates to vendors watching specific auctions
 * or to all watchers in an auction room.
 */

import { getSocketServer } from '@/lib/socket/server';

export interface PredictionUpdatePayload {
  auctionId: string;
  prediction: {
    predictedPrice: number;
    confidence: number;
    priceRange: { min: number; max: number };
    factors?: Array<{ factor: string; impact: number }>;
  };
  timestamp: Date;
}

/**
 * Emit prediction updated event to specific vendors or auction room
 * 
 * @param auctionId - UUID of the auction
 * @param prediction - Prediction result data
 * @param vendorIds - Optional array of vendor IDs to target (if not provided, broadcasts to auction room)
 */
export async function emitPredictionUpdated(
  auctionId: string,
  prediction: {
    predictedPrice: number;
    confidence: number;
    priceRange: { min: number; max: number };
    factors?: Array<{ factor: string; impact: number }>;
  },
  vendorIds?: string[]
): Promise<void> {
  const io = getSocketServer();
  
  if (!io) {
    console.warn('Socket.IO server not initialized - cannot emit prediction:updated');
    return;
  }

  const payload: PredictionUpdatePayload = {
    auctionId,
    prediction: {
      predictedPrice: prediction.predictedPrice,
      confidence: prediction.confidence,
      priceRange: prediction.priceRange,
      factors: prediction.factors,
    },
    timestamp: new Date(),
  };

  try {
    if (vendorIds && vendorIds.length > 0) {
      // Emit to specific vendors
      console.log(`📢 Emitting prediction:updated to ${vendorIds.length} vendor(s) for auction ${auctionId}`);
      vendorIds.forEach(vendorId => {
        io.to(`vendor:${vendorId}`).emit('prediction:updated', payload);
      });
    } else {
      // Emit to auction room (all watchers)
      console.log(`📢 Emitting prediction:updated to auction room: auction:${auctionId}`);
      io.to(`auction:${auctionId}`).emit('prediction:updated', payload);
    }
    
    console.log(`✅ Prediction update emitted successfully for auction ${auctionId}`);
  } catch (error) {
    console.error(`❌ Failed to emit prediction:updated for auction ${auctionId}:`, error);
  }
}
