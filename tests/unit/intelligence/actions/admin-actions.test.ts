/**
 * Unit Tests for Admin Actions
 * Task 15.3.3: Add action tests
 * 
 * Test coverage:
 * - ML dataset export
 * - Algorithm tuning
 * - Authentication and authorization
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportMLDataset, tuneAlgorithm, getTuningHistory } from '@/features/intelligence/actions/admin-actions';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { MLDatasetService } from '@/features/intelligence/services';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/features/intelligence/services');

describe('Admin Actions', () => {
  const mockAdminSession = {
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    },
  };

  const mockUserSession = {
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role: 'vendor',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportMLDataset', () => {
    it('should export ML dataset successfully', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockDataset = {
        id: 'ds-1',
        datasetType: 'price_prediction',
        recordCount: 5000,
        featureCount: 25,
        format: 'csv',
        size: 2048000,
        trainSplit: 70,
        validationSplit: 15,
        testSplit: 15,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDataset]),
          }),
        }),
      } as any);

      const mockExportData = {
        train: 'train_data',
        validation: 'validation_data',
        test: 'test_data',
      };

      vi.mocked(MLDatasetService).mockImplementation(() => ({
        exportPricePredictionDataset: vi.fn().mockResolvedValue(mockExportData),
      } as any));

      const result = await exportMLDataset('ds-1');

      expect(result.success).toBe(true);
      expect(result.datasetId).toBe('ds-1');
      expect(result.datasetType).toBe('price_prediction');
      expect(result.exportData).toEqual(mockExportData);
    });

    it('should reject non-admin users', async () => {
      vi.mocked(auth).mockResolvedValue(mockUserSession as any);

      await expect(exportMLDataset('ds-1')).rejects.toThrow('Unauthorized');
    });

    it('should reject unauthenticated requests', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      await expect(exportMLDataset('ds-1')).rejects.toThrow('Unauthorized');
    });

    it('should handle dataset not found', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(exportMLDataset('invalid-id')).rejects.toThrow('Dataset not found');
    });

    it('should export recommendation dataset', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockDataset = {
        id: 'ds-2',
        datasetType: 'recommendation',
        recordCount: 10000,
        featureCount: 30,
        format: 'json',
        size: 5120000,
        trainSplit: 80,
        validationSplit: 10,
        testSplit: 10,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDataset]),
          }),
        }),
      } as any);

      const mockExportData = {
        train: 'train_data',
        validation: 'validation_data',
        test: 'test_data',
      };

      vi.mocked(MLDatasetService).mockImplementation(() => ({
        exportRecommendationDataset: vi.fn().mockResolvedValue(mockExportData),
      } as any));

      const result = await exportMLDataset('ds-2');

      expect(result.success).toBe(true);
      expect(result.datasetType).toBe('recommendation');
    });

    it('should export fraud detection dataset', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockDataset = {
        id: 'ds-3',
        datasetType: 'fraud_detection',
        recordCount: 3000,
        featureCount: 20,
        format: 'parquet',
        size: 1024000,
        trainSplit: 70,
        validationSplit: 15,
        testSplit: 15,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDataset]),
          }),
        }),
      } as any);

      const mockExportData = {
        train: 'train_data',
        validation: 'validation_data',
        test: 'test_data',
      };

      vi.mocked(MLDatasetService).mockImplementation(() => ({
        exportFraudDetectionDataset: vi.fn().mockResolvedValue(mockExportData),
      } as any));

      const result = await exportMLDataset('ds-3');

      expect(result.success).toBe(true);
      expect(result.datasetType).toBe('fraud_detection');
    });

    it('should handle unknown dataset type', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockDataset = {
        id: 'ds-4',
        datasetType: 'unknown_type',
        recordCount: 1000,
        featureCount: 10,
        format: 'csv',
        size: 512000,
        trainSplit: 70,
        validationSplit: 15,
        testSplit: 15,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockDataset]),
          }),
        }),
      } as any);

      await expect(exportMLDataset('ds-4')).rejects.toThrow('Unknown dataset type');
    });
  });

  describe('tuneAlgorithm', () => {
    it('should tune algorithm when accuracy is below target', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockConfig = {
        id: 'config-1',
        similarityThreshold: 60,
        timeDecayFactor: 0.85,
        confidenceThreshold: 0.75,
        updatedAt: new Date(),
        updatedBy: 'admin-1',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConfig]),
          }),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([{ avg_accuracy: 0.82 }] as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await tuneAlgorithm({ targetAccuracy: 0.88, adjustmentFactor: 0.05 });

      expect(result.success).toBe(true);
      expect(result.tuningApplied).toBe(true);
      expect(result.currentAccuracy).toBe(0.82);
      expect(result.targetAccuracy).toBe(0.88);
      expect(result.adjustments).toBeDefined();
    });

    it('should not tune when accuracy is within target', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockConfig = {
        id: 'config-1',
        similarityThreshold: 60,
        timeDecayFactor: 0.85,
        confidenceThreshold: 0.75,
        updatedAt: new Date(),
        updatedBy: 'admin-1',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConfig]),
          }),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([{ avg_accuracy: 0.89 }] as any);

      const result = await tuneAlgorithm({ targetAccuracy: 0.88 });

      expect(result.success).toBe(true);
      expect(result.tuningApplied).toBe(false);
      expect(result.message).toContain('within target accuracy');
    });

    it('should not tune when accuracy gap is too small', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockConfig = {
        id: 'config-1',
        similarityThreshold: 60,
        timeDecayFactor: 0.85,
        confidenceThreshold: 0.75,
        updatedAt: new Date(),
        updatedBy: 'admin-1',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConfig]),
          }),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([{ avg_accuracy: 0.86 }] as any);

      const result = await tuneAlgorithm({ targetAccuracy: 0.88 });

      expect(result.success).toBe(true);
      expect(result.tuningApplied).toBe(false);
      expect(result.message).toContain('gap too small');
    });

    it('should reject non-admin users', async () => {
      vi.mocked(auth).mockResolvedValue(mockUserSession as any);

      await expect(tuneAlgorithm()).rejects.toThrow('Unauthorized');
    });

    it('should reject unauthenticated requests', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      await expect(tuneAlgorithm()).rejects.toThrow('Unauthorized');
    });

    it('should handle missing configuration', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(tuneAlgorithm()).rejects.toThrow('No algorithm configuration found');
    });

    it('should use default parameters when not provided', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockConfig = {
        id: 'config-1',
        similarityThreshold: 60,
        timeDecayFactor: 0.85,
        confidenceThreshold: 0.75,
        updatedAt: new Date(),
        updatedBy: 'admin-1',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockConfig]),
          }),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([{ avg_accuracy: 0.89 }] as any);

      const result = await tuneAlgorithm();

      expect(result.success).toBe(true);
      expect(result.targetAccuracy).toBe(0.88); // Default
    });
  });

  describe('getTuningHistory', () => {
    it('should retrieve tuning history', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      const mockHistory = [
        {
          id: 'history-1',
          configId: 'config-1',
          changedBy: 'admin-1',
          changeReason: 'Manual adjustment',
          changedAt: new Date(),
          accuracyBefore: 0.82,
          accuracyAfter: 0.88,
        },
        {
          id: 'history-2',
          configId: 'config-1',
          changedBy: 'admin-1',
          changeReason: 'Automatic tuning',
          changedAt: new Date(),
          accuracyBefore: 0.80,
          accuracyAfter: 0.82,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockHistory),
          }),
        }),
      } as any);

      const result = await getTuningHistory(20);

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(2);
    });

    it('should reject non-admin users', async () => {
      vi.mocked(auth).mockResolvedValue(mockUserSession as any);

      await expect(getTuningHistory()).rejects.toThrow('Unauthorized');
    });

    it('should use default limit', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await getTuningHistory();

      expect(result.success).toBe(true);
    });
  });
});
