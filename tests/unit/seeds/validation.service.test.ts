import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from '@/features/seeds/services/validation.service';

/**
 * Unit Tests for Validation Service
 * 
 * Tests validation logic for vehicle valuation and damage deduction records.
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 12.1, 12.2, 12.3, 12.4
 * Task: 4.2 Write unit tests for ValidationService
 */

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  describe('validateValuation', () => {
    describe('Required Fields Validation', () => {
      it('should reject valuation with missing make', () => {
        const invalidRecord = {
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({
          field: 'make',
          constraint: 'required',
          message: expect.stringContaining('required'),
        });
      });

      it('should reject valuation with missing model', () => {
        const invalidRecord = {
          make: 'Toyota',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({
          field: 'model',
          constraint: 'required',
        });
      });

      it('should reject valuation with missing year', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'year')).toBe(true);
      });

      it('should reject valuation with missing conditionCategory', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'conditionCategory')).toBe(true);
      });

      it('should reject valuation with missing lowPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'lowPrice')).toBe(true);
      });

      it('should reject valuation with null lowPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: null,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'lowPrice')).toBe(true);
      });

      it('should reject valuation with missing highPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'highPrice')).toBe(true);
      });

      it('should reject valuation with missing averagePrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'averagePrice')).toBe(true);
      });

      it('should reject valuation with missing dataSource', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'dataSource')).toBe(true);
      });

      it('should reject valuation with multiple missing fields', () => {
        const invalidRecord = {
          make: 'Toyota',
          // Missing: model, year, conditionCategory, prices, dataSource
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe('Price Range Validation', () => {
      it('should reject valuation with lowPrice > highPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 5000000,
          highPrice: 3000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'lowPrice' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should reject valuation with averagePrice < lowPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 2000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'averagePrice' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should reject valuation with averagePrice > highPrice', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 6000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'averagePrice' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should accept valuation with averagePrice equal to lowPrice', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 3000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valuation with averagePrice equal to highPrice', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 5000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Year Validation', () => {
      it('should reject valuation with year < 1900', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 1899,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'year' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should reject valuation with year > 2100', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2101,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'year' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should accept valuation with year = 1900', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 1900,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should accept valuation with year = 2100', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2100,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should reject valuation with non-numeric year', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: '2020' as any,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'year')).toBe(true);
      });
    });

    describe('Valid Valuation Records', () => {
      it('should accept valid valuation record', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 3000000,
          highPrice: 5000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept valuation with zero prices', () => {
        const validRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 0,
          highPrice: 0,
          averagePrice: 0,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(validRecord);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateDeduction', () => {
    describe('Required Fields Validation', () => {
      it('should reject deduction with missing make', () => {
        const invalidRecord = {
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'make')).toBe(true);
      });

      it('should reject deduction with missing component', () => {
        const invalidRecord = {
          make: 'Toyota',
          damageLevel: 'minor',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'component')).toBe(true);
      });

      it('should reject deduction with missing damageLevel', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'damageLevel')).toBe(true);
      });

      it('should reject deduction with missing repairCostLow', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'repairCostLow')).toBe(true);
      });

      it('should reject deduction with missing repairCostHigh', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostLow: 50000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'repairCostHigh')).toBe(true);
      });

      it('should reject deduction with missing valuationDeductionLow', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'valuationDeductionLow')).toBe(true);
      });

      it('should reject deduction with missing valuationDeductionHigh', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'valuationDeductionHigh')).toBe(true);
      });

      it('should reject deduction with null repairCostLow', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor',
          repairCostLow: null,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'repairCostLow')).toBe(true);
      });
    });

    describe('Damage Level Enum Validation', () => {
      it('should reject deduction with invalid damageLevel', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'critical',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'damageLevel' && e.constraint === 'enum'
        )).toBe(true);
      });

      it('should accept deduction with damageLevel = minor', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should accept deduction with damageLevel = moderate', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'moderate' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should accept deduction with damageLevel = severe', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'severe' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should reject deduction with empty string damageLevel', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: '',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Repair Cost Range Validation', () => {
      it('should reject deduction with repairCostLow > repairCostHigh', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 100000,
          repairCostHigh: 50000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'repairCostLow' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should accept deduction with repairCostLow = repairCostHigh', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 75000,
          repairCostHigh: 75000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });

      it('should reject deduction with valuationDeductionLow > valuationDeductionHigh', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 200000,
          valuationDeductionHigh: 100000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'valuationDeductionLow' && e.constraint === 'range'
        )).toBe(true);
      });

      it('should accept deduction with valuationDeductionLow = valuationDeductionHigh', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 150000,
          valuationDeductionHigh: 150000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });
    });

    describe('Valid Deduction Records', () => {
      it('should accept valid deduction record', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept deduction with optional notes field', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
          notes: 'Common damage for urban driving',
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept deduction with zero costs', () => {
        const validRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'minor' as const,
          repairCostLow: 0,
          repairCostHigh: 0,
          valuationDeductionLow: 0,
          valuationDeductionHigh: 0,
        };

        const result = service.validateDeduction(validRecord);

        expect(result.valid).toBe(true);
      });
    });

    describe('Error Message Quality', () => {
      it('should provide descriptive error messages for valuation', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: 5000000,
          highPrice: 3000000,
          averagePrice: 4000000,
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        const rangeError = result.errors.find(e => e.constraint === 'range');
        expect(rangeError).toBeDefined();
        expect(rangeError?.message).toContain('5000000');
        expect(rangeError?.message).toContain('3000000');
      });

      it('should provide descriptive error messages for deduction', () => {
        const invalidRecord = {
          make: 'Toyota',
          component: 'Front Bumper',
          damageLevel: 'extreme',
          repairCostLow: 50000,
          repairCostHigh: 100000,
          valuationDeductionLow: 100000,
          valuationDeductionHigh: 200000,
        };

        const result = service.validateDeduction(invalidRecord);

        expect(result.valid).toBe(false);
        const enumError = result.errors.find(e => e.constraint === 'enum');
        expect(enumError).toBeDefined();
        expect(enumError?.message).toContain('minor');
        expect(enumError?.message).toContain('moderate');
        expect(enumError?.message).toContain('severe');
        expect(enumError?.message).toContain('extreme');
      });

      it('should include field names in error messages', () => {
        const invalidRecord = {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          dataSource: 'market-research',
        };

        const result = service.validateValuation(invalidRecord);

        expect(result.valid).toBe(false);
        result.errors.forEach(error => {
          expect(error.field).toBeDefined();
          expect(error.constraint).toBeDefined();
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
