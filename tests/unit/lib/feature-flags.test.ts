/**
 * Unit tests for feature flag system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isFeatureEnabled,
  getAllFeatureFlags,
  getFeatureFlagConfig,
  getAllFeatureFlagConfigs,
  optInToFeature,
  optOutOfFeature,
  clearFeatureOverride,
  hasFeatureOverride,
  getFeatureOverride,
  type FeatureFlagName,
} from '@/lib/feature-flags';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled flags at 100% rollout', () => {
      expect(isFeatureEnabled('modern-filters')).toBe(true);
      expect(isFeatureEnabled('card-redesign')).toBe(true);
      expect(isFeatureEnabled('icon-replacement')).toBe(true);
    });

    it('should respect user overrides', () => {
      optOutOfFeature('modern-filters');
      expect(isFeatureEnabled('modern-filters')).toBe(false);

      optInToFeature('modern-filters');
      expect(isFeatureEnabled('modern-filters')).toBe(true);
    });

    it('should use percentage-based rollout when no override exists', () => {
      // User IDs that hash to different buckets
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      // At 100% rollout, all users should be enabled
      expect(isFeatureEnabled('modern-filters', userId1)).toBe(true);
      expect(isFeatureEnabled('modern-filters', userId2)).toBe(true);
    });

    it('should return consistent results for same user ID', () => {
      const userId = 'test-user-123';
      const result1 = isFeatureEnabled('modern-filters', userId);
      const result2 = isFeatureEnabled('modern-filters', userId);
      expect(result1).toBe(result2);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('should return all feature flags with their states', () => {
      const flags = getAllFeatureFlags();
      expect(flags).toHaveProperty('modern-filters');
      expect(flags).toHaveProperty('card-redesign');
      expect(flags).toHaveProperty('icon-replacement');
    });

    it('should respect user overrides in all flags', () => {
      optOutOfFeature('modern-filters');
      const flags = getAllFeatureFlags();
      expect(flags['modern-filters']).toBe(false);
    });
  });

  describe('getFeatureFlagConfig', () => {
    it('should return config for valid flag', () => {
      const config = getFeatureFlagConfig('modern-filters');
      expect(config).toBeDefined();
      expect(config?.name).toBe('modern-filters');
      expect(config?.description).toBeDefined();
      expect(config?.rolloutPercentage).toBeGreaterThanOrEqual(0);
      expect(config?.rolloutPercentage).toBeLessThanOrEqual(100);
    });

    it('should return undefined for invalid flag', () => {
      const config = getFeatureFlagConfig('invalid-flag' as FeatureFlagName);
      expect(config).toBeUndefined();
    });
  });

  describe('getAllFeatureFlagConfigs', () => {
    it('should return all feature flag configurations', () => {
      const configs = getAllFeatureFlagConfigs();
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty('name');
      expect(configs[0]).toHaveProperty('description');
      expect(configs[0]).toHaveProperty('rolloutPercentage');
      expect(configs[0]).toHaveProperty('enabled');
    });
  });

  describe('User Overrides', () => {
    it('should allow opting in to a feature', () => {
      optInToFeature('modern-filters');
      expect(isFeatureEnabled('modern-filters')).toBe(true);
      expect(hasFeatureOverride('modern-filters')).toBe(true);
      expect(getFeatureOverride('modern-filters')).toBe(true);
    });

    it('should allow opting out of a feature', () => {
      optOutOfFeature('modern-filters');
      expect(isFeatureEnabled('modern-filters')).toBe(false);
      expect(hasFeatureOverride('modern-filters')).toBe(true);
      expect(getFeatureOverride('modern-filters')).toBe(false);
    });

    it('should allow clearing overrides', () => {
      optInToFeature('modern-filters');
      expect(hasFeatureOverride('modern-filters')).toBe(true);

      clearFeatureOverride('modern-filters');
      expect(hasFeatureOverride('modern-filters')).toBe(false);
      expect(getFeatureOverride('modern-filters')).toBe(null);
    });

    it('should persist overrides in localStorage', () => {
      optInToFeature('modern-filters');
      
      // Simulate page reload by reading from localStorage
      const stored = localStorage.getItem('feature-flags-overrides');
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored!);
      expect(parsed['modern-filters']).toBe(true);
    });

    it('should handle multiple overrides', () => {
      optInToFeature('modern-filters');
      optOutOfFeature('card-redesign');

      expect(isFeatureEnabled('modern-filters')).toBe(true);
      expect(isFeatureEnabled('card-redesign')).toBe(false);
      expect(hasFeatureOverride('modern-filters')).toBe(true);
      expect(hasFeatureOverride('card-redesign')).toBe(true);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      // Should not throw
      expect(() => optInToFeature('modern-filters')).not.toThrow();

      // Restore original
      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing userId gracefully', () => {
      expect(() => isFeatureEnabled('modern-filters')).not.toThrow();
    });

    it('should handle empty userId', () => {
      expect(() => isFeatureEnabled('modern-filters', '')).not.toThrow();
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('feature-flags-overrides', 'invalid-json');
      expect(() => isFeatureEnabled('modern-filters')).not.toThrow();
    });
  });
});
