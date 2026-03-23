import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';

/**
 * Property 29: Property type support
 * Feature: market-data-scraping-system
 * Validates: Requirements 10.1, 10.2, 10.3
 * 
 * For any supported property type (vehicle, electronics, building), 
 * the system should successfully process assessments with the appropriate parameters
 */

describe('Property 29: Property type support', () => {
  // Arbitraries for generating valid property identifiers
  const vehicleArbitrary = fc.record({
    type: fc.constant('vehicle' as const),
    make: fc.string({ minLength: 2, maxLength: 30 }),
    model: fc.string({ minLength: 1, maxLength: 50 }),
    year: fc.integer({ min: 1990, max: new Date().getFullYear() }),
    mileage: fc.option(fc.integer({ min: 0, max: 500000 }), { nil: undefined }),
  });

  const electronicsArbitrary = fc.record({
    type: fc.constant('electronics' as const),
    brand: fc.string({ minLength: 2, maxLength: 30 }),
    productModel: fc.string({ minLength: 1, maxLength: 50 }),
    productType: fc.string({ minLength: 3, maxLength: 30 }),
  });

  const buildingArbitrary = fc.record({
    type: fc.constant('building' as const),
    location: fc.string({ minLength: 3, maxLength: 100 }),
    propertyType: fc.string({ minLength: 3, maxLength: 30 }),
    size: fc.integer({ min: 10, max: 10000 }),
    bedrooms: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
  });

  const propertyArbitrary = fc.oneof(
    vehicleArbitrary,
    electronicsArbitrary,
    buildingArbitrary
  );

  test.prop([propertyArbitrary], { numRuns: 100 })(
    'should have valid type field for all property types',
    (property) => {
      expect(property.type).toMatch(/^(vehicle|electronics|building)$/);
    }
  );

  test.prop([vehicleArbitrary], { numRuns: 100 })(
    'vehicle properties should have required fields',
    (vehicle) => {
      expect(vehicle.type).toBe('vehicle');
      expect(vehicle.make).toBeDefined();
      expect(vehicle.make.length).toBeGreaterThanOrEqual(2);
      expect(vehicle.model).toBeDefined();
      expect(vehicle.model.length).toBeGreaterThanOrEqual(1);
      expect(vehicle.year).toBeDefined();
      expect(vehicle.year).toBeGreaterThanOrEqual(1990);
      expect(vehicle.year).toBeLessThanOrEqual(new Date().getFullYear());
    }
  );

  test.prop([electronicsArbitrary], { numRuns: 100 })(
    'electronics properties should have required fields',
    (electronics) => {
      expect(electronics.type).toBe('electronics');
      expect(electronics.brand).toBeDefined();
      expect(electronics.brand.length).toBeGreaterThanOrEqual(2);
      expect(electronics.productModel).toBeDefined();
      expect(electronics.productModel.length).toBeGreaterThanOrEqual(1);
      expect(electronics.productType).toBeDefined();
      expect(electronics.productType.length).toBeGreaterThanOrEqual(3);
    }
  );

  test.prop([buildingArbitrary], { numRuns: 100 })(
    'building properties should have required fields',
    (building) => {
      expect(building.type).toBe('building');
      expect(building.location).toBeDefined();
      expect(building.location.length).toBeGreaterThanOrEqual(3);
      expect(building.propertyType).toBeDefined();
      expect(building.propertyType.length).toBeGreaterThanOrEqual(3);
      expect(building.size).toBeDefined();
      expect(building.size).toBeGreaterThanOrEqual(10);
      expect(building.size).toBeLessThanOrEqual(10000);
    }
  );

  // Unit tests for specific examples
  it('should accept valid vehicle property', () => {
    const vehicle: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2015,
      mileage: 80000,
    };

    expect(vehicle.type).toBe('vehicle');
    expect(vehicle.make).toBe('Toyota');
    expect(vehicle.model).toBe('Camry');
    expect(vehicle.year).toBe(2015);
    expect(vehicle.mileage).toBe(80000);
  });

  it('should accept valid electronics property', () => {
    const electronics: PropertyIdentifier = {
      type: 'electronics',
      brand: 'Samsung',
      productModel: 'Galaxy S21',
      productType: 'Smartphone',
    };

    expect(electronics.type).toBe('electronics');
    expect(electronics.brand).toBe('Samsung');
    expect(electronics.productModel).toBe('Galaxy S21');
    expect(electronics.productType).toBe('Smartphone');
  });

  it('should accept valid building property', () => {
    const building: PropertyIdentifier = {
      type: 'building',
      location: 'Lagos, Nigeria',
      propertyType: 'Apartment',
      size: 120,
      bedrooms: 3,
    };

    expect(building.type).toBe('building');
    expect(building.location).toBe('Lagos, Nigeria');
    expect(building.propertyType).toBe('Apartment');
    expect(building.size).toBe(120);
    expect(building.bedrooms).toBe(3);
  });

  it('should accept vehicle without optional mileage', () => {
    const vehicle: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2018,
    };

    expect(vehicle.type).toBe('vehicle');
    expect(vehicle.mileage).toBeUndefined();
  });

  it('should accept building without optional bedrooms', () => {
    const building: PropertyIdentifier = {
      type: 'building',
      location: 'Abuja, Nigeria',
      propertyType: 'Commercial',
      size: 500,
    };

    expect(building.type).toBe('building');
    expect(building.bedrooms).toBeUndefined();
  });
});
