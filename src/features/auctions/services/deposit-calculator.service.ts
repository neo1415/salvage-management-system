/**
 * Deposit Calculator Service
 * Calculates deposit amounts for auction bids
 * 
 * Requirements:
 * - Requirement 1.1: Calculate deposit as max(bid × rate, floor)
 * - Requirement 1.4: Tier 1 vendor cap (₦50,000 max for ₦500,000 bid)
 * - Requirement 1.5: Incremental deposit calculation
 * - Requirement 1.6: Non-negative integer values in Naira
 */

/**
 * Deposit Calculator Service
 * Handles deposit amount calculations for auction bids
 */
export class DepositCalculatorService {
  /**
   * Calculate deposit amount for a bid
   * Formula: max(bid_amount × deposit_rate, minimum_deposit_floor)
   * 
   * @param bidAmount - Bid amount in Naira
   * @param depositRate - Deposit rate as decimal (e.g., 0.10 for 10%)
   * @param minimumDepositFloor - Minimum deposit floor in Naira
   * @returns Deposit amount in Naira (non-negative integer)
   */
  calculateDeposit(
    bidAmount: number,
    depositRate: number,
    minimumDepositFloor: number
  ): number {
    // Calculate deposit using formula
    const calculatedDeposit = Math.ceil(bidAmount * depositRate);
    
    // Return max of calculated deposit and minimum floor
    const deposit = Math.max(calculatedDeposit, minimumDepositFloor);
    
    // Ensure non-negative integer
    return Math.max(0, Math.floor(deposit));
  }

  /**
   * Calculate incremental deposit when vendor increases bid
   * Formula: new_deposit - previous_deposit
   * 
   * @param newBidAmount - New bid amount in Naira
   * @param previousBidAmount - Previous bid amount in Naira
   * @param depositRate - Deposit rate as decimal (e.g., 0.10 for 10%)
   * @param minimumDepositFloor - Minimum deposit floor in Naira
   * @returns Incremental deposit amount in Naira (non-negative integer)
   */
  calculateIncrementalDeposit(
    newBidAmount: number,
    previousBidAmount: number,
    depositRate: number,
    minimumDepositFloor: number
  ): number {
    // Calculate new deposit
    const newDeposit = this.calculateDeposit(
      newBidAmount,
      depositRate,
      minimumDepositFloor
    );
    
    // Calculate previous deposit
    const previousDeposit = this.calculateDeposit(
      previousBidAmount,
      depositRate,
      minimumDepositFloor
    );
    
    // Return incremental amount (difference)
    const incremental = newDeposit - previousDeposit;
    
    // Ensure non-negative
    return Math.max(0, incremental);
  }
}

// Export singleton instance
export const depositCalculatorService = new DepositCalculatorService();
