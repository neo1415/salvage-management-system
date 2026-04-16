/**
 * Configuration Round-Trip Test
 * Verifies parse → print → parse produces equivalent object
 * 
 * Requirements:
 * - Requirement 25.4: Round-trip property
 */

import { describe, it, expect } from 'vitest';
import { configParser } from '@/features/auction-deposit/utils/config-parser';
import { configPrettyPrinter } from '@/features/auction-deposit/utils/config-pretty-printer';
import { SystemConfiguration } from '@/features/auction-deposit/services/config.service';

describe('Configuration Round-Trip', () => {
  it('should maintain equivalence through parse → print → parse cycle', () => {
    // Original configuration
    const originalConfig: SystemConfiguration = {
      depositRate: 10,
      minimumDepositFloor: 100000,
      tier1Limit: 500000,
      minimumBidIncrement: 20000,
      documentValidityPeriod: 48,
      maxGraceExtensions: 2,
      graceExtensionDuration: 24,
      fallbackBufferPeriod: 24,
      topBiddersToKeepFrozen: 3,
      forfeiturePercentage: 100,
      paymentDeadlineAfterSigning: 72,
    };

    // Step 1: Print original config
    const printed = configPrettyPrinter.format(originalConfig);

    // Step 2: Parse printed config
    const parseResult1 = configParser.parse(printed);
    expect(parseResult1.success).toBe(true);
    expect(parseResult1.config).toEqual(originalConfig);

    // Step 3: Print parsed config
    const reprinted = configPrettyPrinter.format(parseResult1.config!);

    // Step 4: Parse reprinted config
    const parseResult2 = configParser.parse(reprinted);
    expect(parseResult2.success).toBe(true);
    expect(parseResult2.config).toEqual(originalConfig);

    // Verify round-trip property
    expect(parseResult2.config).toEqual(parseResult1.config);
  });

  it('should handle custom configuration values', () => {
    const customConfig: SystemConfiguration = {
      depositRate: 15,
      minimumDepositFloor: 50000,
      tier1Limit: 1000000,
      minimumBidIncrement: 10000,
      documentValidityPeriod: 72,
      maxGraceExtensions: 3,
      graceExtensionDuration: 12,
      fallbackBufferPeriod: 48,
      topBiddersToKeepFrozen: 5,
      forfeiturePercentage: 50,
      paymentDeadlineAfterSigning: 96,
    };

    const printed = configPrettyPrinter.format(customConfig);
    const parseResult = configParser.parse(printed);

    expect(parseResult.success).toBe(true);
    expect(parseResult.config).toEqual(customConfig);
  });

  it('should handle compact format', () => {
    const config: SystemConfiguration = {
      depositRate: 10,
      minimumDepositFloor: 100000,
      tier1Limit: 500000,
      minimumBidIncrement: 20000,
      documentValidityPeriod: 48,
      maxGraceExtensions: 2,
      graceExtensionDuration: 24,
      fallbackBufferPeriod: 24,
      topBiddersToKeepFrozen: 3,
      forfeiturePercentage: 100,
      paymentDeadlineAfterSigning: 72,
    };

    const printed = configPrettyPrinter.formatCompact(config);
    const parseResult = configParser.parse(printed);

    expect(parseResult.success).toBe(true);
    expect(parseResult.config).toEqual(config);
  });

  it('should report errors with line numbers', () => {
    const invalidConfig = `
# Invalid configuration
deposit_rate = 150
minimum_deposit_floor = 500
tier_1_limit = -1000
`;

    const parseResult = configParser.parse(invalidConfig);

    expect(parseResult.success).toBe(false);
    expect(parseResult.errors).toBeDefined();
    expect(parseResult.errors!.length).toBeGreaterThan(0);
    
    // Check that errors have line numbers
    for (const error of parseResult.errors!) {
      expect(error.line).toBeGreaterThan(0);
      expect(error.issue).toBeTruthy();
    }
  });

  it('should report missing required parameters', () => {
    const incompleteConfig = `
deposit_rate = 10
minimum_deposit_floor = 100000
`;

    const parseResult = configParser.parse(incompleteConfig);

    expect(parseResult.success).toBe(false);
    expect(parseResult.errors).toBeDefined();
    expect(parseResult.errors!.some(e => e.issue.includes('Missing required parameter'))).toBe(true);
  });

  it('should validate parameter constraints', () => {
    const invalidConfig = `
deposit_rate = 0
minimum_deposit_floor = 100
tier_1_limit = 500000
minimum_bid_increment = 20000
document_validity_period = 0
max_grace_extensions = -1
grace_extension_duration = 24
fallback_buffer_period = 24
top_bidders_to_keep_frozen = 0
forfeiture_percentage = 150
payment_deadline_after_signing = 72
`;

    const parseResult = configParser.parse(invalidConfig);

    expect(parseResult.success).toBe(false);
    expect(parseResult.errors).toBeDefined();
    expect(parseResult.errors!.length).toBeGreaterThan(0);
  });
});
