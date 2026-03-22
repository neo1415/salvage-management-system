/**
 * Unit tests for Query Builder Service
 */

import { describe, it, expect } from 'vitest';
import { 
  QueryBuilderService, 
  queryBuilder,
  type VehicleIdentifier,
  type ElectronicsIdentifier,
  type PartIdentifier
} from '@/features/internet-search/services/query-builder.service';

describe('QueryBuilderService', () => {
  const service = new QueryBuilderService();

  describe('buildMarketQuery', () => {
    it('should build vehicle query correctly', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        condition: 'Foreign Used (Tokunbo)'
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query).toBe('Toyota Camry 2021 tokunbo price Nigeria');
    });

    it('should build electronics query correctly', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'iPhone',
        model: '13 Pro',
        storage: '256GB',
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('iPhone 13 Pro 256GB brand new price Nigeria');
    });

    it('should build electronics query with separate storage capacity and type', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'MacBook',
        model: 'Pro 16',
        storageCapacity: '512GB',
        storageType: 'NVMe SSD',
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('MacBook Pro 16 512GB NVMe SSD brand new price Nigeria');
    });

    it('should prioritize separate storage fields over legacy storage field', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'Dell',
        model: 'XPS 13',
        storage: '256GB', // Legacy field
        storageCapacity: '512GB', // Should be used instead
        storageType: 'SSD',
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('Dell XPS 13 512GB SSD brand new price Nigeria');
    });

    it('should handle only storage capacity without type', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'Samsung',
        model: 'Galaxy S23',
        storageCapacity: '128GB',
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('Samsung Galaxy S23 128GB brand new price Nigeria');
    });

    it('should handle only storage type without capacity', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'Gaming',
        model: 'Laptop',
        storageType: 'NVMe',
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('Gaming Laptop NVMe brand new price Nigeria');
    });

    it('should fallback to legacy storage field when new fields are not provided', () => {
      const electronics: ElectronicsIdentifier = {
        type: 'electronics',
        brand: 'iPhone',
        model: '12',
        storage: '128GB HDD', // Legacy combined field
        condition: 'Brand New'
      };

      const query = service.buildMarketQuery(electronics);
      expect(query).toBe('iPhone 12 128GB HDD brand new price Nigeria');
    });

    it('should handle missing optional fields', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Accord'
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query).toBe('Honda Accord price Nigeria');
    });

    it('should respect options flags', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        condition: 'Nigerian Used'
      };

      const query = service.buildMarketQuery(vehicle, {
        includeCondition: false,
        includeLocation: false
      });
      
      expect(query).toBe('Toyota Camry price');
    });

    it('should include marketplace when requested', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry'
      };

      const query = service.buildMarketQuery(vehicle, {
        includeMarketplace: true
      });
      
      expect(query).toContain('site:jiji.ng');
    });
  });

  describe('buildPartQuery', () => {
    it('should build part query correctly', () => {
      const part: PartIdentifier = {
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2021,
        partName: 'bumper',
        partType: 'body',
        damageLevel: 'moderate'
      };

      const query = service.buildPartQuery(part);
      expect(query).toBe('Toyota Camry 2021 bumper body part price Nigeria');
    });

    it('should handle mechanical parts', () => {
      const part: PartIdentifier = {
        vehicleMake: 'Honda',
        partName: 'engine',
        partType: 'mechanical',
        damageLevel: 'severe'
      };

      const query = service.buildPartQuery(part);
      expect(query).toBe('Honda engine spare part price Nigeria');
    });

    it('should respect options', () => {
      const part: PartIdentifier = {
        vehicleMake: 'Toyota',
        vehicleYear: 2021,
        partName: 'headlight',
        partType: 'electrical',
        damageLevel: 'minor'
      };

      const query = service.buildPartQuery(part, {
        includeYear: false,
        includeLocation: false
      });
      
      expect(query).toBe('Toyota headlight price');
    });
  });

  describe('buildConditionQuery', () => {
    it('should generate condition variations', () => {
      const baseQuery = 'Toyota Camry 2021';
      const variations = service.buildConditionQuery(baseQuery, 'Foreign Used (Tokunbo)');
      
      expect(variations).toHaveLength(5); // 'Foreign Used (Tokunbo)' has 5 terms
      expect(variations[0]).toContain('tokunbo');
      expect(variations[1]).toContain('foreign used');
      expect(variations[2]).toContain('uk used');
    });

    it('should handle different conditions', () => {
      const baseQuery = 'iPhone 13';
      const variations = service.buildConditionQuery(baseQuery, 'Brand New');
      
      expect(variations).toHaveLength(3);
      expect(variations[0]).toContain('brand new');
      expect(variations[1]).toContain('new');
      expect(variations[2]).toContain('unused');
    });
  });

  describe('localizeQuery', () => {
    it('should add Nigerian location terms', () => {
      const query = 'Toyota Camry price';
      const localized = service.localizeQuery(query, 'nigeria');
      
      expect(localized).toMatch(/Toyota Camry price (Nigeria|Lagos|Abuja|Port Harcourt|Kano|Ibadan)/);
    });

    it('should add global terms', () => {
      const query = 'iPhone 13 price';
      const localized = service.localizeQuery(query, 'global');
      
      expect(localized).toMatch(/iPhone 13 price (price|cost|buy|sell)/);
    });
  });

  describe('generateQueryVariations', () => {
    it('should generate multiple variations', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        condition: 'Foreign Used (Tokunbo)'
      };

      const variations = service.generateQueryVariations(vehicle, 3);
      
      expect(variations).toHaveLength(3);
      expect(variations[0]).toContain('Toyota Camry 2021');
      expect(variations.some(v => v.includes('tokunbo'))).toBe(true);
    });

    it('should respect max variations limit', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Civic'
      };

      const variations = service.generateQueryVariations(vehicle, 2);
      expect(variations).toHaveLength(2);
    });
  });

  describe('Query Sanitization', () => {
    it('should sanitize dangerous characters', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota<script>',
        model: 'Camry"alert()',
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query).not.toContain('<script>');
      expect(query).not.toContain('"alert()');
    });

    it('should normalize whitespace', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota   ',
        model: '  Camry  ',
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query).toBe('Toyota Camry price Nigeria');
    });

    it('should limit query length', () => {
      const longModel = 'A'.repeat(600);
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: longModel,
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unsupported item types', () => {
      const invalidItem = {
        type: 'unsupported',
        name: 'test'
      } as any;

      expect(() => service.buildMarketQuery(invalidItem)).toThrow('Unsupported item type');
    });

    it('should handle empty strings gracefully', () => {
      const vehicle: VehicleIdentifier = {
        type: 'vehicle',
        make: '',
        model: '',
      };

      const query = service.buildMarketQuery(vehicle);
      expect(query).toBe('price Nigeria');
    });
  });
});

describe('Singleton Export', () => {
  it('should export singleton instance', () => {
    expect(queryBuilder).toBeInstanceOf(QueryBuilderService);
  });

  it('should maintain state across calls', () => {
    const vehicle: VehicleIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry'
    };

    const query1 = queryBuilder.buildMarketQuery(vehicle);
    const query2 = queryBuilder.buildMarketQuery(vehicle);
    
    expect(query1).toBe(query2);
  });
});