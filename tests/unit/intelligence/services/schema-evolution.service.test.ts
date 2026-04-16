/**
 * SchemaEvolutionService Unit Tests
 * Task 6.3.6: Add unit tests for SchemaEvolutionService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaEvolutionService } from '@/features/intelligence/services/schema-evolution.service';

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe('SchemaEvolutionService', () => {
  let service: SchemaEvolutionService;

  beforeEach(() => {
    service = new SchemaEvolutionService();
    vi.clearAllMocks();
  });

  describe('detectNewAssetTypes', () => {
    it('should detect new asset types with sufficient occurrences', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock new asset types
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'jewelry',
          occurrence_count: 5,
          first_seen: new Date('2024-01-01'),
        },
        {
          asset_type: 'furniture',
          occurrence_count: 3,
          first_seen: new Date('2024-01-05'),
        },
      ]);

      await service.detectNewAssetTypes();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should not detect asset types with insufficient occurrences', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock asset types with low occurrence
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'rare_item',
          occurrence_count: 2,
          first_seen: new Date('2024-01-01'),
        },
      ]);

      await service.detectNewAssetTypes();

      expect(db.execute).toHaveBeenCalledTimes(1);
      // Should not insert because occurrence < 3
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('detectNewAttributes', () => {
    it('should detect new attributes with sufficient occurrences', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock new attributes
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          attribute_name: 'transmission',
          occurrence_count: 10,
        },
        {
          asset_type: 'electronics',
          attribute_name: 'screen_size',
          occurrence_count: 8,
        },
      ]);

      await service.detectNewAttributes();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should not detect existing attributes', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock existing attributes
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          attribute_name: 'make',
          occurrence_count: 100,
        },
        {
          asset_type: 'vehicle',
          attribute_name: 'model',
          occurrence_count: 100,
        },
      ]);

      await service.detectNewAttributes();

      expect(db.execute).toHaveBeenCalledTimes(1);
      // Should not insert because these are existing attributes
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('getPendingChanges', () => {
    it('should retrieve pending schema changes', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChanges = [
        {
          id: 'change-1',
          changeType: 'new_asset_type',
          entityName: 'jewelry',
          status: 'pending',
        },
        {
          id: 'change-2',
          changeType: 'new_attribute',
          entityName: 'transmission',
          status: 'pending',
        },
      ];

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce(mockChanges),
            }),
          }),
        }),
      });

      const result = await service.getPendingChanges();

      expect(result).toEqual(mockChanges);
    });
  });

  describe('approveChange', () => {
    it('should approve a schema change', async () => {
      const { db } = await import('@/lib/db');

      await service.approveChange('change-1', 'admin-123');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('validateSchemaChange', () => {
    it('should validate a valid schema change', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-1',
        changeType: 'new_asset_type',
        entityName: 'jewelry',
        changeDetails: {
          occurrenceCount: 5,
        },
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      const result = await service.validateSchemaChange('change-1');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid entity name', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-1',
        changeType: 'new_asset_type',
        entityName: 'invalid-name!',
        changeDetails: {
          occurrenceCount: 5,
        },
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      const result = await service.validateSchemaChange('change-1');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('alphanumeric'))).toBe(true);
    });

    it('should reject insufficient occurrence count', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-1',
        changeType: 'new_asset_type',
        entityName: 'jewelry',
        changeDetails: {
          occurrenceCount: 2,
        },
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      const result = await service.validateSchemaChange('change-1');

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('occurrence count'))).toBe(true);
    });

    it('should reject non-existent change', async () => {
      const { db } = await import('@/lib/db');
      
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const result = await service.validateSchemaChange('non-existent');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema change not found');
    });
  });

  describe('expandAnalyticsTables', () => {
    it('should expand tables for new asset type', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-1',
        changeType: 'new_asset_type',
        entityName: 'jewelry',
        status: 'approved',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      await service.expandAnalyticsTables('change-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('should expand tables for new attribute', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-2',
        changeType: 'new_attribute',
        entityName: 'transmission',
        status: 'approved',
        changeDetails: {
          assetType: 'vehicle',
        },
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      await service.expandAnalyticsTables('change-2');

      expect(db.update).toHaveBeenCalled();
    });

    it('should reject unapproved changes', async () => {
      const { db } = await import('@/lib/db');
      
      const mockChange = {
        id: 'change-1',
        changeType: 'new_asset_type',
        entityName: 'jewelry',
        status: 'pending',
      };

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([mockChange]),
          }),
        }),
      });

      await expect(service.expandAnalyticsTables('change-1')).rejects.toThrow('must be approved');
    });
  });
});
