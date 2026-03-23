import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  buildSearchQuery,
  buildVehicleQuery,
  buildElectronicsQuery,
  buildBuildingQuery,
  validatePropertyIdentifier,
  getSupportedSources,
  isSourceSupported,
  buildFullUrl,
} from '../../../src/features/market-data/services/query-builder.service';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';

/**
 * Feature: market-data-scraping-system
 * Property 2: Property-specific query construction
 * 
 * Validates: Requirements 1.2, 1.3, 1.4, 10.5
 */

describe('Query Construction Property Tests', () => {
  describe('Property 2: Property-specific query construction', () => {
    it('should construct vehicle queries with all required parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1990, max: new Date().getFullYear() + 1 }),
          fc.constantFrom('jiji', 'jumia', 'cars45', 'cheki'),
          (make, model, year, source) => {
            const query = buildVehicleQuery(make, model, year, source);

            // Should have all required fields
            expect(query.source).toBe(source);
            expect(query.url).toBeDefined();
            expect(query.url).toContain('http');
            expect(query.params).toBeDefined();
            expect(typeof query.params).toBe('object');

            // URL should be valid
            expect(() => new URL(query.url)).not.toThrow();

            // Params should contain search information
            const paramValues = Object.values(query.params).join(' ').toLowerCase();
            expect(
              paramValues.includes(make.toLowerCase()) ||
              paramValues.includes(model.toLowerCase()) ||
              paramValues.includes(year.toString())
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should construct electronics queries with all required parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.constantFrom('jiji', 'jumia'),
          (brand, model, type, source) => {
            const query = buildElectronicsQuery(brand, model, type, source);

            // Should have all required fields
            expect(query.source).toBe(source);
            expect(query.url).toBeDefined();
            expect(query.url).toContain('http');
            expect(query.params).toBeDefined();

            // URL should be valid
            expect(() => new URL(query.url)).not.toThrow();

            // Params should contain search information
            const paramValues = Object.values(query.params).join(' ').toLowerCase();
            expect(
              paramValues.includes(brand.toLowerCase()) ||
              paramValues.includes(model.toLowerCase())
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should construct building queries with all required parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 0, max: 10000 }),
          fc.constant('jiji'),
          (location, propertyType, size, source) => {
            const query = buildBuildingQuery(location, propertyType, size, source);

            // Should have all required fields
            expect(query.source).toBe(source);
            expect(query.url).toBeDefined();
            expect(query.url).toContain('http');
            expect(query.params).toBeDefined();

            // URL should be valid
            expect(() => new URL(query.url)).not.toThrow();

            // Params should contain search information
            const paramValues = Object.values(query.params).join(' ').toLowerCase();
            expect(
              paramValues.includes(location.toLowerCase()) ||
              paramValues.includes(propertyType.toLowerCase())
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use buildSearchQuery to construct queries for any property type', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Vehicle property
            fc.record({
              type: fc.constant('vehicle' as const),
              make: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              model: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              year: fc.integer({ min: 1990, max: new Date().getFullYear() + 1 }),
            }),
            // Electronics property
            fc.record({
              type: fc.constant('electronics' as const),
              brand: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              productModel: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              productType: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            }),
            // Building property
            fc.record({
              type: fc.constant('building' as const),
              location: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              propertyType: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              size: fc.integer({ min: 0, max: 10000 }),
            })
          ),
          (property) => {
            const supportedSources = getSupportedSources(property.type);
            
            if (supportedSources.length === 0) {
              return; // Skip if no supported sources
            }

            const source = supportedSources[0];
            const query = buildSearchQuery(property, source);

            // Should construct valid query
            expect(query.source).toBe(source);
            expect(query.url).toBeDefined();
            expect(query.params).toBeDefined();
            expect(() => new URL(query.url)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should normalize whitespace in query parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `  ${s}  `),
          fc.string({ minLength: 1, maxLength: 50 }).map(s => `  ${s}  `),
          fc.integer({ min: 2000, max: 2025 }),
          fc.constantFrom('jiji', 'jumia'),
          (make, model, year, source) => {
            const query = buildVehicleQuery(make, model, year, source);

            // Should not have leading/trailing whitespace in params
            Object.values(query.params).forEach((value) => {
              if (typeof value === 'string') {
                expect(value).not.toMatch(/^\s+/);
                expect(value).not.toMatch(/\s+$/);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different queries for different property types', () => {
      const vehicle: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const electronics: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Samsung',
        productModel: 'Galaxy S21',
        productType: 'smartphone',
      };

      const vehicleQuery = buildSearchQuery(vehicle, 'jiji');
      const electronicsQuery = buildSearchQuery(electronics, 'jiji');

      // Should have different URLs or params
      expect(
        vehicleQuery.url !== electronicsQuery.url ||
        JSON.stringify(vehicleQuery.params) !== JSON.stringify(electronicsQuery.params)
      ).toBe(true);
    });
  });

  describe('Property validation', () => {
    it('should validate vehicle properties correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 1990, max: new Date().getFullYear() + 1 }),
          (make, model, year) => {
            const property: PropertyIdentifier = {
              type: 'vehicle',
              make,
              model,
              year,
            };

            // Should not throw for valid properties
            expect(() => validatePropertyIdentifier(property)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid vehicle years', () => {
      fc.assert(
        fc.property(
          fc.integer().filter(year => year < 1900 || year > new Date().getFullYear() + 1),
          (year) => {
            const property: PropertyIdentifier = {
              type: 'vehicle',
              make: 'Toyota',
              model: 'Camry',
              year,
            };

            // Should throw for invalid years
            expect(() => validatePropertyIdentifier(property)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject missing required fields', () => {
      // Missing make
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'vehicle',
          model: 'Camry',
          year: 2015,
        } as any;
        validatePropertyIdentifier(property);
      }).toThrow();

      // Missing brand for electronics
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'electronics',
          productModel: 'Galaxy S21',
        } as any;
        validatePropertyIdentifier(property);
      }).toThrow();

      // Missing location for building
      expect(() => {
        const property: PropertyIdentifier = {
          type: 'building',
          propertyType: 'apartment',
        } as any;
        validatePropertyIdentifier(property);
      }).toThrow();
    });
  });

  describe('Source support', () => {
    it('should return correct supported sources for each property type', () => {
      const vehicleSources = getSupportedSources('vehicle');
      expect(vehicleSources).toContain('jiji');
      expect(vehicleSources).toContain('jumia');
      expect(vehicleSources).toContain('cars45');
      expect(vehicleSources).toContain('cheki');

      const electronicsSources = getSupportedSources('electronics');
      expect(electronicsSources).toContain('jiji');
      expect(electronicsSources).toContain('jumia');
      expect(electronicsSources).not.toContain('cars45');

      const buildingSources = getSupportedSources('building');
      expect(buildingSources).toContain('jiji');
      expect(buildingSources).not.toContain('jumia');
    });

    it('should correctly identify source support', () => {
      expect(isSourceSupported('jiji', 'vehicle')).toBe(true);
      expect(isSourceSupported('cars45', 'electronics')).toBe(false);
      expect(isSourceSupported('jumia', 'building')).toBe(false);
    });

    it('should throw error for unsupported source-property combinations', () => {
      expect(() => {
        buildElectronicsQuery('Samsung', 'Galaxy', 'phone', 'cars45');
      }).toThrow();

      expect(() => {
        buildBuildingQuery('Lagos', 'apartment', 100, 'jumia');
      }).toThrow();
    });
  });

  describe('URL construction', () => {
    it('should build valid full URLs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.integer({ min: 2000, max: 2025 }),
          fc.constantFrom('jiji', 'jumia'),
          (make, model, year, source) => {
            const query = buildVehicleQuery(make, model, year, source);
            const fullUrl = buildFullUrl(query);

            // Should be a valid URL
            expect(() => new URL(fullUrl)).not.toThrow();

            // Should contain base URL
            expect(fullUrl).toContain(query.url);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
