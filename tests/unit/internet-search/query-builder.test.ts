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

    it('builds artwork identity with artist, medium, dimensions and condition', () => {
      const query = service.buildMarketQuery({
        type: 'artwork',
        artworkType: 'abstract painting',
        artist: 'Bruce Onobrakpeya',
        medium: 'oil on canvas',
        size: '120 x 90 cm',
        condition: 'Nigerian Used',
      });

      expect(query).toContain('Bruce Onobrakpeya abstract painting oil on canvas 120 x 90 cm artwork');
      expect(query).toContain('used fair condition price Nigeria');
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

  describe('buildPartPriceQuery', () => {
    it('builds a repair query with vehicle identity, mileage, damage and labour context', () => {
      const query = service.buildPartPriceQuery({
        type: 'vehicle', make: 'Toyota', model: 'Camry', year: 2018,
        mileage: 200000, condition: 'Foreign Used (Tokunbo)'
      }, 'left front door', 'dented', 'repair');

      expect(query).toContain('Toyota Camry 2018 200,000 km tokunbo');
      expect(query).toContain('left front door dented body component repair labour cost estimate Nigeria');
      expect(query).not.toContain('replacement part');
    });

    it('builds a replacement query for a model-specific electronic component', () => {
      const query = service.buildPartPriceQuery({
        type: 'electronics', brand: 'Apple', model: 'iPhone 14 Pro',
        storageCapacity: '256GB', condition: 'Nigerian Used'
      }, 'display assembly', 'shattered', 'replace');

      expect(query).toContain('Apple iPhone 14 Pro 256GB used fair condition');
      expect(query).toContain('display assembly shattered replacement part price installation labour Nigeria');
    });

    it('keeps bulk product specifications in recovery pricing queries', () => {
      const query = service.buildPartPriceQuery({
        type: 'building_materials', brand: 'Dangote', description: 'cement',
        model: '3X 42.5R cement', unitOfMeasure: '50kg bags', packagingType: 'paper sacks'
      }, 'water-damaged bags', 'water-contaminated', 'sort_or_recover');

      expect(query).toContain('Dangote 3X 42.5R cement paper sacks 50kg bags');
      expect(query).toContain('damaged stock recovery sorting resale value Nigeria');
    });

    it('uses specialist inspection language for safety-sensitive uncertain equipment', () => {
      const query = service.buildPartPriceQuery({
        type: 'medical_equipment', brand: 'GE', model: 'CARESCAPE B650',
        description: 'patient monitor', year: 2022, condition: 'Nigerian Used'
      }, 'sensor module', 'fluid-contaminated', 'specialist_review');

      expect(query).toContain('GE CARESCAPE B650 patient monitor 2022');
      expect(query).toContain('inspection diagnostic estimate Nigeria');
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
