/**
 * Bid Validator Service
 * Validates bid eligibility before placement
 * 
 * Requirements:
 * - Requirement 2.1: Verify availableBalance >= required deposit
 * - Requirement 2.2: Insufficient balance error message
 * - Requirement 2.3: Below reserve price error message
 * - Requirement 2.4: Bid increment error message
 * - Requirement 2.5: Tier 1 limit error message
 * - Requirement 2.6: Success status with calculated deposit
 */

import { depositCalculatorService } from './deposit-calculator.service';

/**
 * Bid validation parameters
 */
export interface ValidateBidParams {
  vendorId: string;
  auctionId: string;
  bidAmount: number;
  reservePrice: number;
  currentHighestBid: number | null;
  vendorTier: 'tier1_bvn' | 'tier2_full';
  availableBalance: number;
  depositRate: number;
  minimumDepositFloor: number;
  minimumBidIncrement: number;
  tier1Limit: number;
}

/**
 * Bid validation result
 */
export interface BidValidationResult {
  valid: boolean;
  errors: string[];
  depositAmount?: number;
}

/**
 * Bid Validator Service
 * Validates bid eligibility before placement
 */
export class BidValidatorService {
  /**
   * Validate bid eligibility before placement
   * 
   * @param params - Bid validation parameters
   * @returns Validation result with errors or deposit amount
   */
  async validateBid(params: ValidateBidParams): Promise<BidValidationResult> {
    const errors: string[] = [];

    // Calculate required deposit
    const depositAmount = depositCalculatorService.calculateDeposit(
      params.bidAmount,
      params.depositRate,
      params.minimumDepositFloor
    );

    // Requirement 2.1: Verify availableBalance >= required deposit
    if (params.availableBalance < depositAmount) {
      // Requirement 2.2: Insufficient balance error message
      errors.push('Insufficient available balance for deposit');
    }

    // Requirement 2.3: Bid must be at least reserve price
    if (params.bidAmount < params.reservePrice) {
      errors.push(`Bid must be at least ₦${params.reservePrice.toLocaleString()}`);
    }

    // Requirement 2.4: Minimum bid increment validation
    if (params.currentHighestBid !== null) {
      const minimumRequiredBid = params.currentHighestBid + params.minimumBidIncrement;
      if (params.bidAmount < minimumRequiredBid) {
        errors.push(`Minimum bid increment is ₦${params.minimumBidIncrement.toLocaleString()}`);
      }
    }

    // Requirement 2.5: Tier 1 vendor limit validation
    if (params.vendorTier === 'tier1_bvn' && params.bidAmount > params.tier1Limit) {
      errors.push(`Tier 1 vendors cannot bid above ₦${params.tier1Limit.toLocaleString()}`);
    }

    // Requirement 2.6: Return success status with calculated deposit
    if (errors.length === 0) {
      return {
        valid: true,
        errors: [],
        depositAmount,
      };
    }

    return {
      valid: false,
      errors,
    };
  }
}

// Export singleton instance
export const bidValidatorService = new BidValidatorService();
