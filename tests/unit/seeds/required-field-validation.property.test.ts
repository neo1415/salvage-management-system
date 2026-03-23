import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validationService } from '@/features/seeds/services/validation.service';

/**
 * Property-Based Tests for Required Field Validation
 * 
 * **Validates: Requirements 8.3, 12.1**
 * 
 * Property 3: Required Field Validation
 * For any seed record (valuation or deduction), if any required field is missing or null,
 * the system SHALL reject the record with a validation error and skip insertion.
 * 
 * Feature: enterprise-data-seeding-system
 * Property 3: Required Field Validation
 * Task: 4.3 Write property test for required field validation
 */

// Generators for valid records
const validValuationGenerator = () => fc.record({
  make: fc.string({ minLength: 1, maxLength: 50 }),
  model: fc.string({ minLength: 1, maxLength: 50 }),
  year: fc.integer({ min: 1900, max: 2100 }),
  conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high'),
  lowPrice: fc.integer({ min: 0, max: 100000000 }),
  highPrice: fc.integer({ min: 0, max: 100000000 }),
  averagePrice: fc.integer({ min: 0, max: 100000000 }),
  dataSource: fc.string({ minLength: 1, maxLength: 100 }),
}).map(record => ({
  ...record,
  // Ensure price range is valid
  lowPrice: Math.min(record.lowPrice, record.highPrice),
  highPrice: Math.max(record.lowPrice, record.highPrice),
  averagePrice: Math.min(Math.max(record.lowPrice, record.averagePrice), record.highPrice),
}));

const validDeductionGenerator = () => fc.record({
  make: fc.string({ minLength: 1, maxLength: 50 }),
  component: fc.string({ minLength: 1, maxLength: 100 }),
  damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
  repairCostLow: fc.integer({ min: 0, max: 10000000 }),
  repairCostHigh: fc.integer({ min: 0, max: 10000000 }),
  valuationDeductionLow: fc.integer({ min: 0, max: 10000000 }),
  valuationDeductionHigh: fc.integer({ min: 0, max: 10000000 }),
  notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
}).map(record => ({
  ...record,
  // Ensure cost ranges are valid
  repairCostLow: Math.min(record.repairCostLow, record.repairCostHigh),
  repairCostHigh: Math.max(record.repairCostLow, record.repairCostHigh),
  valuationDeductionLow: Math.min(record.valuationDeductionLow, record.valuationDeductionHigh),
  valuationDeductionHigh: Math.max(record.valuationDeductionLow, record.valuationDeductionHigh),
}));

describe('Property 3: Required Field Validation', () => {
  describe('Valuation Records', () => {
    it('should reject valuation records with any required field missing', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          fc.constantFrom('make', 'model', 'year', 'conditionCategory', 'lowPrice', 'highPrice', 'averagePrice', 'dataSource'),
          (validRecord, fieldToRemove) => {
            // Create a record with one required field missing
            const recordWithMissingField = { ...validRecord };
            delete (recordWithMissingField as any)[fieldToRemove];
            
            // Validate the record
            const result = validationService.validateValuation(recordWithMissingField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the missing field
            const hasErrorForField = result.errors.some(e => e.field === fieldToRemove);
            expect(hasErrorForField).toBe(true);
            
            // Assert: Error should have 'required' constraint
            const requiredError = result.errors.find(e => e.field === fieldToRemove);
            expect(requiredError?.constraint).toBe('required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject valuation records with any required field set to null', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          fc.constantFrom('make', 'model', 'year', 'conditionCategory', 'lowPrice', 'highPrice', 'averagePrice', 'dataSource'),
          (validRecord, fieldToNull) => {
            // Create a record with one required field set to null
            const recordWithNullField = { ...validRecord, [fieldToNull]: null };
            
            // Validate the record
            const result = validationService.validateValuation(recordWithNullField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the null field
            const hasErrorForField = result.errors.some(e => e.field === fieldToNull);
            expect(hasErrorForField).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject valuation records with multiple required fields missing', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          fc.subarray(['make', 'model', 'year', 'conditionCategory', 'lowPrice', 'highPrice', 'averagePrice', 'dataSource'], { minLength: 2, maxLength: 5 }),
          (validRecord, fieldsToRemove) => {
            // Create a record with multiple required fields missing
            const recordWithMissingFields = { ...validRecord };
            fieldsToRemove.forEach(field => {
              delete (recordWithMissingFields as any)[field];
            });
            
            // Validate the record
            const result = validationService.validateValuation(recordWithMissingFields);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Should have at least as many errors as missing fields
            expect(result.errors.length).toBeGreaterThanOrEqual(fieldsToRemove.length);
            
            // Assert: Each missing field should have an error
            fieldsToRemove.forEach(field => {
              const hasErrorForField = result.errors.some(e => e.field === field);
              expect(hasErrorForField).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valuation records with all required fields present', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          (validRecord) => {
            // Validate the complete record
            const result = validationService.validateValuation(validRecord);
            
            // Assert: Record should be accepted (no required field errors)
            // Note: May still have range validation errors, but not required field errors
            const hasRequiredFieldError = result.errors.some(e => e.constraint === 'required');
            expect(hasRequiredFieldError).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject valuation records with empty string for string fields', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          fc.constantFrom('make', 'model', 'conditionCategory', 'dataSource'),
          (validRecord, fieldToEmpty) => {
            // Create a record with one string field set to empty string
            const recordWithEmptyField = { ...validRecord, [fieldToEmpty]: '' };
            
            // Validate the record
            const result = validationService.validateValuation(recordWithEmptyField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the empty field
            const hasErrorForField = result.errors.some(e => e.field === fieldToEmpty);
            expect(hasErrorForField).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Deduction Records', () => {
    it('should reject deduction records with any required field missing', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          fc.constantFrom('make', 'component', 'damageLevel', 'repairCostLow', 'repairCostHigh', 'valuationDeductionLow', 'valuationDeductionHigh'),
          (validRecord, fieldToRemove) => {
            // Create a record with one required field missing
            const recordWithMissingField = { ...validRecord };
            delete (recordWithMissingField as any)[fieldToRemove];
            
            // Validate the record
            const result = validationService.validateDeduction(recordWithMissingField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the missing field
            const hasErrorForField = result.errors.some(e => e.field === fieldToRemove);
            expect(hasErrorForField).toBe(true);
            
            // Assert: Error should have 'required' constraint
            const requiredError = result.errors.find(e => e.field === fieldToRemove);
            expect(requiredError?.constraint).toBe('required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject deduction records with any required field set to null', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          fc.constantFrom('make', 'component', 'damageLevel', 'repairCostLow', 'repairCostHigh', 'valuationDeductionLow', 'valuationDeductionHigh'),
          (validRecord, fieldToNull) => {
            // Create a record with one required field set to null
            const recordWithNullField = { ...validRecord, [fieldToNull]: null };
            
            // Validate the record
            const result = validationService.validateDeduction(recordWithNullField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the null field
            const hasErrorForField = result.errors.some(e => e.field === fieldToNull);
            expect(hasErrorForField).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject deduction records with multiple required fields missing', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          fc.subarray(['make', 'component', 'damageLevel', 'repairCostLow', 'repairCostHigh', 'valuationDeductionLow', 'valuationDeductionHigh'], { minLength: 2, maxLength: 5 }),
          (validRecord, fieldsToRemove) => {
            // Create a record with multiple required fields missing
            const recordWithMissingFields = { ...validRecord };
            fieldsToRemove.forEach(field => {
              delete (recordWithMissingFields as any)[field];
            });
            
            // Validate the record
            const result = validationService.validateDeduction(recordWithMissingFields);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Should have at least as many errors as missing fields
            expect(result.errors.length).toBeGreaterThanOrEqual(fieldsToRemove.length);
            
            // Assert: Each missing field should have an error
            fieldsToRemove.forEach(field => {
              const hasErrorForField = result.errors.some(e => e.field === field);
              expect(hasErrorForField).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept deduction records with all required fields present', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          (validRecord) => {
            // Validate the complete record
            const result = validationService.validateDeduction(validRecord);
            
            // Assert: Record should be accepted (no required field errors)
            // Note: May still have range validation errors, but not required field errors
            const hasRequiredFieldError = result.errors.some(e => e.constraint === 'required');
            expect(hasRequiredFieldError).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject deduction records with empty string for string fields', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          fc.constantFrom('make', 'component', 'damageLevel'),
          (validRecord, fieldToEmpty) => {
            // Create a record with one string field set to empty string
            const recordWithEmptyField = { ...validRecord, [fieldToEmpty]: '' };
            
            // Validate the record
            const result = validationService.validateDeduction(recordWithEmptyField);
            
            // Assert: Record should be rejected
            expect(result.valid).toBe(false);
            
            // Assert: Error should mention the empty field
            const hasErrorForField = result.errors.some(e => e.field === fieldToEmpty);
            expect(hasErrorForField).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept deduction records with optional notes field missing', () => {
      fc.assert(
        fc.property(
          validDeductionGenerator(),
          (validRecord) => {
            // Create a record without the optional notes field
            const recordWithoutNotes = { ...validRecord };
            delete recordWithoutNotes.notes;
            
            // Validate the record
            const result = validationService.validateDeduction(recordWithoutNotes);
            
            // Assert: Record should not have required field error for notes
            const hasNotesRequiredError = result.errors.some(e => 
              e.field === 'notes' && e.constraint === 'required'
            );
            expect(hasNotesRequiredError).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cross-Record Type Validation', () => {
    it('should consistently reject records with missing fields across both types', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          validDeductionGenerator(),
          (valuation, deduction) => {
            // Remove a required field from each
            const invalidValuation = { ...valuation };
            delete invalidValuation.make;
            
            const invalidDeduction = { ...deduction };
            delete invalidDeduction.make;
            
            // Validate both
            const valuationResult = validationService.validateValuation(invalidValuation);
            const deductionResult = validationService.validateDeduction(invalidDeduction);
            
            // Assert: Both should be rejected
            expect(valuationResult.valid).toBe(false);
            expect(deductionResult.valid).toBe(false);
            
            // Assert: Both should have error for 'make' field
            expect(valuationResult.errors.some(e => e.field === 'make')).toBe(true);
            expect(deductionResult.errors.some(e => e.field === 'make')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear error messages for missing required fields', () => {
      fc.assert(
        fc.property(
          validValuationGenerator(),
          fc.constantFrom('make', 'model', 'year', 'conditionCategory', 'lowPrice', 'highPrice', 'averagePrice', 'dataSource'),
          (validRecord, fieldToRemove) => {
            // Create a record with one required field missing
            const recordWithMissingField = { ...validRecord };
            delete (recordWithMissingField as any)[fieldToRemove];
            
            // Validate the record
            const result = validationService.validateValuation(recordWithMissingField);
            
            // Assert: Error message should be descriptive
            const error = result.errors.find(e => e.field === fieldToRemove);
            expect(error).toBeDefined();
            expect(error?.message).toBeDefined();
            expect(error?.message.length).toBeGreaterThan(0);
            expect(error?.message.toLowerCase()).toContain('required');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
