/**
 * Schema New Asset Type Event Emitter
 * Task 8.1.5: Implement schema:new_asset_type event emission
 * 
 * Emits new asset type detection events to admins for review.
 */

import { getSocketServer } from '@/lib/socket/server';

export interface SchemaNewAssetTypePayload {
  assetType: string;
  firstSeenAt: Date;
  sampleAuctionId: string;
  requiresReview: boolean;
}

/**
 * Emit new asset type detection event to admins
 * 
 * @param assetType - Name of the new asset type detected
 * @param firstSeenAt - Timestamp when first detected
 * @param sampleAuctionId - UUID of a sample auction with this asset type
 * @param requiresReview - Whether manual review is required
 */
export async function emitSchemaNewAssetType(
  assetType: string,
  firstSeenAt: Date,
  sampleAuctionId: string,
  requiresReview: boolean
): Promise<void> {
  const io = getSocketServer();
  
  if (!io) {
    console.warn('Socket.IO server not initialized - cannot emit schema:new_asset_type');
    return;
  }

  const payload: SchemaNewAssetTypePayload = {
    assetType,
    firstSeenAt,
    sampleAuctionId,
    requiresReview,
  };

  try {
    console.log(`📊 Emitting schema:new_asset_type to admin room for asset type: ${assetType}`);
    // Emit to admins for review
    io.to('admin').emit('schema:new_asset_type', payload);
    console.log(`✅ Schema new asset type event emitted successfully (${assetType})`);
  } catch (error) {
    console.error(`❌ Failed to emit schema:new_asset_type for ${assetType}:`, error);
  }
}
