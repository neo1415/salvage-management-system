/**
 * Idempotent Upsert Service
 * 
 * Provides idempotent upsert operations for vehicle valuations and damage deductions.
 * Ensures that running seed scripts multiple times produces the same database state.
 * 
 * Key Features:
 * - Checks for existing records using unique constraints
 * - Updates existing records while preserving createdAt and createdBy
 * - Inserts new records with System User attribution
 * - Converts numeric values to decimal string format
 * - Logs all modifications to audit trail
 * 
 * @module IdempotentUpsertService
 */

import { db } from '@/lib/db/drizzle';
import { 
  vehicleValuations, 
  damageDeductions, 
  valuationAuditLogs 
} from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Valuation record for upsert operations
 */
export interface ValuationRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  dataSource: string;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
}

/**
 * Deduction record for upsert operations
 */
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

/**
 * Result of an upsert operation
 */
export interface UpsertResult {
  action: 'inserted' | 'updated' | 'skipped';
  recordId: string;
  error?: Error;
}

/**
 * Service for idempotent upsert operations on vehicle data
 */
export class IdempotentUpsertService {
  /**
   * Upsert a vehicle valuation record
   * 
   * Checks for existing record using unique constraint (make, model, year, conditionCategory).
   * If exists, updates the record while preserving createdAt and createdBy.
   * If not exists, inserts new record with System User as createdBy.
   * 
   * @param valuation - The valuation record to upsert
   * @returns UpsertResult with action taken and record ID
   */
  async upsertValuation(valuation: ValuationRecord): Promise<UpsertResult> {
    try {
      // Check if record exists using unique constraint
      const existing = await db
        .select()
        .from(vehicleValuations)
        .where(
          and(
            eq(vehicleValuations.make, valuation.make),
            eq(vehicleValuations.model, valuation.model),
            eq(vehicleValuations.year, valuation.year),
            eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing record, preserving createdAt and createdBy
        const [updated] = await db
          .update(vehicleValuations)
          .set({
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            mileageLow: valuation.mileageLow,
            mileageHigh: valuation.mileageHigh,
            marketNotes: valuation.marketNotes,
            updatedAt: new Date(),
            // createdAt and createdBy are NOT updated (preserved)
          })
          .where(eq(vehicleValuations.id, existing[0].id))
          .returning();
        
        // Log audit entry for update
        await this.logAudit('update', 'valuation', updated.id, {
          lowPrice: { 
            old: existing[0].lowPrice, 
            new: valuation.lowPrice.toString() 
          },
          highPrice: { 
            old: existing[0].highPrice, 
            new: valuation.highPrice.toString() 
          },
          averagePrice: { 
            old: existing[0].averagePrice, 
            new: valuation.averagePrice.toString() 
          },
          dataSource: {
            old: existing[0].dataSource,
            new: valuation.dataSource
          }
        });
        
        return { action: 'updated', recordId: updated.id };
      } else {
        // Insert new record with System User as createdBy
        const [inserted] = await db
          .insert(vehicleValuations)
          .values({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            mileageLow: valuation.mileageLow,
            mileageHigh: valuation.mileageHigh,
            marketNotes: valuation.marketNotes,
            createdBy: SYSTEM_USER_ID,
          })
          .returning();
        
        // Log audit entry for insert
        await this.logAudit('create', 'valuation', inserted.id, {});
        
        return { action: 'inserted', recordId: inserted.id };
      }
    } catch (error) {
      return {
        action: 'skipped',
        recordId: '',
        error: error as Error,
      };
    }
  }

  /**
   * Upsert a damage deduction record
   * 
   * Checks for existing record using unique constraint (make, component, damageLevel).
   * If exists, updates the record while preserving createdAt and createdBy.
   * If not exists, inserts new record with System User as createdBy.
   * 
   * @param deduction - The deduction record to upsert
   * @returns UpsertResult with action taken and record ID
   */
  async upsertDeduction(deduction: DeductionRecord): Promise<UpsertResult> {
    try {
      // Check if record exists using unique constraint
      const existing = await db
        .select()
        .from(damageDeductions)
        .where(
          and(
            eq(damageDeductions.make, deduction.make),
            eq(damageDeductions.component, deduction.component),
            eq(damageDeductions.damageLevel, deduction.damageLevel)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing record, preserving createdAt and createdBy
        const [updated] = await db
          .update(damageDeductions)
          .set({
            repairCostLow: deduction.repairCostLow.toString(),
            repairCostHigh: deduction.repairCostHigh.toString(),
            valuationDeductionLow: deduction.valuationDeductionLow.toString(),
            valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
            notes: deduction.notes,
            updatedAt: new Date(),
            // createdAt and createdBy are NOT updated (preserved)
          })
          .where(eq(damageDeductions.id, existing[0].id))
          .returning();
        
        // Log audit entry for update
        await this.logAudit('update', 'deduction', updated.id, {
          repairCostLow: { 
            old: existing[0].repairCostLow, 
            new: deduction.repairCostLow.toString() 
          },
          repairCostHigh: { 
            old: existing[0].repairCostHigh, 
            new: deduction.repairCostHigh.toString() 
          },
          valuationDeductionLow: {
            old: existing[0].valuationDeductionLow,
            new: deduction.valuationDeductionLow.toString()
          },
          valuationDeductionHigh: {
            old: existing[0].valuationDeductionHigh,
            new: deduction.valuationDeductionHigh.toString()
          }
        });
        
        return { action: 'updated', recordId: updated.id };
      } else {
        // Insert new record with System User as createdBy
        const [inserted] = await db
          .insert(damageDeductions)
          .values({
            make: deduction.make,
            component: deduction.component,
            damageLevel: deduction.damageLevel,
            repairCostLow: deduction.repairCostLow.toString(),
            repairCostHigh: deduction.repairCostHigh.toString(),
            valuationDeductionLow: deduction.valuationDeductionLow.toString(),
            valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
            notes: deduction.notes,
            createdBy: SYSTEM_USER_ID,
          })
          .returning();
        
        // Log audit entry for insert
        await this.logAudit('create', 'deduction', inserted.id, {});
        
        return { action: 'inserted', recordId: inserted.id };
      }
    } catch (error) {
      return {
        action: 'skipped',
        recordId: '',
        error: error as Error,
      };
    }
  }

  /**
   * Log an audit entry for data modifications
   * 
   * Records all create, update, and delete operations to the valuation_audit_logs table.
   * Uses System User ID for all seed operations.
   * 
   * @param action - The type of action performed
   * @param entityType - The type of entity modified
   * @param entityId - The ID of the entity modified
   * @param changedFields - Object containing old and new values for changed fields
   */
  private async logAudit(
    action: 'create' | 'update' | 'delete',
    entityType: 'valuation' | 'deduction',
    entityId: string,
    changedFields: Record<string, { old: any; new: any }>
  ): Promise<void> {
    try {
      await db.insert(valuationAuditLogs).values({
        action,
        entityType,
        entityId,
        changedFields,
        userId: SYSTEM_USER_ID,
      });
    } catch (error) {
      // Log error but don't fail the upsert operation
      console.error('Failed to create audit log:', error);
    }
  }
}

/**
 * Singleton instance of IdempotentUpsertService
 * Export for use in seed scripts
 */
export const idempotentUpsert = new IdempotentUpsertService();
