/**
 * Unit tests for Gemini Rate Limiter
 * 
 * Tests rate limiting enforcement for Gemini API:
 * - 10 requests per minute (sliding window)
 * - 1,500 requests per day (counter with UTC midnight reset)
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GeminiRateLimiter,
  getGeminiRateLimiter,
  resetGeminiRateLimiter,
  type RateLimitStatus,
} from '@/lib/integrations/gemini-rate-limiter';

describe('GeminiRateLimiter', () => {
  let rateLimiter: GeminiRateLimiter;

  beforeEach(() => {
    // Create a fresh instance for each test
    rateLimiter = new GeminiRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Minute-based rate limiting', () => {
    it('should allow exactly 10 requests per minute', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        const status = rateLimiter.checkQuota();
        expect(status.allowed).toBe(true);
        expect(status.minuteRemaining).toBe(10 - i);
        rateLimiter.recordRequest();
      }

      // 11th request should be blocked
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(false);
      expect(status.minuteRemaining).toBe(0);
    });

    it('should use sliding window for minute-based limiting', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest();
      }

      // 11th request should be blocked
      expect(rateLimiter.checkQuota().allowed).toBe(false);

      // Advance time by 30 seconds (half the window)
      vi.advanceTimersByTime(30000);

      // Still blocked (requests still in window)
      expect(rateLimiter.checkQuota().allowed).toBe(false);

      // Advance time by another 31 seconds (total 61 seconds)
      vi.advanceTimersByTime(31000);

      // Now allowed (old requests outside 60-second window)
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(10);
    });

    it('should correctly track minute usage', () => {
      expect(rateLimiter.getMinuteUsage()).toBe(0);

      rateLimiter.recordRequest();
      expect(rateLimiter.getMinuteUsage()).toBe(1);

      rateLimiter.recordRequest();
      rateLimiter.recordRequest();
      expect(rateLimiter.getMinuteUsage()).toBe(3);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000);

      // Old requests should be cleaned up
      expect(rateLimiter.getMinuteUsage()).toBe(0);
    });

    it('should handle boundary condition at exactly 10th request', () => {
      // Make 9 requests
      for (let i = 0; i < 9; i++) {
        rateLimiter.recordRequest();
      }

      // 10th request should be allowed
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(1);

      rateLimiter.recordRequest();

      // 11th request should be blocked
      const blockedStatus = rateLimiter.checkQuota();
      expect(blockedStatus.allowed).toBe(false);
      expect(blockedStatus.minuteRemaining).toBe(0);
    });

    it('should clean up old requests from sliding window', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.getMinuteUsage()).toBe(5);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Make 5 more requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.getMinuteUsage()).toBe(10);

      // Advance time by 31 seconds (first 5 requests now outside window)
      vi.advanceTimersByTime(31000);

      expect(rateLimiter.getMinuteUsage()).toBe(5);
    });
  });

  describe('Daily rate limiting', () => {
    it('should allow exactly 1,500 requests per day', () => {
      // Directly set daily count to test the limit without time advancement issues
      // Make 1,499 requests instantly (no time advancement to avoid midnight crossing)
      for (let i = 0; i < 1499; i++) {
        rateLimiter.recordRequest();
      }
      
      // Clear minute window to avoid minute limit interference
      vi.advanceTimersByTime(61000);

      // 1,500th request should be allowed
      let status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.dailyRemaining).toBe(1);
      rateLimiter.recordRequest();

      // 1,501st request should be blocked
      status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(false);
      expect(status.dailyRemaining).toBe(0);
    });

    it('should correctly track daily usage', () => {
      expect(rateLimiter.getDailyUsage()).toBe(0);

      rateLimiter.recordRequest();
      expect(rateLimiter.getDailyUsage()).toBe(1);

      for (let i = 0; i < 99; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(rateLimiter.getDailyUsage()).toBe(100);
    });

    it('should handle boundary condition at exactly 1,500th request', () => {
      // Make 1,499 requests instantly
      for (let i = 0; i < 1499; i++) {
        rateLimiter.recordRequest();
      }
      
      // Clear minute window
      vi.advanceTimersByTime(61000);

      // 1,500th request should be allowed
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.dailyRemaining).toBe(1);

      rateLimiter.recordRequest();

      // 1,501st request should be blocked
      const blockedStatus = rateLimiter.checkQuota();
      expect(blockedStatus.allowed).toBe(false);
      expect(blockedStatus.dailyRemaining).toBe(0);
    });

    it('should reset daily counter at midnight UTC', () => {
      // Make some requests
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(rateLimiter.getDailyUsage()).toBe(100);

      // Get the next midnight UTC
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      // Advance time to just before midnight
      vi.advanceTimersByTime(msUntilMidnight - 1000);
      expect(rateLimiter.getDailyUsage()).toBe(100);

      // Advance time past midnight
      vi.advanceTimersByTime(2000);

      // Daily counter should be reset
      expect(rateLimiter.getDailyUsage()).toBe(0);

      // Should be able to make requests again
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.dailyRemaining).toBe(1500);
    });

    it('should log info message when daily counter resets', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      // Make some requests
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      // Advance to next midnight
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      vi.advanceTimersByTime(msUntilMidnight + 1000);

      // Check quota to trigger reset check
      rateLimiter.checkQuota();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Gemini Rate Limiter] Daily quota reset')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Previous usage: 50/1500 requests')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Quota warnings', () => {
    it('should log warning at 80% of daily quota (1,200 requests)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make 1,199 requests (no warning yet)
      for (let i = 0; i < 1199; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(consoleSpy).not.toHaveBeenCalled();

      // 1,200th request should trigger warning
      rateLimiter.recordRequest();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Gemini Rate Limiter] 80% of daily quota used (1200/1500 requests)'
      );

      consoleSpy.mockRestore();
    });

    it('should log warning at 90% of daily quota (1,350 requests)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make 1,349 requests
      for (let i = 0; i < 1349; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      // Clear the 80% warning
      consoleSpy.mockClear();

      // 1,350th request should trigger warning
      rateLimiter.recordRequest();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Gemini Rate Limiter] 90% of daily quota used (1350/1500 requests)'
      );

      consoleSpy.mockRestore();
    });

    it('should log error when daily quota is exhausted', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Make 1,500 requests
      for (let i = 0; i < 1500; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Gemini Rate Limiter] Daily quota exhausted (1500/1500 requests). Falling back to Vision API.'
      );

      consoleSpy.mockRestore();
    });

    it('should only log each warning once', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Make 1,200 requests (80% warning)
      for (let i = 0; i < 1200; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockClear();

      // Make more requests (should not trigger 80% warning again)
      for (let i = 0; i < 100; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      // Should not have been called again for 80% warning
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('80%')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('checkQuota()', () => {
    it('should return correct status when quota is available', () => {
      const status = rateLimiter.checkQuota();

      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(10);
      expect(status.dailyRemaining).toBe(1500);
      expect(status.resetAt).toBeInstanceOf(Date);
    });

    it('should return correct status when minute limit is reached', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest();
      }

      const status = rateLimiter.checkQuota();

      expect(status.allowed).toBe(false);
      expect(status.minuteRemaining).toBe(0);
      expect(status.dailyRemaining).toBe(1490);
    });

    it('should return correct status when daily limit is reached', () => {
      // Make 1,500 requests instantly
      for (let i = 0; i < 1500; i++) {
        rateLimiter.recordRequest();
      }
      
      // Clear minute window
      vi.advanceTimersByTime(61000);

      const status = rateLimiter.checkQuota();

      expect(status.allowed).toBe(false);
      expect(status.minuteRemaining).toBe(10);
      expect(status.dailyRemaining).toBe(0);
    });

    it('should return correct resetAt timestamp', () => {
      const status = rateLimiter.checkQuota();

      // resetAt should be tomorrow at midnight UTC
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      expect(status.resetAt.getTime()).toBe(tomorrow.getTime());
    });
  });

  describe('recordRequest()', () => {
    it('should increment both minute and daily counters', () => {
      expect(rateLimiter.getMinuteUsage()).toBe(0);
      expect(rateLimiter.getDailyUsage()).toBe(0);

      rateLimiter.recordRequest();

      expect(rateLimiter.getMinuteUsage()).toBe(1);
      expect(rateLimiter.getDailyUsage()).toBe(1);
    });

    it('should update lastRequestAt timestamp', () => {
      const beforeTime = Date.now();
      rateLimiter.recordRequest();
      const afterTime = Date.now();

      const status = rateLimiter.getStatus();
      expect(status.lastRequestAt).not.toBeNull();
      expect(status.lastRequestAt!.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(status.lastRequestAt!.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it('should check for daily reset before recording', () => {
      // Make some requests
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(rateLimiter.getDailyUsage()).toBe(50);

      // Advance to next midnight
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      vi.advanceTimersByTime(msUntilMidnight + 1000);

      // Record a request (should reset counter first)
      rateLimiter.recordRequest();

      expect(rateLimiter.getDailyUsage()).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should reset all counters and state', () => {
      // Make some requests
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      expect(rateLimiter.getMinuteUsage()).toBeGreaterThan(0);
      expect(rateLimiter.getDailyUsage()).toBe(50);

      // Reset
      rateLimiter.reset();

      expect(rateLimiter.getMinuteUsage()).toBe(0);
      expect(rateLimiter.getDailyUsage()).toBe(0);

      const status = rateLimiter.getStatus();
      expect(status.lastRequestAt).toBeNull();
    });

    it('should allow full quota after reset', () => {
      // Exhaust minute limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.checkQuota().allowed).toBe(false);

      // Reset
      rateLimiter.reset();

      // Should be able to make requests again
      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(10);
      expect(status.dailyRemaining).toBe(1500);
    });
  });

  describe('getStatus()', () => {
    it('should return complete status information', () => {
      rateLimiter.recordRequest();
      rateLimiter.recordRequest();

      const status = rateLimiter.getStatus();

      expect(status.minuteUsage).toBe(2);
      expect(status.minuteLimit).toBe(10);
      expect(status.dailyUsage).toBe(2);
      expect(status.dailyLimit).toBe(1500);
      expect(status.dailyResetAt).toBeInstanceOf(Date);
      expect(status.lastRequestAt).toBeInstanceOf(Date);
    });

    it('should return null for lastRequestAt when no requests made', () => {
      const status = rateLimiter.getStatus();

      expect(status.lastRequestAt).toBeNull();
    });

    it('should clean up old minute requests before returning status', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.getStatus().minuteUsage).toBe(5);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000);

      // Old requests should be cleaned up
      expect(rateLimiter.getStatus().minuteUsage).toBe(0);
    });
  });

  describe('Singleton instance', () => {
    afterEach(() => {
      resetGeminiRateLimiter();
    });

    it('should return the same instance on multiple calls', () => {
      const instance1 = getGeminiRateLimiter();
      const instance2 = getGeminiRateLimiter();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = getGeminiRateLimiter();
      instance1.recordRequest();

      const instance2 = getGeminiRateLimiter();
      expect(instance2.getDailyUsage()).toBe(1);
    });

    it('should reset singleton instance', () => {
      const instance1 = getGeminiRateLimiter();
      instance1.recordRequest();

      resetGeminiRateLimiter();

      const instance2 = getGeminiRateLimiter();
      expect(instance2.getDailyUsage()).toBe(0);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Combined minute and daily limits', () => {
    it('should block when minute limit is reached even if daily quota available', () => {
      // Make 10 requests (minute limit)
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest();
      }

      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(false);
      expect(status.minuteRemaining).toBe(0);
      expect(status.dailyRemaining).toBe(1490);
    });

    it('should block when daily limit is reached even if minute quota available', () => {
      // Make 1,500 requests instantly (daily limit)
      for (let i = 0; i < 1500; i++) {
        rateLimiter.recordRequest();
      }
      
      // Clear minute window
      vi.advanceTimersByTime(61000);

      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(false);
      expect(status.minuteRemaining).toBe(10);
      expect(status.dailyRemaining).toBe(0);
    });

    it('should allow requests when both limits have quota', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest();
        vi.advanceTimersByTime(1000);
      }

      const status = rateLimiter.checkQuota();
      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(5);
      expect(status.dailyRemaining).toBe(1495);
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid successive requests', () => {
      // Make 10 requests without time advancement
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordRequest();
      }

      expect(rateLimiter.getMinuteUsage()).toBe(10);
      expect(rateLimiter.getDailyUsage()).toBe(10);
      expect(rateLimiter.checkQuota().allowed).toBe(false);
    });

    it('should handle requests at exact minute boundary', () => {
      rateLimiter.recordRequest();
      
      // Advance exactly 60 seconds
      vi.advanceTimersByTime(60000);

      // Old request should be outside window (>60000ms ago)
      expect(rateLimiter.getMinuteUsage()).toBe(0);

      // Make a new request
      rateLimiter.recordRequest();

      // Should have 1 request in window
      expect(rateLimiter.getMinuteUsage()).toBe(1);
    });

    it('should handle zero requests gracefully', () => {
      const status = rateLimiter.checkQuota();

      expect(status.allowed).toBe(true);
      expect(status.minuteRemaining).toBe(10);
      expect(status.dailyRemaining).toBe(1500);
      expect(rateLimiter.getMinuteUsage()).toBe(0);
      expect(rateLimiter.getDailyUsage()).toBe(0);
    });

    it('should never return negative remaining counts', () => {
      // Make more than limit (shouldn't happen in practice, but test defensive code)
      for (let i = 0; i < 15; i++) {
        rateLimiter.recordRequest();
      }

      const status = rateLimiter.checkQuota();
      expect(status.minuteRemaining).toBeGreaterThanOrEqual(0);
      expect(status.dailyRemaining).toBeGreaterThanOrEqual(0);
    });
  });
});
