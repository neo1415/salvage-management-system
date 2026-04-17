import { db } from '@/lib/db';
import { vendorInteractions, vendorRecommendations } from '@/lib/db/schema/fraud-tracking';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface VendorPreferences {
  preferredAssetTypes: string[];
  minPrice: number;
  maxPrice: number;
  preferredConditions: string[];
  location?: { latitude: number; longitude: number };
}

interface ScoredAuction {
  auctionId: string;
  matchScore: number;
  reason: string;
}

/**
 * Recommendation Generation Service
 * Generates personalized auction recommendations for vendors based on their interaction history
 */
export class RecommendationGenerationService {
  /**
   * Generate recommendations for a specific vendor
   */
  async generateRecommendationsForVendor(vendorId: string): Promise<ScoredAuction[]> {
    console.log(`🎯 Generating recommendations for vendor ${vendorId}`);
    
    try {
      // 1. Get vendor's interaction history
      const interactions = await db
        .select()
        .from(vendorInteractions)
        .where(eq(vendorInteractions.vendorId, vendorId))
        .orderBy(desc(vendorInteractions.timestamp))
        .limit(50);
      
      if (interactions.length === 0) {
        console.log(`ℹ️  No interaction history for vendor ${vendorId} - cannot generate recommendations`);
        return [];
      }
      
      console.log(`📊 Found ${interactions.length} interactions for vendor ${vendorId}`);
      
      // 2. Extract vendor preferences from interactions
      const preferences = await this.extractVendorPreferences(vendorId, interactions);
      
      console.log(`✅ Extracted preferences:`, {
        assetTypes: preferences.preferredAssetTypes,
        priceRange: `₦${preferences.minPrice.toLocaleString()} - ₦${preferences.maxPrice.toLocaleString()}`,
        conditions: preferences.preferredConditions,
      });
      
      // 3. Find active auctions
      const activeAuctions = await db
        .select()
        .from(auctions)
        .where(
          and(
            inArray(auctions.status, ['active', 'extended', 'scheduled']),
            sql`${auctions.endTime} > NOW()` // Not ended yet
          )
        )
        .limit(100);
      
      console.log(`📊 Found ${activeAuctions.length} active auctions to score`);
      
      if (activeAuctions.length === 0) {
        console.log(`ℹ️  No active auctions available`);
        return [];
      }
      
      // 4. Score each auction
      const scoredAuctions = activeAuctions.map(auction => ({
        auctionId: auction.id,
        matchScore: this.calculateMatchScore(auction, preferences),
        reason: this.generateReason(auction, preferences),
      }));
      
      // 5. Return top 10 recommendations (score > 40)
      const recommendations = scoredAuctions
        .filter(a => a.matchScore > 40)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
      
      console.log(`✅ Generated ${recommendations.length} recommendations for vendor ${vendorId}`);
      
      return recommendations;
    } catch (error) {
      console.error(`❌ Failed to generate recommendations for vendor ${vendorId}:`, error);
      return [];
    }
  }
  
  /**
   * Extract vendor preferences from interaction history
   */
  private async extractVendorPreferences(
    vendorId: string,
    interactions: any[]
  ): Promise<VendorPreferences> {
    // Get auctions the vendor interacted with
    const auctionIds = interactions.map(i => i.auctionId);
    
    const interactedAuctions = await db
      .select()
      .from(auctions)
      .where(inArray(auctions.id, auctionIds));
    
    // Extract patterns
    const assetTypes = interactedAuctions
      .map(a => a.case?.assetType)
      .filter(Boolean);
    
    const prices = interactedAuctions
      .map(a => parseFloat(a.currentBid || a.case?.reservePrice || '0'))
      .filter(p => p > 0);
    
    const conditions = interactedAuctions
      .map(a => a.case?.damageSeverity)
      .filter(Boolean);
    
    // Get vendor location
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, vendorId),
    });
    
    return {
      preferredAssetTypes: this.getMostCommon(assetTypes, 3),
      minPrice: prices.length > 0 ? Math.min(...prices) * 0.8 : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) * 1.2 : Number.MAX_SAFE_INTEGER,
      preferredConditions: this.getMostCommon(conditions, 2),
      location: vendor?.businessAddress as any, // Assuming this has lat/lng
    };
  }
  
  /**
   * Calculate match score for an auction (0-100)
   */
  private calculateMatchScore(auction: any, preferences: VendorPreferences): number {
    let score = 0;
    
    // Asset type match (40 points)
    if (preferences.preferredAssetTypes.includes(auction.case?.assetType)) {
      score += 40;
    }
    
    // Price range match (30 points)
    const price = parseFloat(auction.currentBid || auction.case?.reservePrice || '0');
    if (price >= preferences.minPrice && price <= preferences.maxPrice) {
      score += 30;
    } else if (price < preferences.minPrice) {
      score += 15; // Cheaper than usual - still interesting
    }
    
    // Condition match (20 points)
    if (preferences.preferredConditions.includes(auction.case?.damageSeverity)) {
      score += 20;
    }
    
    // Location proximity (10 points)
    if (preferences.location && auction.case?.gpsLocation) {
      const distance = this.calculateDistance(
        preferences.location,
        auction.case.gpsLocation
      );
      if (distance < 50) score += 10;
      else if (distance < 100) score += 5;
    }
    
    return Math.round(score);
  }
  
  /**
   * Generate human-readable reason for recommendation
   */
  private generateReason(auction: any, preferences: VendorPreferences): string {
    const reasons = [];
    
    if (preferences.preferredAssetTypes.includes(auction.case?.assetType)) {
      reasons.push(`Matches your interest in ${auction.case?.assetType}s`);
    }
    
    const price = parseFloat(auction.currentBid || auction.case?.reservePrice || '0');
    if (price < preferences.minPrice) {
      reasons.push('Below your usual price range - great deal!');
    } else if (price >= preferences.minPrice && price <= preferences.maxPrice) {
      reasons.push('Within your typical price range');
    }
    
    if (preferences.preferredConditions.includes(auction.case?.damageSeverity)) {
      reasons.push(`${auction.case?.damageSeverity} damage level you prefer`);
    }
    
    if (preferences.location && auction.case?.gpsLocation) {
      const distance = this.calculateDistance(
        preferences.location,
        auction.case.gpsLocation
      );
      if (distance < 50) {
        reasons.push('Located nearby');
      }
    }
    
    return reasons.length > 0 ? reasons.join('. ') + '.' : 'Based on your bidding history';
  }
  
  /**
   * Get most common items from array
   */
  private getMostCommon<T>(items: T[], limit: number = 3): T[] {
    const counts = new Map<T, number>();
    
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }
  
  /**
   * Calculate distance between two GPS coordinates (in km)
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) *
        Math.cos(this.toRad(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Store recommendations in database
   */
  async storeRecommendations(vendorId: string, recommendations: ScoredAuction[]): Promise<void> {
    if (recommendations.length === 0) {
      return;
    }
    
    try {
      // Delete old recommendations for this vendor
      await db
        .delete(vendorRecommendations)
        .where(eq(vendorRecommendations.vendorId, vendorId));
      
      // Insert new recommendations
      await db.insert(vendorRecommendations).values(
        recommendations.map(rec => ({
          id: crypto.randomUUID(),
          vendorId,
          auctionId: rec.auctionId,
          matchScore: rec.matchScore.toString(),
          reason: rec.reason,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }))
      );
      
      console.log(`✅ Stored ${recommendations.length} recommendations for vendor ${vendorId}`);
    } catch (error) {
      console.error(`❌ Failed to store recommendations:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const recommendationGenerationService = new RecommendationGenerationService();
