/**
 * Bid Change Trigger
 * Task 8.2.1: Implement prediction recalculation on significant bid changes (>10%)
 * 
 * Monitors bid changes and triggers prediction recalculation when changes exceed threshold.
 */

import { PredictionService } from '../services/prediction.service';
import { emitPredictionUpdated } from '../events/prediction-updated.event';

/**
 * Handle bid change and recalculate prediction if significant
 * 
 * @param auctionId - UUID of the auction
 * @param oldBid - Previous bid amount
 * @param newBid - New bid amount
 */
export async function handleBidChange(
  auctionId: string,
  oldBid: number,
  newBid: number
): Promise<void> {
  try {
    // Check if change is significant (>10%)
    const percentChange = Math.abs((newBid - oldBid) / oldBid) * 100;
    
    console.log(`📊 Bid change detected for auction ${auctionId}: ${oldBid} → ${newBid} (${percentChange.toFixed(2)}% change)`);
    
    if (percentChange >= 10) {
      console.log(`🔄 Significant bid change (${percentChange.toFixed(2)}%) - recalculating prediction`);
      
      // Recalculate prediction
      const predictionService = new PredictionService();
      const newPrediction = await predictionService.generatePrediction(auctionId);
      
      console.log(`✅ Prediction recalculated: ₦${newPrediction.predictedPrice.toLocaleString()} (confidence: ${(newPrediction.confidenceScore * 100).toFixed(1)}%)`);
      
      // Emit update to all watchers
      await emitPredictionUpdated(auctionId, {
        predictedPrice: newPrediction.predictedPrice,
        confidence: newPrediction.confidenceScore,
        priceRange: {
          min: newPrediction.lowerBound,
          max: newPrediction.upperBound,
        },
        factors: newPrediction.metadata?.notes?.map((note, index) => ({
          factor: note,
          impact: index === 0 ? 0.3 : 0.2, // Placeholder impact values
        })),
      });
      
      console.log(`📢 Prediction update broadcast to auction watchers`);
    } else {
      console.log(`⏭️ Bid change not significant (${percentChange.toFixed(2)}%) - skipping recalculation`);
    }
  } catch (error) {
    console.error(`❌ Error handling bid change for auction ${auctionId}:`, error);
    // Don't throw - bid placement should succeed even if prediction fails
  }
}

/**
 * Check if prediction should be recalculated based on bid activity
 * 
 * @param auctionId - UUID of the auction
 * @param bidCount - Total number of bids
 * @returns Whether prediction should be recalculated
 */
export function shouldRecalculatePrediction(
  auctionId: string,
  bidCount: number
): boolean {
  // Recalculate at specific bid milestones
  const milestones = [5, 10, 20, 50, 100];
  return milestones.includes(bidCount);
}
