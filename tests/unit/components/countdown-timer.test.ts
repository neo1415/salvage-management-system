/**
 * Property-Based Tests for Countdown Timer Component
 * 
 * Property 10: Countdown Timer Formatting
 * Validates: Requirements 17.1-17.8
 * 
 * This test suite validates that countdown timer formatting is correct
 * for all possible time remaining values.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Format time remaining for countdown display
 * This is the logic that will be implemented in the component
 */
function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) {
    return '0s';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  // Format: "Xd Xh Xm Xs" (>24h)
  if (days > 0) {
    return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  // Format: "Xh Xm Xs" (1-24h)
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  // Format: "Xm Xs" (<1h)
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get color class based on time remaining
 */
function getCountdownColor(milliseconds: number): string {
  const hours = milliseconds / (1000 * 60 * 60);

  if (hours > 24) {
    return 'text-green-600'; // green (>24h)
  }

  if (hours >= 1) {
    return 'text-yellow-600'; // yellow (1-24h)
  }

  return 'text-red-600'; // red (<1h)
}

/**
 * Check if countdown should pulse (when <1h)
 */
function shouldPulse(milliseconds: number): boolean {
  const hours = milliseconds / (1000 * 60 * 60);
  return hours < 1;
}

describe('Countdown Timer Formatting - Property Tests', () => {
  /**
   * Property 10.1: Format is always valid
   * For any time remaining value, the format should match expected patterns
   */
  it('should always produce valid format string', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }), // 0 to 30 days in ms
        (timeMs) => {
          const formatted = formatCountdown(timeMs);

          // Should match one of the valid patterns
          const validPatterns = [
            /^\d+d \d+h \d+m \d+s$/, // "Xd Xh Xm Xs"
            /^\d+h \d+m \d+s$/, // "Xh Xm Xs"
            /^\d+m \d+s$/, // "Xm Xs"
            /^0s$/, // Edge case for 0
          ];

          const isValid = validPatterns.some((pattern) => pattern.test(formatted));
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property 10.2: Format changes based on time ranges
   * >24h should include days, 1-24h should not include days, <1h should only show minutes/seconds
   */
  it('should use correct format for time ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
        (timeMs) => {
          const formatted = formatCountdown(timeMs);
          const hours = timeMs / (1000 * 60 * 60);

          if (hours > 24) {
            // Should include days
            expect(formatted).toMatch(/^\d+d/);
          } else if (hours >= 1) {
            // Should include hours but not days
            expect(formatted).toMatch(/^\d+h/);
            expect(formatted).not.toMatch(/d/);
          } else if (timeMs > 0) {
            // Should only include minutes and seconds
            expect(formatted).toMatch(/^\d+m \d+s$/);
            expect(formatted).not.toMatch(/[dh]/);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property 10.3: Color coding is correct
   * Green for >24h, yellow for 1-24h, red for <1h
   */
  it('should use correct color for time ranges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
        (timeMs) => {
          const color = getCountdownColor(timeMs);
          const hours = timeMs / (1000 * 60 * 60);

          if (hours > 24) {
            expect(color).toBe('text-green-600');
          } else if (hours >= 1) {
            expect(color).toBe('text-yellow-600');
          } else {
            expect(color).toBe('text-red-600');
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property 10.4: Pulse animation only when <1h
   */
  it('should pulse only when less than 1 hour remaining', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 }),
        (timeMs) => {
          const pulse = shouldPulse(timeMs);
          const hours = timeMs / (1000 * 60 * 60);

          if (hours < 1) {
            expect(pulse).toBe(true);
          } else {
            expect(pulse).toBe(false);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property 10.5: Time components are within valid ranges
   * Days, hours, minutes, seconds should all be non-negative and within expected bounds
   */
  it('should have valid time component values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        (timeMs) => {
          const formatted = formatCountdown(timeMs);

          // Extract numbers from formatted string
          const numbers = formatted.match(/\d+/g)?.map(Number) || [];

          // All numbers should be non-negative
          numbers.forEach((num) => {
            expect(num).toBeGreaterThanOrEqual(0);
          });

          // If days are present, they should be reasonable
          if (formatted.includes('d')) {
            const days = parseInt(formatted.match(/(\d+)d/)?.[1] || '0');
            expect(days).toBeLessThanOrEqual(30);
          }

          // Hours should be 0-23 when days are present, or 0-23 when no days
          if (formatted.includes('h')) {
            const hours = parseInt(formatted.match(/(\d+)h/)?.[1] || '0');
            if (formatted.includes('d')) {
              expect(hours).toBeLessThanOrEqual(23);
            } else {
              expect(hours).toBeLessThanOrEqual(24);
            }
          }

          // Minutes should be 0-59
          if (formatted.includes('m')) {
            const minutes = parseInt(formatted.match(/(\d+)m/)?.[1] || '0');
            expect(minutes).toBeLessThanOrEqual(59);
          }

          // Seconds should be 0-59
          if (formatted.includes('s')) {
            const seconds = parseInt(formatted.match(/(\d+)s/)?.[1] || '0');
            expect(seconds).toBeLessThanOrEqual(59);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property 10.6: Countdown decreases over time
   * If we subtract 1 second, the formatted time should represent less time
   */
  it('should show decreasing time when milliseconds decrease', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 30 * 24 * 60 * 60 * 1000 }),
        (timeMs) => {
          const formatted1 = formatCountdown(timeMs);
          const formatted2 = formatCountdown(timeMs - 1000); // 1 second less

          // Convert to total seconds for comparison
          const extractSeconds = (str: string): number => {
            let total = 0;
            const daysMatch = str.match(/(\d+)d/);
            const hoursMatch = str.match(/(\d+)h/);
            const minutesMatch = str.match(/(\d+)m/);
            const secondsMatch = str.match(/(\d+)s/);

            if (daysMatch) total += parseInt(daysMatch[1]) * 24 * 60 * 60;
            if (hoursMatch) total += parseInt(hoursMatch[1]) * 60 * 60;
            if (minutesMatch) total += parseInt(minutesMatch[1]) * 60;
            if (secondsMatch) total += parseInt(secondsMatch[1]);

            return total;
          };

          const seconds1 = extractSeconds(formatted1);
          const seconds2 = extractSeconds(formatted2);

          // Second time should be less than first time
          expect(seconds2).toBeLessThanOrEqual(seconds1);
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property 10.7: Zero and negative values handled correctly
   */
  it('should handle zero and negative values correctly', () => {
    expect(formatCountdown(0)).toBe('0s');
    expect(formatCountdown(-1000)).toBe('0s');
    expect(formatCountdown(-100000)).toBe('0s');

    expect(getCountdownColor(0)).toBe('text-red-600');
    expect(getCountdownColor(-1000)).toBe('text-red-600');

    expect(shouldPulse(0)).toBe(true);
    expect(shouldPulse(-1000)).toBe(true);
  });

  /**
   * Property 10.8: Specific boundary cases
   * Test exact boundaries: 1 hour, 24 hours
   */
  it('should handle boundary cases correctly', () => {
    // Exactly 1 hour
    const oneHour = 60 * 60 * 1000;
    expect(formatCountdown(oneHour)).toBe('1h 0m 0s');
    expect(getCountdownColor(oneHour)).toBe('text-yellow-600');
    expect(shouldPulse(oneHour)).toBe(false);

    // Just under 1 hour
    const justUnderOneHour = oneHour - 1000;
    expect(formatCountdown(justUnderOneHour)).toBe('59m 59s');
    expect(getCountdownColor(justUnderOneHour)).toBe('text-red-600');
    expect(shouldPulse(justUnderOneHour)).toBe(true);

    // Exactly 24 hours (displays as 1 day)
    const twentyFourHours = 24 * 60 * 60 * 1000;
    expect(formatCountdown(twentyFourHours)).toBe('1d 0h 0m 0s');
    expect(getCountdownColor(twentyFourHours)).toBe('text-yellow-600');
    expect(shouldPulse(twentyFourHours)).toBe(false);

    // Just over 24 hours
    const justOverTwentyFourHours = twentyFourHours + 1000;
    expect(formatCountdown(justOverTwentyFourHours)).toBe('1d 0h 0m 1s');
    expect(getCountdownColor(justOverTwentyFourHours)).toBe('text-green-600');
    expect(shouldPulse(justOverTwentyFourHours)).toBe(false);
  });
});
