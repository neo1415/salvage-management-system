/**
 * Unit tests for MLDatasetService
 * Task 6.2.10
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MLDatasetService } from '@/features/intelligence/services/ml-dataset.service';

describe('MLDatasetService', () => {
  let service: MLDatasetService;

  beforeEach(() => {
    service = new MLDatasetService();
  });

  describe('exportPricePredictionDataset', () => {
    it('should export dataset in CSV format', async () => {
      const dateRangeStart = new Date('2024-01-01');
      const dateRangeEnd = new Date('2024-01-31');

      const result = await service.exportPricePredictionDataset(
        dateRangeStart,
        dateRangeEnd,
        'csv'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should export dataset in JSON format', async () => {
      const dateRangeStart = new Date('2024-01-01');
      const dateRangeEnd = new Date('2024-01-31');

      const result = await service.exportPricePredictionDataset(
        dateRangeStart,
        dateRangeEnd,
        'json'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should anonymize PII in exports', async () => {
      const dateRangeStart = new Date('2024-01-01');
      const dateRangeEnd = new Date('2024-01-31');

      const result = await service.exportPricePredictionDataset(
        dateRangeStart,
        dateRangeEnd,
        'csv'
      );

      expect(result).not.toContain('@');
      expect(result).not.toMatch(/\+?\d{10,}/);
    });
  });

  describe('exportRecommendationDataset', () => {
    it('should export recommendation dataset', async () => {
      const dateRangeStart = new Date('2024-01-01');
      const dateRangeEnd = new Date('2024-01-31');

      const result = await service.exportRecommendationDataset(
        dateRangeStart,
        dateRangeEnd,
        'csv'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
