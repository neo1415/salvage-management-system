/**
 * Deposit Calculator Service Unit Tests
 * Tests deposit calculation logic
 */

import { describe, it, expect } from 'vitest';
import { depositCalculatorService } from '@/features/auctions/services/deposit-calculator.service';

describe('DepositCalculatorService', () => {
  describe('calculateDeposit', () => {
    it('should calculate deposit as bid × rate when above floor', () => {
      // 10% of ₦1,000,000 = ₦100,000 (above ₦100,000 floor)
      const result = depositCalculatorService.calculateDeposit(
        1000000, // bid amount
        0.10,    // 10% rate
        100000   // floor
      );
      expect(result).toBe(100000);
    });

    it('should use minimum floor when calculated deposit is below floor', () => {
      // 10% of ₦500,000 = ₦50,000 (below ₦100,000 floor)
      const result = depositCalculatorService.calculateDeposit(
        500000,  // bid amount
        0.10,    // 10% rate
        100000   // floor
      );
      expect(result).toBe(100000); // Should use floor
    });

    it('should return non-negative integer', () => {
      const result = depositCalculatorService.calculateDeposit(
        1500000,
        0.10,
        100000
      );
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should handle Tier 1 vendor at limit (₦500,000 bid)', () => {
      // 10% of ₦500,000 = ₦50,000
      const result = depositCalculatorService.calculateDeposit(
        500000,
        0.10,
        100000
      );
      // Should use floor since ₦50,000 < ₦100,000
      expect(result).toBe(100000);
    });

    it('should ceil fractional deposits', () => {
      // 10% of ₦1,234,567 = ₦123,456.7 → ceil to ₦123,457
      const result = depositCalculatorService.calculateDeposit(
        1234567,
        0.10,
        100000
      );
      expect(result).toBe(123457);
    });

    it('should handle zero bid amount', () => {
      const result = depositCalculatorService.calculateDeposit(
        0,
        0.10,
        100000
      );
      expect(result).toBe(100000); // Should use floor
    });

    it('should handle different deposit rates', () => {
      // 5% of ₦2,000,000 = ₦100,000
      const result = depositCalculatorService.calculateDeposit(
        2000000,
        0.05,
        100000
      );
      expect(result).toBe(100000);
    });
  });

  describe('calculateIncrementalDeposit', () => {
    it('should calculate incremental deposit for bid increase', () => {
      // Previous: 10% of ₦1,000,000 = ₦100,000
      // New: 10% of ₦1,500,000 = ₦150,000
      // Incremental: ₦50,000
      const result = depositCalculatorService.calculateIncrementalDeposit(
        1500000, // new bid
        1000000, // previous bid
        0.10,
        100000
      );
      expect(result).toBe(50000);
    });

    it('should return zero when new bid equals previous bid', () => {
      const result = depositCalculatorService.calculateIncrementalDeposit(
        1000000,
        1000000,
        0.10,
        100000
      );
      expect(result).toBe(0);
    });

    it('should handle floor constraint in incremental calculation', () => {
      // Previous: ₦400,000 × 10% = ₦40,000 → floor ₦100,000
      // New: ₦600,000 × 10% = ₦60,000 → floor ₦100,000
      // Incremental: ₦0 (both use floor)
      const result = depositCalculatorService.calculateIncrementalDeposit(
        600000,
        400000,
        0.10,
        100000
      );
      expect(result).toBe(0);
    });

    it('should handle transition from floor to calculated deposit', () => {
      // Previous: ₦500,000 × 10% = ₦50,000 → floor ₦100,000
      // New: ₦1,500,000 × 10% = ₦150,000
      // Incremental: ₦50,000
      const result = depositCalculatorService.calculateIncrementalDeposit(
        1500000,
        500000,
        0.10,
        100000
      );
      expect(result).toBe(50000);
    });

    it('should return non-negative value', () => {
      const result = depositCalculatorService.calculateIncrementalDeposit(
        2000000,
        1000000,
        0.10,
        100000
      );
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle small bid increases', () => {
      // Previous: ₦1,000,000 × 10% = ₦100,000
      // New: ₦1,020,000 × 10% = ₦102,000
      // Incremental: ₦2,000
      const result = depositCalculatorService.calculateIncrementalDeposit(
        1020000,
        1000000,
        0.10,
        100000
      );
      expect(result).toBe(2000);
    });
  });
});
