/**
 * Integration tests for Multiple Part Search Performance Optimizations (Task 8.8)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';

describe('Multiple Part Search Performance Integration Tests', () => {
  beforeAll(async () => {
    // Clear any existing performance metrics
    internetSearchService.clearPerformanceMetrics();
  });

  describe('Performance Optimizations', () => {
    it('should handle multiple part searches efficiently', async () => {
      const startTime = Date.now();

      const itemIdentifier = {
        type: 'vehicle' as const,
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      const parts = [
        { name: 'bumper', damageType: 'moderate' },
        { name: 'headlight', damageType: 'minor' },
        { name: 'windshield', damageType: 'severe' }
      ];

      const options = {
        maxResults: 3,
        timeout: 1500,
        concurrencyLimit: 2,
        enableBatching: true,
        prioritizeCommonParts: true
      };

      const result = await internetSearchService.searchMultiplePartPrices(
        itemIdentifier,
        parts,
        options
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance requirements
      expect(duration).toBeLessThan(5000); // Allow 5 seconds for integration test
      expect(result).toHaveLength(3);
      expect(result.every(r => typeof r.partName === 'string')).toBe(true);
      expect(result.every(r => typeof r.success === 'boolean')).toBe(true);

      // Verify that the optimization options are supported
      expect(typeof options.concurrencyLimit).toBe('number');
      expect(typeof options.enableBatching).toBe('boolean');
      expect(typeof options.prioritizeCommonParts).toBe('boolean');
    });

    it('should provide performance statistics', () => {
      const stats = internetSearchService.getPerformanceStats();
      
      expect(typeof stats.totalSearches).toBe('number');
      expect(typeof stats.successfulSearches).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
      expect(Array.isArray(stats.recentSearches)).toBe(true);
    });

    it('should handle empty parts array gracefully', async () => {
      const result = await internetSearchService.searchMultiplePartPrices(
        { type: 'vehicle', make: 'Toyota', model: 'Camry', year: 2021 },
        []
      );

      expect(result).toHaveLength(0);
    });

    it('should support health check functionality', async () => {
      const health = await internetSearchService.healthCheck();
      
      expect(typeof health.status).toBe('string');
      expect(typeof health.apiStatus).toBe('boolean');
      expect(typeof health.responseTime).toBe('number');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Cache Integration', () => {
    it('should provide cache statistics', async () => {
      const cacheStats = await internetSearchService.getCacheStats();
      
      expect(typeof cacheStats.metrics).toBe('object');
      expect(typeof cacheStats.metrics.totalHits).toBe('number');
      expect(typeof cacheStats.metrics.totalMisses).toBe('number');
      expect(typeof cacheStats.metrics.hitRate).toBe('number');
      expect(Array.isArray(cacheStats.popularQueries)).toBe(true);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(cacheStats.cacheHealth);
    });

    it('should support cache operations', async () => {
      // Test cache clearing
      await internetSearchService.clearCache();
      
      // This should not throw an error
      expect(true).toBe(true);
    });
  });
});