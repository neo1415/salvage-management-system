/**
 * Type definitions for AI-Powered Marketplace Intelligence
 * 
 * @module intelligence/types
 */

export interface PredictionResult {
  auctionId: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  method: string;
  sampleSize: number;
  metadata: {
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  };
  algorithmVersion: string;
  createdAt: Date;
}

export interface RecommendationResult {
  auctionId: string;
  matchScore: number;
  collaborativeScore: number;
  contentScore: number;
  popularityBoost: number;
  winRateBoost: number;
  reasonCodes: string[];
  auctionDetails: {
    assetType: string;
    assetDetails: any;
    marketValue: number;
    reservePrice: number;
    currentBid: number | null;
    watchingCount: number;
    endTime: Date;
  };
}

export interface VendorBiddingPattern {
  vendorId: string;
  totalBids: number;
  assetTypeFrequency: Record<string, number>;
  topMakes: string[];
  topModels: string[];
  priceP25: number;
  priceP75: number;
  avgBidAmount: number;
  damagePreferences: Record<string, number>;
  overallWinRate: number;
  winRateByAssetType: Record<string, number>;
  avgBidToValueRatio: number;
  bidsPerWeek: number;
  lastBidAt: Date | null;
}

export interface MarketConditions {
  competitionMultiplier: number;
  trendMultiplier: number;
  seasonalMultiplier: number;
  competitionLevel: string;
}

export interface SimilarAuction {
  auctionId: string;
  finalPrice: number;
  similarityScore: number;
  timeWeight: number;
  bidCount: number;
  damageSeverity: string;
  marketValue: number;
  endTime: Date;
}
