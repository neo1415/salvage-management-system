/**
 * Configuration Pretty Printer
 * Formats SystemConfiguration objects into readable configuration files
 * 
 * Requirements:
 * - Requirement 25.3: Format SystemConfig objects into valid configuration files
 * - Requirement 25.4: Round-trip property (parse → print → parse = original)
 * - Requirement 25.5: Include comments explaining each parameter
 */

import { SystemConfiguration } from '../services/config.service';

/**
 * Configuration Pretty Printer
 * Formats configuration with comments and proper formatting
 */
export class ConfigPrettyPrinter {
  /**
   * Format configuration object into file content
   * 
   * @param config - System configuration object
   * @returns Formatted configuration file content
   */
  format(config: SystemConfiguration): string {
    const lines: string[] = [];

    // Header
    lines.push('# Auction Deposit Bidding System Configuration');
    lines.push('# All monetary values are in Nigerian Naira (₦)');
    lines.push('# All time periods are in hours');
    lines.push('# All percentages are numeric values (e.g., 10 for 10%)');
    lines.push('');

    // Deposit Calculation Parameters
    lines.push('# ============================================');
    lines.push('# DEPOSIT CALCULATION PARAMETERS');
    lines.push('# ============================================');
    lines.push('');

    lines.push('# Percentage of bid amount to freeze as deposit');
    lines.push('# Valid range: 1-100');
    lines.push('# Default: 10 (10%)');
    lines.push(`deposit_rate = ${config.depositRate}`);
    lines.push('');

    lines.push('# Minimum deposit amount in Naira');
    lines.push('# Valid range: >= 1000');
    lines.push('# Default: 100000 (₦100,000)');
    lines.push(`minimum_deposit_floor = ${config.minimumDepositFloor}`);
    lines.push('');

    // Bid Validation Parameters
    lines.push('# ============================================');
    lines.push('# BID VALIDATION PARAMETERS');
    lines.push('# ============================================');
    lines.push('');

    lines.push('# Maximum bid amount for Tier 1 vendors in Naira');
    lines.push('# Valid range: >= 0');
    lines.push('# Default: 500000 (₦500,000)');
    lines.push(`tier_1_limit = ${config.tier1Limit}`);
    lines.push('');

    lines.push('# Minimum amount between consecutive bids in Naira');
    lines.push('# Valid range: >= 0');
    lines.push('# Default: 20000 (₦20,000)');
    lines.push(`minimum_bid_increment = ${config.minimumBidIncrement}`);
    lines.push('');

    // Document Management Parameters
    lines.push('# ============================================');
    lines.push('# DOCUMENT MANAGEMENT PARAMETERS');
    lines.push('# ============================================');
    lines.push('');

    lines.push('# Time window for signing documents in hours');
    lines.push('# Valid range: >= 1');
    lines.push('# Default: 48 (48 hours)');
    lines.push(`document_validity_period = ${config.documentValidityPeriod}`);
    lines.push('');

    lines.push('# Maximum number of grace extensions allowed');
    lines.push('# Valid range: >= 0 (integer)');
    lines.push('# Default: 2');
    lines.push(`max_grace_extensions = ${config.maxGraceExtensions}`);
    lines.push('');

    lines.push('# Duration of each grace extension in hours');
    lines.push('# Valid range: >= 1');
    lines.push('# Default: 24 (24 hours)');
    lines.push(`grace_extension_duration = ${config.graceExtensionDuration}`);
    lines.push('');

    // Fallback Chain Parameters
    lines.push('# ============================================');
    lines.push('# FALLBACK CHAIN PARAMETERS');
    lines.push('# ============================================');
    lines.push('');

    lines.push('# Wait time before promoting next bidder in hours');
    lines.push('# Valid range: >= 0');
    lines.push('# Default: 24 (24 hours)');
    lines.push(`fallback_buffer_period = ${config.fallbackBufferPeriod}`);
    lines.push('');

    lines.push('# Number of top bidders whose deposits remain frozen after auction closes');
    lines.push('# Valid range: >= 1 (integer)');
    lines.push('# Default: 3');
    lines.push(`top_bidders_to_keep_frozen = ${config.topBiddersToKeepFrozen}`);
    lines.push('');

    // Payment and Forfeiture Parameters
    lines.push('# ============================================');
    lines.push('# PAYMENT AND FORFEITURE PARAMETERS');
    lines.push('# ============================================');
    lines.push('');

    lines.push('# Percentage of deposit to forfeit on payment failure');
    lines.push('# Valid range: 0-100');
    lines.push('# Default: 100 (100%)');
    lines.push(`forfeiture_percentage = ${config.forfeiturePercentage}`);
    lines.push('');

    lines.push('# Time to complete payment after signing documents in hours');
    lines.push('# Valid range: >= 1');
    lines.push('# Default: 72 (72 hours)');
    lines.push(`payment_deadline_after_signing = ${config.paymentDeadlineAfterSigning}`);
    lines.push('');

    // Footer
    lines.push('# ============================================');
    lines.push('# END OF CONFIGURATION');
    lines.push('# ============================================');

    return lines.join('\n');
  }

  /**
   * Format configuration with minimal comments (compact version)
   * 
   * @param config - System configuration object
   * @returns Compact formatted configuration file content
   */
  formatCompact(config: SystemConfiguration): string {
    const lines: string[] = [];

    lines.push('# Auction Deposit Bidding System Configuration');
    lines.push('');
    lines.push('# Deposit Calculation');
    lines.push(`deposit_rate = ${config.depositRate}`);
    lines.push(`minimum_deposit_floor = ${config.minimumDepositFloor}`);
    lines.push('');
    lines.push('# Bid Validation');
    lines.push(`tier_1_limit = ${config.tier1Limit}`);
    lines.push(`minimum_bid_increment = ${config.minimumBidIncrement}`);
    lines.push('');
    lines.push('# Document Management');
    lines.push(`document_validity_period = ${config.documentValidityPeriod}`);
    lines.push(`max_grace_extensions = ${config.maxGraceExtensions}`);
    lines.push(`grace_extension_duration = ${config.graceExtensionDuration}`);
    lines.push('');
    lines.push('# Fallback Chain');
    lines.push(`fallback_buffer_period = ${config.fallbackBufferPeriod}`);
    lines.push(`top_bidders_to_keep_frozen = ${config.topBiddersToKeepFrozen}`);
    lines.push('');
    lines.push('# Payment and Forfeiture');
    lines.push(`forfeiture_percentage = ${config.forfeiturePercentage}`);
    lines.push(`payment_deadline_after_signing = ${config.paymentDeadlineAfterSigning}`);

    return lines.join('\n');
  }
}

// Export singleton instance
export const configPrettyPrinter = new ConfigPrettyPrinter();
