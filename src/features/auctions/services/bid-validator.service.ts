/**
 * Validates bid eligibility before placement.
 */

import { depositCalculatorService } from './deposit-calculator.service';

export interface ValidateBidParams {
  vendorId: string;
  auctionId: string;
  bidAmount: number;
  currentHighestBid: number | null;
  vendorTier: 'tier1_bvn' | 'tier2_full';
  availableBalance: number;
  depositRate: number;
  minimumDepositFloor: number;
  tier1Limit: number;
}

export interface BidValidationResult {
  valid: boolean;
  errors: string[];
  depositAmount?: number;
}

export class BidValidatorService {
  async validateBid(params: ValidateBidParams): Promise<BidValidationResult> {
    const errors: string[] = [];
    const depositAmount = depositCalculatorService.calculateDeposit(
      params.bidAmount,
      params.depositRate,
      params.minimumDepositFloor
    );

    if (params.availableBalance < depositAmount) {
      errors.push('Insufficient available balance for deposit');
    }

    if (params.currentHighestBid !== null) {
      if (params.bidAmount <= params.currentHighestBid) {
        errors.push('A new bid must be higher than the current bid');
      }
    } else if (params.bidAmount <= 0) {
      errors.push('The opening bid must be greater than zero');
    }

    if (params.vendorTier === 'tier1_bvn' && params.bidAmount > params.tier1Limit) {
      errors.push(`Tier 1 vendors cannot bid above NGN ${params.tier1Limit.toLocaleString()}`);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, errors: [], depositAmount };
  }
}

export const bidValidatorService = new BidValidatorService();
