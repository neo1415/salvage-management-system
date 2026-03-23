/**
 * Validation Service for Seed Data
 * 
 * Validates vehicle valuation and damage deduction records before insertion.
 * Ensures data integrity by checking required fields, data types, and range constraints.
 * 
 * @module ValidationService
 */

export interface ValidationError {
  field: string;
  constraint: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValuationRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  dataSource: string;
}

export interface DeductionRecord {
  make: string;
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostLow: number;
  repairCostHigh: number;
  valuationDeductionLow: number;
  valuationDeductionHigh: number;
  notes?: string;
}

export class ValidationService {
  /**
   * Validate a vehicle valuation record
   * 
   * Checks:
   * - Required fields: make, model, year, conditionCategory, lowPrice, highPrice, averagePrice, dataSource
   * - lowPrice <= averagePrice <= highPrice
   * - year is between 1900 and 2100
   * 
   * @param record - The valuation record to validate
   * @returns ValidationResult with valid flag and errors array
   */
  validateValuation(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required fields validation
    if (!record.make) errors.push(this.requiredError('make'));
    if (!record.model) errors.push(this.requiredError('model'));
    if (!record.year) errors.push(this.requiredError('year'));
    if (!record.conditionCategory) errors.push(this.requiredError('conditionCategory'));
    if (record.lowPrice === undefined || record.lowPrice === null) {
      errors.push(this.requiredError('lowPrice'));
    }
    if (record.highPrice === undefined || record.highPrice === null) {
      errors.push(this.requiredError('highPrice'));
    }
    if (record.averagePrice === undefined || record.averagePrice === null) {
      errors.push(this.requiredError('averagePrice'));
    }
    if (!record.dataSource) errors.push(this.requiredError('dataSource'));
    
    // Year validation (type and range)
    if (record.year !== undefined && record.year !== null) {
      if (typeof record.year !== 'number' || record.year < 1900 || record.year > 2100) {
        errors.push({
          field: 'year',
          constraint: 'range',
          message: `year must be a number between 1900 and 2100, got ${record.year}`,
        });
      }
    }
    
    // Price range validation (only if all prices are present)
    if (
      record.lowPrice !== undefined && record.lowPrice !== null &&
      record.highPrice !== undefined && record.highPrice !== null &&
      record.averagePrice !== undefined && record.averagePrice !== null
    ) {
      if (record.lowPrice > record.highPrice) {
        errors.push({
          field: 'lowPrice',
          constraint: 'range',
          message: `lowPrice (${record.lowPrice}) must be <= highPrice (${record.highPrice})`,
        });
      }
      
      if (record.averagePrice < record.lowPrice || record.averagePrice > record.highPrice) {
        errors.push({
          field: 'averagePrice',
          constraint: 'range',
          message: `averagePrice (${record.averagePrice}) must be between lowPrice (${record.lowPrice}) and highPrice (${record.highPrice})`,
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validate a damage deduction record
   * 
   * Checks:
   * - Required fields: make, component, damageLevel, repairCostLow, repairCostHigh, 
   *   valuationDeductionLow, valuationDeductionHigh
   * - damageLevel is one of: minor, moderate, severe
   * - repairCostLow <= repairCostHigh
   * - valuationDeductionLow <= valuationDeductionHigh
   * 
   * @param record - The deduction record to validate
   * @returns ValidationResult with valid flag and errors array
   */
  validateDeduction(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required fields validation
    if (!record.make) errors.push(this.requiredError('make'));
    if (!record.component) errors.push(this.requiredError('component'));
    if (!record.damageLevel) errors.push(this.requiredError('damageLevel'));
    if (record.repairCostLow === undefined || record.repairCostLow === null) {
      errors.push(this.requiredError('repairCostLow'));
    }
    if (record.repairCostHigh === undefined || record.repairCostHigh === null) {
      errors.push(this.requiredError('repairCostHigh'));
    }
    if (record.valuationDeductionLow === undefined || record.valuationDeductionLow === null) {
      errors.push(this.requiredError('valuationDeductionLow'));
    }
    if (record.valuationDeductionHigh === undefined || record.valuationDeductionHigh === null) {
      errors.push(this.requiredError('valuationDeductionHigh'));
    }
    
    // Enum validation for damageLevel
    if (record.damageLevel && !['minor', 'moderate', 'severe'].includes(record.damageLevel)) {
      errors.push({
        field: 'damageLevel',
        constraint: 'enum',
        message: `damageLevel must be one of: minor, moderate, severe. Got: ${record.damageLevel}`,
      });
    }
    
    // Range validation for repair costs (only if both are present)
    if (
      record.repairCostLow !== undefined && record.repairCostLow !== null &&
      record.repairCostHigh !== undefined && record.repairCostHigh !== null
    ) {
      if (record.repairCostLow > record.repairCostHigh) {
        errors.push({
          field: 'repairCostLow',
          constraint: 'range',
          message: `repairCostLow (${record.repairCostLow}) must be <= repairCostHigh (${record.repairCostHigh})`,
        });
      }
    }
    
    // Range validation for valuation deductions (only if both are present)
    if (
      record.valuationDeductionLow !== undefined && record.valuationDeductionLow !== null &&
      record.valuationDeductionHigh !== undefined && record.valuationDeductionHigh !== null
    ) {
      if (record.valuationDeductionLow > record.valuationDeductionHigh) {
        errors.push({
          field: 'valuationDeductionLow',
          constraint: 'range',
          message: `valuationDeductionLow (${record.valuationDeductionLow}) must be <= valuationDeductionHigh (${record.valuationDeductionHigh})`,
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Create a required field validation error
   * 
   * @param field - The field name that is required
   * @returns ValidationError object
   */
  private requiredError(field: string): ValidationError {
    return {
      field,
      constraint: 'required',
      message: `${field} is required but was undefined or null`,
    };
  }
}

// Export singleton instance
export const validationService = new ValidationService();
