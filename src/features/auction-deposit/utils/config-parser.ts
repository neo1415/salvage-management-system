/**
 * Configuration Parser
 * Parses configuration files into SystemConfiguration objects
 * 
 * Requirements:
 * - Requirement 25.1: Parse configuration files
 * - Requirement 25.2: Return descriptive errors with line numbers
 * - Requirement 25.6: Validate all values against business rule constraints
 */

import { SystemConfiguration } from '../services/config.service';

export interface ParseError {
  line: number;
  issue: string;
}

export interface ParseResult {
  success: boolean;
  config?: SystemConfiguration;
  errors?: ParseError[];
}

/**
 * Configuration Parser
 * Parses configuration files with comprehensive error handling
 */
export class ConfigParser {
  /**
   * Parse configuration file content
   * 
   * @param content - Configuration file content
   * @returns Parse result with config or errors
   */
  parse(content: string): ParseResult {
    const errors: ParseError[] = [];
    const config: Partial<SystemConfiguration> = {};

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      // Parse key-value pair
      const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (!match) {
        errors.push({
          line: lineNumber,
          issue: `Invalid syntax. Expected format: key = value`,
        });
        continue;
      }

      const [, key, valueStr] = match;
      const value = valueStr.trim();

      // Parse value based on key
      try {
        this.parseParameter(key, value, config, lineNumber, errors);
      } catch (error) {
        errors.push({
          line: lineNumber,
          issue: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Validate required parameters
    const requiredParams: (keyof SystemConfiguration)[] = [
      'depositRate',
      'minimumDepositFloor',
      'tier1Limit',
      'minimumBidIncrement',
      'documentValidityPeriod',
      'maxGraceExtensions',
      'graceExtensionDuration',
      'fallbackBufferPeriod',
      'topBiddersToKeepFrozen',
      'forfeiturePercentage',
      'paymentDeadlineAfterSigning',
    ];

    for (const param of requiredParams) {
      if (!(param in config)) {
        errors.push({
          line: 0,
          issue: `Missing required parameter: ${this.camelToSnake(param)}`,
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      config: config as SystemConfiguration,
    };
  }

  /**
   * Parse individual parameter
   * 
   * @param key - Parameter key
   * @param value - Parameter value
   * @param config - Configuration object to populate
   * @param lineNumber - Line number for error reporting
   * @param errors - Error array to populate
   */
  private parseParameter(
    key: string,
    value: string,
    config: Partial<SystemConfiguration>,
    lineNumber: number,
    errors: ParseError[]
  ): void {
    const camelKey = this.snakeToCamel(key);

    // Parse numeric value
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push({
        line: lineNumber,
        issue: `Invalid numeric value for ${key}: ${value}`,
      });
      return;
    }

    // Validate and assign based on parameter
    switch (camelKey) {
      case 'depositRate':
        if (numValue < 1 || numValue > 100) {
          errors.push({
            line: lineNumber,
            issue: 'Deposit rate must be between 1% and 100%',
          });
          return;
        }
        config.depositRate = numValue;
        break;

      case 'minimumDepositFloor':
        if (numValue < 1000) {
          errors.push({
            line: lineNumber,
            issue: 'Minimum deposit floor must be at least ₦1,000',
          });
          return;
        }
        config.minimumDepositFloor = numValue;
        break;

      case 'tier1Limit':
        if (numValue < 0) {
          errors.push({
            line: lineNumber,
            issue: 'Tier 1 limit must be non-negative',
          });
          return;
        }
        config.tier1Limit = numValue;
        break;

      case 'minimumBidIncrement':
        if (numValue < 0) {
          errors.push({
            line: lineNumber,
            issue: 'Minimum bid increment must be non-negative',
          });
          return;
        }
        config.minimumBidIncrement = numValue;
        break;

      case 'documentValidityPeriod':
        if (numValue < 1) {
          errors.push({
            line: lineNumber,
            issue: 'Document validity period must be at least 1 hour',
          });
          return;
        }
        config.documentValidityPeriod = numValue;
        break;

      case 'maxGraceExtensions':
        if (numValue < 0 || !Number.isInteger(numValue)) {
          errors.push({
            line: lineNumber,
            issue: 'Max grace extensions must be a non-negative integer',
          });
          return;
        }
        config.maxGraceExtensions = numValue;
        break;

      case 'graceExtensionDuration':
        if (numValue < 1) {
          errors.push({
            line: lineNumber,
            issue: 'Grace extension duration must be at least 1 hour',
          });
          return;
        }
        config.graceExtensionDuration = numValue;
        break;

      case 'fallbackBufferPeriod':
        if (numValue < 0) {
          errors.push({
            line: lineNumber,
            issue: 'Fallback buffer period must be non-negative',
          });
          return;
        }
        config.fallbackBufferPeriod = numValue;
        break;

      case 'topBiddersToKeepFrozen':
        if (numValue < 1 || !Number.isInteger(numValue)) {
          errors.push({
            line: lineNumber,
            issue: 'Top bidders to keep frozen must be a positive integer',
          });
          return;
        }
        config.topBiddersToKeepFrozen = numValue;
        break;

      case 'forfeiturePercentage':
        if (numValue < 0 || numValue > 100) {
          errors.push({
            line: lineNumber,
            issue: 'Forfeiture percentage must be between 0% and 100%',
          });
          return;
        }
        config.forfeiturePercentage = numValue;
        break;

      case 'paymentDeadlineAfterSigning':
        if (numValue < 1) {
          errors.push({
            line: lineNumber,
            issue: 'Payment deadline after signing must be at least 1 hour',
          });
          return;
        }
        config.paymentDeadlineAfterSigning = numValue;
        break;

      default:
        errors.push({
          line: lineNumber,
          issue: `Unknown parameter: ${key}`,
        });
    }
  }

  /**
   * Convert snake_case to camelCase
   * 
   * @param str - Snake case string
   * @returns Camel case string
   */
  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   * 
   * @param str - Camel case string
   * @returns Snake case string
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// Export singleton instance
export const configParser = new ConfigParser();
