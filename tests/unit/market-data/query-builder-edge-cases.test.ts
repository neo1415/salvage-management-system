import { describe, it, expect } from 'vitest';
import {
  buildVehicleQuery,
  buildElectronicsQuery,
  buildBuildingQuery,
  buildSearchQuery,
  encodeQueryParams,
  buildFullUrl,
  validatePropertyIdentifier,
  getSupportedSources,
  isSourceSupported,
} from '../../../src/features/market-data/services/query-builder.service';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';

/**
 * Query Builder Unit Tests
 * 
 * Tests specific examples and edge cases for query construction
 * Requirements: 1.2-1.4
 */

describe('Query Builder Edge Cases', () => {
  describe('Source-specific query formats', () => {
    describe('Jiji.ng queries', () => {
      it('should format vehicle query for Jiji', () => {
        const query = buildVehicleQuery('Toyota', 'Camry', 2015, 'jiji');

        expect(query.source).toBe('jiji');
        expect(query.url).toBe('https://jiji.ng/cars');
        expect(query.params.q).toBe('Toyota Camry 2015');
      });

      it('should format electronics query for Jiji', () => {
        const query = buildElectronicsQuery('Samsung', 'Galaxy S21', 'smartphone', 'jiji');

        expect(query.source).toBe('jiji');
        expect(query.url).toBe('https://jiji.ng/electronics-technology');
        expect(query.params.q).toBe('Samsung Galaxy S21 smartphone');
      });

      it('should format building query for Jiji', () => {
        const query = buildBuildingQuery('Lagos', 'apartment', 120, 'jiji');

        expect(query.source).toBe('jiji');
        expect(query.url).toBe('https://jiji.ng/real-estate');
        expect(query.params.q).toContain('apartment');
        expect(query.params.q).toContain('Lagos');
      });
    });

    describe('Jumia.ng queries', () => {
      it('should format vehicle query for Jumia', () => {
        const query = buildVehicleQuery('Honda', 'Accord', 2018, 'jumia');

        expect(query.source).toBe('jumia');
        expect(query.url).toBe('https://www.jumia.com.ng/automobiles');
        expect(query.params.q).toBe('Honda Accord 2018');
      });

      it('should format electronics query for Jumia', () => {
        const query = buildElectronicsQuery('Apple', 'iPhone 13', 'smartphone', 'jumia');

        expect(query.source).toBe('jumia');
        expect(query.url).toBe('https://www.jumia.com.ng/electronics');
        expect(query.params.q).toBe('Apple iPhone 13 smartphone');
      });

      it('should throw error for building query on Jumia', () => {
        expect(() => {
          buildBuildingQuery('Lagos', 'apartment', 120, 'jumia');
        }).toThrow('Jumia does not support building searches');
      });
    });

    describe('Cars45.ng queries', () => {
      it('should format vehicle query for Cars45 with structured params', () => {
        const query = buildVehicleQuery('BMW', 'X5', 2020, 'cars45');

        expect(query.source).toBe('cars45');
        expect(query.url).toBe('https://cars45.com/listing');
        expect(query.params.make).toBe('bmw');
        expect(query.params.model).toBe('x5');
        expect(query.params.year).toBe('2020');
      });

      it('should throw error for electronics query on Cars45', () => {
        expect(() => {
          buildElectronicsQuery('Samsung', 'Galaxy', 'phone', 'cars45');
        }).toThrow('Cars45 does not support electronics searches');
      });

      it('should throw error for building query on Cars45', () => {
        expect(() => {
          buildBuildingQuery('Lagos', 'apartment', 120, 'cars45');
        }).toThrow('Cars45 does not support building searches');
      });
    });

    describe('Cheki.ng queries', () => {
      it('should format vehicle query for Cheki with year range', () => {
        const query = buildVehicleQuery('Nissan', 'Altima', 2019, 'cheki');

        expect(query.source).toBe('cheki');
        expect(query.url).toBe('https://cheki.com.ng/cars-for-sale');
        expect(query.params.make).toBe('nissan');
        expect(query.params.model).toBe('altima');
        expect(query.params.year_from).toBe('2019');
        expect(query.params.year_to).toBe('2019');
      });

      it('should throw error for electronics query on Cheki', () => {
        expect(() => {
          buildElectronicsQuery('Apple', 'iPhone', 'phone', 'cheki');
        }).toThrow('Cheki does not support electronics searches');
      });

      it('should throw error for building query on Cheki', () => {
        expect(() => {
          buildBuildingQuery('Lagos', 'apartment', 120, 'cheki');
        }).toThrow('Cheki does not support building searches');
      });
    });
  });

  describe('Parameter encoding and sanitization', () => {
    it('should encode special characters in query params', () => {
      const params = {
        q: 'Toyota Camry 2015 & Special',
        location: 'Lagos/Ikeja',
      };

      const encoded = encodeQueryParams(params);

      expect(encoded).toContain('Toyota%20Camry%202015%20%26%20Special');
      expect(encoded).toContain('Lagos%2FIkeja');
    });

    it('should handle empty params object', () => {
      const encoded = encodeQueryParams({});
      expect(encoded).toBe('');
    });

    it('should handle params with special characters', () => {
      const query = buildVehicleQuery('Mercedes-Benz', 'C-Class', 2021, 'jiji');
      const fullUrl = buildFullUrl(query);

      expect(() => new URL(fullUrl)).not.toThrow();
      expect(fullUrl).toContain('Mercedes-Benz');
    });

    it('should trim whitespace from inputs', () => {
      const query = buildVehicleQuery('  Toyota  ', '  Camry  ', 2015, 'jiji');

      expect(query.params.q).toBe('Toyota Camry 2015');
      expect(query.params.q).not.toContain('  ');
    });

    it('should handle unicode characters', () => {
      const query = buildBuildingQuery('Lágos', 'apártment', 100, 'jiji');

      expect(query.params.q).toContain('Lágos');
      expect(query.params.q).toContain('apártment');
    });
  });

  describe('Invalid property types', () => {
    it('should throw error for unknown property type', () => {
      const property: PropertyIdentifier = {
        type: 'unknown' as any,
      };

      expect(() => {
        buildSearchQuery(property, 'jiji');
      }).toThrow('Unsupported property type');
    });

    it('should throw error for unknown source', () => {
      expect(() => {
        buildVehicleQuery('Toyota', 'Camry', 2015, 'unknown-source');
      }).toThrow('Unknown source');
    });

    it('should throw error for missing required vehicle fields', () => {
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'vehicle',
          make: 'Toyota',
          // Missing model and year
        } as any;
        buildSearchQuery(property, 'jiji');
      }).toThrow();
    });

    it('should throw error for missing required electronics fields', () => {
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'electronics',
          brand: 'Samsung',
          // Missing productModel
        } as any;
        buildSearchQuery(property, 'jiji');
      }).toThrow();
    });

    it('should throw error for missing required building fields', () => {
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'building',
          location: 'Lagos',
          // Missing propertyType
        } as any;
        buildSearchQuery(property, 'jiji');
      }).toThrow();
    });
  });

  describe('Edge case values', () => {
    it('should handle minimum valid year', () => {
      const query = buildVehicleQuery('Ford', 'Model T', 1900, 'jiji');

      expect(query.params.q).toContain('1900');
    });

    it('should handle current year + 1 (next year models)', () => {
      const nextYear = new Date().getFullYear() + 1;
      const query = buildVehicleQuery('Tesla', 'Model 3', nextYear, 'jiji');

      expect(query.params.q).toContain(nextYear.toString());
    });

    it('should handle building with zero size', () => {
      const query = buildBuildingQuery('Lagos', 'land', 0, 'jiji');

      expect(query.params.q).toContain('land');
      expect(query.params.q).toContain('Lagos');
    });

    it('should handle very long property names', () => {
      const longMake = 'A'.repeat(50);
      const longModel = 'B'.repeat(50);

      const query = buildVehicleQuery(longMake, longModel, 2020, 'jiji');

      expect(query.params.q).toContain(longMake);
      expect(query.params.q).toContain(longModel);
    });

    it('should handle single character inputs', () => {
      const query = buildVehicleQuery('A', 'B', 2020, 'jiji');

      expect(query.params.q).toBe('A B 2020');
    });
  });

  describe('URL construction', () => {
    it('should build full URL with query parameters', () => {
      const query = buildVehicleQuery('Toyota', 'Camry', 2015, 'jiji');
      const fullUrl = buildFullUrl(query);

      expect(fullUrl).toBe('https://jiji.ng/cars?q=Toyota%20Camry%202015');
    });

    it('should build full URL without query parameters when empty', () => {
      const query = {
        source: 'jiji',
        url: 'https://jiji.ng/cars',
        params: {},
      };

      const fullUrl = buildFullUrl(query);

      expect(fullUrl).toBe('https://jiji.ng/cars');
    });

    it('should handle multiple query parameters', () => {
      const query = buildVehicleQuery('BMW', 'X5', 2020, 'cars45');
      const fullUrl = buildFullUrl(query);

      expect(fullUrl).toContain('make=bmw');
      expect(fullUrl).toContain('model=x5');
      expect(fullUrl).toContain('year=2020');
    });
  });

  describe('Property validation', () => {
    it('should validate complete vehicle property', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
        mileage: 50000,
      };

      expect(() => validatePropertyIdentifier(property)).not.toThrow();
    });

    it('should validate complete electronics property', () => {
      const property: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Samsung',
        productModel: 'Galaxy S21',
        productType: 'smartphone',
      };

      expect(() => validatePropertyIdentifier(property)).not.toThrow();
    });

    it('should validate complete building property', () => {
      const property: PropertyIdentifier = {
        type: 'building',
        location: 'Lagos',
        propertyType: 'apartment',
        size: 120,
        bedrooms: 3,
      };

      expect(() => validatePropertyIdentifier(property)).not.toThrow();
    });

    it('should reject negative building size', () => {
      const property: PropertyIdentifier = {
        type: 'building',
        location: 'Lagos',
        propertyType: 'apartment',
        size: -100,
      };

      expect(() => validatePropertyIdentifier(property)).toThrow('Building size must be positive');
    });

    it('should reject year before 1900', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Ford',
        model: 'Model T',
        year: 1899,
      };

      expect(() => validatePropertyIdentifier(property)).toThrow('Vehicle year must be between');
    });

    it('should reject year too far in future', () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Tesla',
        model: 'Cybertruck',
        year: new Date().getFullYear() + 2,
      };

      expect(() => validatePropertyIdentifier(property)).toThrow('Vehicle year must be between');
    });
  });

  describe('Source support queries', () => {
    it('should return all vehicle sources', () => {
      const sources = getSupportedSources('vehicle');

      expect(sources).toHaveLength(4);
      expect(sources).toEqual(['jiji', 'jumia', 'cars45', 'cheki']);
    });

    it('should return limited electronics sources', () => {
      const sources = getSupportedSources('electronics');

      expect(sources).toHaveLength(2);
      expect(sources).toEqual(['jiji', 'jumia']);
    });

    it('should return single building source', () => {
      const sources = getSupportedSources('building');

      expect(sources).toHaveLength(1);
      expect(sources).toEqual(['jiji']);
    });

    it('should return empty array for unknown property type', () => {
      const sources = getSupportedSources('unknown');

      expect(sources).toHaveLength(0);
    });

    it('should correctly identify supported combinations', () => {
      expect(isSourceSupported('jiji', 'vehicle')).toBe(true);
      expect(isSourceSupported('jiji', 'electronics')).toBe(true);
      expect(isSourceSupported('jiji', 'building')).toBe(true);

      expect(isSourceSupported('jumia', 'vehicle')).toBe(true);
      expect(isSourceSupported('jumia', 'electronics')).toBe(true);
      expect(isSourceSupported('jumia', 'building')).toBe(false);

      expect(isSourceSupported('cars45', 'vehicle')).toBe(true);
      expect(isSourceSupported('cars45', 'electronics')).toBe(false);
      expect(isSourceSupported('cars45', 'building')).toBe(false);

      expect(isSourceSupported('cheki', 'vehicle')).toBe(true);
      expect(isSourceSupported('cheki', 'electronics')).toBe(false);
      expect(isSourceSupported('cheki', 'building')).toBe(false);
    });
  });
});
