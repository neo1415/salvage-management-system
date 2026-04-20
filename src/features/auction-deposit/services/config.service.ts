/**
 * Configuration Service
 * Manages system configuration for auction deposit bidding system
 * 
 * Requirements:
 * - Requirement 18: System Admin Configuration Interface
 * - Requirement 19: Configuration Change Validation and Persistence
 * - Requirement 20: Configuration Change Audit Trail
 */

import { db } from '@/lib/db/drizzle';
import { systemConfig, configChangeHistory } from '@/lib/db/schema/auction-deposit';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export interface SystemConfiguration {
  registrationFee: number; // Naira
  depositRate: number; // Percentage (1-100)
  minimumDepositFloor: number; // Naira
  tier1Limit: number; // Naira
  minimumBidIncrement: number; // Naira
  documentValidityPeriod: number; // Hours
  maxGraceExtensions: number; // Count
  graceExtensionDuration: number; // Hours
  fallbackBufferPeriod: number; // Hours
  topBiddersToKeepFrozen: number; // Count
  forfeiturePercentage: number; // Percentage (0-100)
  paymentDeadlineAfterSigning: number; // Hours
}

export interface ConfigParameter {
  parameter: string;
  value: string;
  dataType: 'number' | 'boolean' | 'string';
  description?: string;
  minValue?: number;
  maxValue?: number;
}

export interface ConfigChangeRecord {
  id: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  reason?: string;
  createdAt: Date;
}

export interface GetConfigHistoryParams {
  parameter?: string;
  startDate?: Date;
  endDate?: Date;
  changedBy?: string;
  limit?: number;
}

/**
 * Configuration Service
 * Handles system configuration management
 */
export class ConfigService {
  // Default configuration values
  private readonly DEFAULT_CONFIG: SystemConfiguration = {
    registrationFee: 12500, // ₦12,500
    depositRate: 10, // 10%
    minimumDepositFloor: 100000, // ₦100,000
    tier1Limit: 500000, // ₦500,000
    minimumBidIncrement: 20000, // ₦20,000
    documentValidityPeriod: 48, // 48 hours
    maxGraceExtensions: 2, // 2 extensions
    graceExtensionDuration: 24, // 24 hours
    fallbackBufferPeriod: 24, // 24 hours
    topBiddersToKeepFrozen: 3, // Top 3 bidders
    forfeiturePercentage: 100, // 100%
    paymentDeadlineAfterSigning: 72, // 72 hours
  };

  /**
   * Get current system configuration
   * Returns default values if not configured
   * 
   * @returns Current system configuration
   */
  async getConfig(): Promise<SystemConfiguration> {
    const configRecords = await db
      .select()
      .from(systemConfig);

    // Start with defaults
    const config: SystemConfiguration = { ...this.DEFAULT_CONFIG };

    // Override with database values
    for (const record of configRecords) {
      const key = this.parameterToKey(record.parameter);
      if (key && key in config) {
        config[key as keyof SystemConfiguration] = this.parseValue(
          record.value,
          record.dataType
        );
      }
    }

    return config;
  }

  /**
   * Check if deposit system is enabled
   * Requirement 22.1: Feature flag for deposit system
   * 
   * @returns True if deposit system is enabled, false otherwise
   */
  async isDepositSystemEnabled(): Promise<boolean> {
    try {
      const [featureFlag] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.parameter, 'deposit_system_enabled'))
        .limit(1);

      // Default to true if not configured
      return featureFlag ? featureFlag.value === 'true' : true;
    } catch (error) {
      console.error('Failed to check deposit system feature flag:', error);
      // Default to true on error (fail open)
      return true;
    }
  }

  /**
   * Update configuration parameter
   * Validates value and records change in audit trail
   * 
   * @param parameter - Parameter name
   * @param value - New value
   * @param changedBy - User ID making the change
   * @param reason - Optional reason for change
   * @throws Error if validation fails
   */
  async updateConfig(
    parameter: string,
    value: string | number,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    // Validate parameter exists
    const key = this.parameterToKey(parameter);
    if (!key || !(key in this.DEFAULT_CONFIG)) {
      throw new Error(`Invalid parameter: ${parameter}`);
    }

    // Convert value to string for storage
    const valueStr = String(value);

    // Validate value
    await this.validateConfigValue(parameter, valueStr);

    // Use database transaction
    await db.transaction(async (tx) => {
      // Get current value
      const [currentRecord] = await tx
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.parameter, parameter))
        .limit(1);

      const oldValue = currentRecord?.value || String(this.DEFAULT_CONFIG[key as keyof SystemConfiguration]);

      // Update or insert configuration
      if (currentRecord) {
        await tx
          .update(systemConfig)
          .set({
            value: valueStr,
            updatedAt: new Date(),
            updatedBy: changedBy,
          })
          .where(eq(systemConfig.parameter, parameter));
      } else {
        // Insert new configuration
        const dataType = typeof this.DEFAULT_CONFIG[key as keyof SystemConfiguration] === 'number' 
          ? 'number' 
          : typeof this.DEFAULT_CONFIG[key as keyof SystemConfiguration] === 'boolean'
          ? 'boolean'
          : 'string';

        await tx.insert(systemConfig).values({
          parameter,
          value: valueStr,
          dataType,
          description: this.getParameterDescription(parameter),
          updatedBy: changedBy,
        });
      }

      // Record change in audit trail
      await tx.insert(configChangeHistory).values({
        parameter,
        oldValue,
        newValue: valueStr,
        changedBy,
        reason,
      });
    });
  }

  /**
   * Get configuration change history
   * Supports filtering by parameter, date range, and user
   * 
   * @param params - Filter parameters
   * @returns Configuration change history
   */
  async getConfigHistory(
    params: GetConfigHistoryParams = {}
  ): Promise<ConfigChangeRecord[]> {
    const { parameter, startDate, endDate, changedBy, limit = 100 } = params;

    let query = db
      .select()
      .from(configChangeHistory)
      .orderBy(desc(configChangeHistory.createdAt))
      .limit(limit);

    // Apply filters
    const conditions = [];
    if (parameter) {
      conditions.push(eq(configChangeHistory.parameter, parameter));
    }
    if (startDate) {
      conditions.push(gte(configChangeHistory.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(configChangeHistory.createdAt, endDate));
    }
    if (changedBy) {
      conditions.push(eq(configChangeHistory.changedBy, changedBy));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const records = await query;

    return records.map((record) => ({
      id: record.id,
      parameter: record.parameter,
      oldValue: record.oldValue,
      newValue: record.newValue,
      changedBy: record.changedBy,
      reason: record.reason || undefined,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Validate configuration value against constraints
   * 
   * @param parameter - Parameter name
   * @param value - Value to validate
   * @throws Error if validation fails
   */
  private async validateConfigValue(parameter: string, value: string): Promise<void> {
    const numValue = parseFloat(value);

    switch (parameter) {
      case 'registration_fee':
        if (numValue < 1000 || numValue > 50000) {
          throw new Error('Registration fee must be between ₦1,000 and ₦50,000');
        }
        break;

      case 'deposit_rate':
        if (numValue < 1 || numValue > 100) {
          throw new Error('Deposit rate must be between 1% and 100%');
        }
        break;

      case 'minimum_deposit_floor':
        if (numValue < 1000) {
          throw new Error('Minimum deposit floor must be at least ₦1,000');
        }
        break;

      case 'tier_1_limit':
        if (numValue < 0) {
          throw new Error('Tier 1 limit must be non-negative');
        }
        break;

      case 'minimum_bid_increment':
        if (numValue < 0) {
          throw new Error('Minimum bid increment must be non-negative');
        }
        break;

      case 'document_validity_period':
        if (numValue < 1) {
          throw new Error('Document validity period must be at least 1 hour');
        }
        break;

      case 'max_grace_extensions':
        if (numValue < 0 || !Number.isInteger(numValue)) {
          throw new Error('Max grace extensions must be a non-negative integer');
        }
        break;

      case 'grace_extension_duration':
        if (numValue < 1) {
          throw new Error('Grace extension duration must be at least 1 hour');
        }
        break;

      case 'fallback_buffer_period':
        if (numValue < 0) {
          throw new Error('Fallback buffer period must be non-negative');
        }
        break;

      case 'top_bidders_to_keep_frozen':
        if (numValue < 1 || !Number.isInteger(numValue)) {
          throw new Error('Top bidders to keep frozen must be a positive integer');
        }
        break;

      case 'forfeiture_percentage':
        if (numValue < 0 || numValue > 100) {
          throw new Error('Forfeiture percentage must be between 0% and 100%');
        }
        break;

      case 'payment_deadline_after_signing':
        if (numValue < 1) {
          throw new Error('Payment deadline after signing must be at least 1 hour');
        }
        break;

      default:
        throw new Error(`Unknown parameter: ${parameter}`);
    }
  }

  /**
   * Convert parameter name to configuration key
   * 
   * @param parameter - Parameter name (snake_case)
   * @returns Configuration key (camelCase)
   */
  private parameterToKey(parameter: string): string | null {
    const mapping: Record<string, string> = {
      registration_fee: 'registrationFee',
      deposit_rate: 'depositRate',
      minimum_deposit_floor: 'minimumDepositFloor',
      tier_1_limit: 'tier1Limit',
      minimum_bid_increment: 'minimumBidIncrement',
      document_validity_period: 'documentValidityPeriod',
      max_grace_extensions: 'maxGraceExtensions',
      grace_extension_duration: 'graceExtensionDuration',
      fallback_buffer_period: 'fallbackBufferPeriod',
      top_bidders_to_keep_frozen: 'topBiddersToKeepFrozen',
      forfeiture_percentage: 'forfeiturePercentage',
      payment_deadline_after_signing: 'paymentDeadlineAfterSigning',
    };

    return mapping[parameter] || null;
  }

  /**
   * Parse configuration value based on data type
   * 
   * @param value - String value
   * @param dataType - Data type
   * @returns Parsed value
   */
  private parseValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      default:
        return value;
    }
  }

  /**
   * Get parameter description
   * 
   * @param parameter - Parameter name
   * @returns Description
   */
  private getParameterDescription(parameter: string): string {
    const descriptions: Record<string, string> = {
      registration_fee: 'One-time vendor registration fee in Naira (default ₦12,500)',
      deposit_rate: 'Percentage of bid amount to freeze as deposit (default 10%)',
      minimum_deposit_floor: 'Minimum deposit amount in Naira (default ₦100,000)',
      tier_1_limit: 'Maximum bid amount for Tier 1 vendors (default ₦500,000)',
      minimum_bid_increment: 'Minimum amount between consecutive bids (default ₦20,000)',
      document_validity_period: 'Time window for signing documents in hours (default 48)',
      max_grace_extensions: 'Maximum number of grace extensions allowed (default 2)',
      grace_extension_duration: 'Duration of each grace extension in hours (default 24)',
      fallback_buffer_period: 'Wait time before promoting next bidder in hours (default 24)',
      top_bidders_to_keep_frozen: 'Number of top bidders whose deposits remain frozen (default 3)',
      forfeiture_percentage: 'Percentage of deposit to forfeit on payment failure (default 100%)',
      payment_deadline_after_signing: 'Time to complete payment after signing documents in hours (default 72)',
    };

    return descriptions[parameter] || '';
  }
}

// Export singleton instance
export const configService = new ConfigService();
