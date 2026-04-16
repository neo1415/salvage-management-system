/**
 * RecommendationService Unit Tests
 * Task 12.1.2: Write unit tests for RecommendationService (>80% coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecommendationService } from '@/features/intelligence/services/recommendation.service';
import { db } from '@/lib/db';
import * as redisCache from '@/lib/cache/redis';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  CACHE_KEYS: { RECOMMENDATION: 'recommendation' },
  CACHE_TTL: { RECOMMENDATION: 900 },
}));

describe('RecommendationService', () => {
  let service: RecommendationService;
  
  beforeEach(() => {
    service = new RecommendationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateRecommendations', () => {
    it('should throw error for invalid vendor ID', async () => {
      await expect(service.generateRecommendations('')).rejects.toThrow('Invalid vendor ID');
      await expect(service.generateRecommendations(null as any)).rejects.toThrow('Invalid vendor ID');
    });

    it('should return cached recommendations if available', async () => {
      const mockCachedRecs = [
        {
          auctionId: 'auction-1',
          matchScore: 85,
          collaborativeScore: 60,
          contentScore: 25,
          popularityBoost: 5,
          winRateBoost: 10,
          reasonCodes: ['Cached'],
          auctionDetails: {
            assetType: 'vehicle',
            assetDetails: {},
            marketValue: 500000,
            reservePrice: 400000,
            currentBid: null,
            watchingCount: 10,
            endTime: new Date(),
          },
        },
      ];

      vi.mocked(redisCache.getCached).mockResolvedValue(mockCachedRecs);

      const result = await service.generateRecommendations('vendor-123');

      expect(result).toEqual(mockCachedRecs);
      expect(redisCache.getCached).toHaveBeenCalledWith('recommendation:vendor-123');
    });
  });

  describe('Item Similarity Calculation', () => {
    it('should calculate high similarity for exact matches', () => {
      const targetAuction = {
        asset_type: 'vehicle',
        asset_details: { make: 'Toyota', model: 'Camry' },
        damage_severity: 'minor',
        market_value: '500000',
      };

      const historicalBid = {
        asset_type: 'vehicle',
        asset_details: { make: 'Toyota', model: 'Camry' },
        damage_severity: 'minor',
        market_value: '500000',
        created_at: new Date(),
      };

      const similarity = (service as any).calculateItemSimilarity(
        targetAuction,
        historicalBid,
        new Date()
      );

      expect(similarity).toBeGreaterThan(90);
    });

    it('should apply time decay to older bids', () => {
      const targetAuction = {
        asset_type: 'vehicle',
        asset_details: { make: 'Toyota', model: 'Camry' },
        damage_severity: 'minor',
        market_value: '500000',
      };

      const historicalBid = {
        asset_type: 'vehicle',
        asset_details: { make: 'Toyota', model: 'Camry' },
        damage_severity: 'minor',
        market_value: '500000',
      };

      const recentDate = new Date();
      const recentSimilarity = (service as any).calculateItemSimilarity(
        targetAuction,
        historicalBid,
        recentDate
      );

      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 6);
      const oldSimilarity = (service as any).calculateItemSimilarity(
        targetAuction,
        historicalBid,
        oldDate
      );

      expect(recentSimilarity).toBeGreaterThan(oldSimilarity);
    });
  });

  describe('Damage Severity Adjacent Check', () => {
    it('should identify adjacent damage levels', () => {
      expect((service as any).isDamageSeverityAdjacent('minor', 'moderate')).toBe(true);
      expect((service as any).isDamageSeverityAdjacent('moderate', 'severe')).toBe(true);
      expect((service as any).isDamageSeverityAdjacent('none', 'minor')).toBe(true);
    });

    it('should return false for non-adjacent levels', () => {
      expect((service as any).isDamageSeverityAdjacent('minor', 'severe')).toBe(false);
      expect((service as any).isDamageSeverityAdjacent('none', 'severe')).toBe(false);
    });
  });

  describe('Reason Code Generation', () => {
    it('should generate appropriate reason codes based on scores', () => {
      const reasonCodes = (service as any).generateReasonCodes(70, 65, 0.6, 15);

      expect(reasonCodes).toContain('Similar to your previous bids');
      expect(reasonCodes).toContain('Matches your preferred categories');
      expect(reasonCodes).toContain('High win rate in this category');
      expect(reasonCodes).toContain('Trending auction');
    });

    it('should provide default reason when no specific reasons apply', () => {
      const reasonCodes = (service as any).generateReasonCodes(20, 20, 0.2, 3);

      expect(reasonCodes).toContain('Recommended for you');
    });
  });

  describe('Diversity Optimization', () => {
    it('should maintain diversity across asset types', () => {
      const recommendations = [
        {
          auctionId: 'auction-1',
          matchScore: 90,
          collaborativeScore: 60,
          contentScore: 30,
          popularityBoost: 5,
          winRateBoost: 10,
          reasonCodes: ['test'],
          auctionDetails: {
            assetType: 'vehicle',
            assetDetails: {},
            marketValue: 500000,
            reservePrice: 400000,
            currentBid: null,
            watchingCount: 10,
            endTime: new Date(),
          },
        },
        {
          auctionId: 'auction-2',
          matchScore: 85,
          collaborativeScore: 55,
          contentScore: 30,
          popularityBoost: 5,
          winRateBoost: 10,
          reasonCodes: ['test'],
          auctionDetails: {
            assetType: 'vehicle',
            assetDetails: {},
            marketValue: 600000,
            reservePrice: 500000,
            currentBid: null,
            watchingCount: 8,
            endTime: new Date(),
          },
        },
        {
          auctionId: 'auction-3',
          matchScore: 80,
          collaborativeScore: 50,
          contentScore: 30,
          popularityBoost: 5,
          winRateBoost: 10,
          reasonCodes: ['test'],
          auctionDetails: {
            assetType: 'electronics',
            assetDetails: {},
            marketValue: 200000,
            reservePrice: 150000,
            currentBid: null,
            watchingCount: 12,
            endTime: new Date(),
          },
        },
      ];

      const diversified = (service as any).optimizeDiversity(recommendations);

      expect(diversified.length).toBe(3);
      expect(diversified[0].auctionDetails.assetType).not.toBe(
        diversified[1].auctionDetails.assetType
      );
    });
  });

  describe('generateColdStartRecommendations', () => {
    it('should throw error if vendor not found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      await expect(
        service.generateColdStartRecommendations('invalid-vendor')
      ).rejects.toThrow('Vendor not found');
    });
  });
});
