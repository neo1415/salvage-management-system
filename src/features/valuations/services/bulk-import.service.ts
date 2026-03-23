import { parse } from 'csv-parse/sync';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { valuationSchema, deductionSchema, type ValuationInput, type DeductionInput } from '../validation/schemas';
import { eq, and } from 'drizzle-orm';

/**
 * Bulk Import Service for Vehicle Valuations and Damage Deductions
 * 
 * Supports CSV and JSON import formats with validation and upsert behavior.
 * Implements error resilience - continues processing valid records even when some fail.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

export interface ImportRecord extends ValuationInput {
  dataSource: string;
}

export interface DeductionImportRecord extends DeductionInput {}

export interface ImportResult {
  totalRecords: number;
  successCount: number;
  updateCount: number;
  insertCount: number;
  failureCount: number;
  errors: Array<{
    row: number;
    record: Partial<ImportRecord | DeductionImportRecord>;
    error: string;
  }>;
}

export class BulkImportService {
  /**
   * Import vehicle valuations from CSV
   * Requirements: 8.1, 8.3, 8.4, 8.5
   */
  async importValuationsFromCSV(
    fileContent: string,
    userId: string
  ): Promise<ImportResult> {
    const records = this.parseCSV(fileContent);
    return this.importValuations(records, userId);
  }

  /**
   * Import vehicle valuations from JSON
   * Requirements: 8.2, 8.3, 8.4, 8.5
   */
  async importValuationsFromJSON(
    data: ImportRecord[],
    userId: string
  ): Promise<ImportResult> {
    return this.importValuations(data, userId);
  }

  /**
   * Import damage deductions from CSV
   * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6
   */
  async importDeductionsFromCSV(
    fileContent: string,
    userId: string
  ): Promise<ImportResult> {
    const records = this.parseDeductionCSV(fileContent);
    return this.importDeductions(records, userId);
  }

  /**
   * Import damage deductions from JSON
   * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
   */
  async importDeductionsFromJSON(
    data: DeductionImportRecord[],
    userId: string
  ): Promise<ImportResult> {
    return this.importDeductions(data, userId);
  }

  /**
   * Parse CSV content to valuation records
   * Requirements: 8.1
   */
  parseCSV(content: string): ImportRecord[] {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Cast numeric fields
        if (['year', 'mileageLow', 'mileageHigh'].includes(context.column as string)) {
          return value === '' ? undefined : parseInt(value, 10);
        }
        if (['lowPrice', 'highPrice', 'averagePrice'].includes(context.column as string)) {
          return parseFloat(value);
        }
        return value;
      },
    });

    return records;
  }

  /**
   * Parse CSV content to deduction records
   * Requirements: 8.1, 8.6
   */
  parseDeductionCSV(content: string): DeductionImportRecord[] {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Cast numeric fields
        if (['repairCostEstimate', 'valuationDeductionPercent'].includes(context.column as string)) {
          return parseFloat(value);
        }
        return value;
      },
    });

    return records;
  }

  /**
   * Validate valuation record
   * Requirements: 8.3
   */
  validateValuationRecord(record: ImportRecord): { valid: boolean; errors: string[] } {
    const result = valuationSchema.safeParse(record);
    
    if (result.success) {
      return { valid: true, errors: [] };
    }
    
    const errors = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    );
    
    return { valid: false, errors };
  }

  /**
   * Validate deduction record
   * Requirements: 8.3, 8.6
   */
  validateDeductionRecord(record: DeductionImportRecord): { valid: boolean; errors: string[] } {
    const result = deductionSchema.safeParse(record);
    
    if (result.success) {
      return { valid: true, errors: [] };
    }
    
    const errors = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    );
    
    return { valid: false, errors };
  }

  /**
   * Import valuations with upsert behavior
   * Requirements: 8.3, 8.4, 8.5
   */
  private async importValuations(
    records: ImportRecord[],
    userId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRecords: records.length,
      successCount: 0,
      updateCount: 0,
      insertCount: 0,
      failureCount: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Validate record
        const validation = this.validateValuationRecord(record);
        if (!validation.valid) {
          result.failureCount++;
          result.errors.push({
            row: i + 1,
            record,
            error: validation.errors.join('; '),
          });
          continue;
        }

        // Check if record exists (upsert behavior)
        const existing = await db.query.vehicleValuations.findFirst({
          where: and(
            eq(vehicleValuations.make, record.make),
            eq(vehicleValuations.model, record.model),
            eq(vehicleValuations.year, record.year),
            eq(vehicleValuations.conditionCategory, record.conditionCategory)
          ),
        });

        if (existing) {
          // Update existing record
          await db.update(vehicleValuations)
            .set({
              lowPrice: record.lowPrice.toString(),
              highPrice: record.highPrice.toString(),
              averagePrice: record.averagePrice.toString(),
              mileageLow: record.mileageLow,
              mileageHigh: record.mileageHigh,
              marketNotes: record.marketNotes,
              dataSource: record.dataSource,
              updatedAt: new Date(),
            })
            .where(eq(vehicleValuations.id, existing.id));
          
          result.updateCount++;
        } else {
          // Insert new record
          await db.insert(vehicleValuations).values({
            make: record.make,
            model: record.model,
            year: record.year,
            conditionCategory: record.conditionCategory,
            lowPrice: record.lowPrice.toString(),
            highPrice: record.highPrice.toString(),
            averagePrice: record.averagePrice.toString(),
            mileageLow: record.mileageLow,
            mileageHigh: record.mileageHigh,
            marketNotes: record.marketNotes,
            dataSource: record.dataSource,
            createdBy: userId,
          });
          
          result.insertCount++;
        }

        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          row: i + 1,
          record,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Import deductions with upsert behavior
   * Requirements: 8.3, 8.4, 8.5, 8.6
   */
  private async importDeductions(
    records: DeductionImportRecord[],
    userId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      totalRecords: records.length,
      successCount: 0,
      updateCount: 0,
      insertCount: 0,
      failureCount: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Validate record
        const validation = this.validateDeductionRecord(record);
        if (!validation.valid) {
          result.failureCount++;
          result.errors.push({
            row: i + 1,
            record,
            error: validation.errors.join('; '),
          });
          continue;
        }

        // Check if record exists (upsert behavior)
        const existing = await db.query.damageDeductions.findFirst({
          where: and(
            eq(damageDeductions.component, record.component),
            eq(damageDeductions.damageLevel, record.damageLevel)
          ),
        });

        if (existing) {
          // Update existing record
          await db.update(damageDeductions)
            .set({
              repairCostEstimate: record.repairCostEstimate.toString(),
              valuationDeductionPercent: record.valuationDeductionPercent.toString(),
              description: record.description,
              updatedAt: new Date(),
            })
            .where(eq(damageDeductions.id, existing.id));
          
          result.updateCount++;
        } else {
          // Insert new record
          await db.insert(damageDeductions).values({
            component: record.component,
            damageLevel: record.damageLevel,
            repairCostEstimate: record.repairCostEstimate.toString(),
            valuationDeductionPercent: record.valuationDeductionPercent.toString(),
            description: record.description,
            createdBy: userId,
          });
          
          result.insertCount++;
        }

        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          row: i + 1,
          record,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }
}

// Export singleton instance
export const bulkImportService = new BulkImportService();
