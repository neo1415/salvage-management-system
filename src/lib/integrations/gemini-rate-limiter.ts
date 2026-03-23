/**
 * Gemini API Rate Limiter
 * 
 * Enforces Gemini API free tier rate limits:
 * - 10 requests per minute (sliding window)
 * - 1,500 requests per day (counter with UTC midnight reset)
 * 
 * Uses in-memory counters for simplicity (no Redis dependency).
 * Thread-safe operations using atomic operations.
 */

export interface RateLimitStatus {
  allowed: boolean;
  minuteRemaining: number;
  dailyRemaining: number;
  resetAt: Date;
}

export class GeminiRateLimiter {
  private minuteRequests: number[] = []; // Timestamps of requests in current minute
  private dailyCount: number = 0;
  private dailyResetAt: Date;
  private lastRequestAt: Date | null = null;

  // Rate limit constants
  private readonly MINUTE_LIMIT = 10;
  private readonly DAILY_LIMIT = 1500;
  private readonly MINUTE_WINDOW_MS = 60000; // 60 seconds
  private readonly WARNING_THRESHOLD_80 = 1200; // 80% of daily quota
  private readonly WARNING_THRESHOLD_90 = 1350; // 90% of daily quota

  constructor() {
    this.dailyResetAt = this.getNextMidnightUTC();
  }

  /**
   * Check if a request can be made within rate limits
   * @returns RateLimitStatus indicating if request is allowed and remaining quotas
   */
  checkQuota(): RateLimitStatus {
    this.checkDailyReset();
    this.cleanupOldMinuteRequests();

    const minuteRemaining = Math.max(0, this.MINUTE_LIMIT - this.minuteRequests.length);
    const dailyRemaining = Math.max(0, this.DAILY_LIMIT - this.dailyCount);

    const allowed = minuteRemaining > 0 && dailyRemaining > 0;

    return {
      allowed,
      minuteRemaining,
      dailyRemaining,
      resetAt: this.dailyResetAt,
    };
  }

  /**
   * Record a request and update counters
   * Should be called after a successful API request
   */
  recordRequest(): void {
    this.checkDailyReset();
    
    const now = Date.now();
    this.minuteRequests.push(now);
    this.dailyCount++;
    this.lastRequestAt = new Date(now);

    // Log quota warnings
    if (this.dailyCount === this.WARNING_THRESHOLD_80) {
      console.warn(
        `[Gemini Rate Limiter] 80% of daily quota used (${this.dailyCount}/${this.DAILY_LIMIT} requests)`
      );
    }
    if (this.dailyCount === this.WARNING_THRESHOLD_90) {
      console.warn(
        `[Gemini Rate Limiter] 90% of daily quota used (${this.dailyCount}/${this.DAILY_LIMIT} requests)`
      );
    }
    if (this.dailyCount >= this.DAILY_LIMIT) {
      console.error(
        `[Gemini Rate Limiter] Daily quota exhausted (${this.dailyCount}/${this.DAILY_LIMIT} requests). Falling back to Vision API.`
      );
    }

    this.cleanupOldMinuteRequests();
  }

  /**
   * Get current daily usage count
   * @returns Number of requests made today
   */
  getDailyUsage(): number {
    this.checkDailyReset();
    return this.dailyCount;
  }

  /**
   * Get current minute usage count
   * @returns Number of requests made in the last minute
   */
  getMinuteUsage(): number {
    this.cleanupOldMinuteRequests();
    return this.minuteRequests.length;
  }

  /**
   * Reset all counters (for testing purposes)
   */
  reset(): void {
    this.minuteRequests = [];
    this.dailyCount = 0;
    this.dailyResetAt = this.getNextMidnightUTC();
    this.lastRequestAt = null;
  }

  /**
   * Remove requests older than 1 minute from the sliding window
   * @private
   */
  private cleanupOldMinuteRequests(): void {
    const now = Date.now();
    const oneMinuteAgo = now - this.MINUTE_WINDOW_MS;
    
    // Filter out requests older than 1 minute
    this.minuteRequests = this.minuteRequests.filter(
      timestamp => timestamp > oneMinuteAgo
    );
  }

  /**
   * Check if daily counter should be reset (UTC midnight)
   * @private
   */
  private checkDailyReset(): void {
    const now = new Date();
    
    if (now >= this.dailyResetAt) {
      console.info(
        `[Gemini Rate Limiter] Daily quota reset at ${now.toISOString()}. Previous usage: ${this.dailyCount}/${this.DAILY_LIMIT} requests.`
      );
      this.dailyCount = 0;
      this.dailyResetAt = this.getNextMidnightUTC();
    }
  }

  /**
   * Calculate the next UTC midnight timestamp
   * @private
   * @returns Date object representing next UTC midnight
   */
  private getNextMidnightUTC(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Get detailed status information for monitoring
   * @returns Object with detailed rate limit status
   */
  getStatus(): {
    minuteUsage: number;
    minuteLimit: number;
    dailyUsage: number;
    dailyLimit: number;
    dailyResetAt: Date;
    lastRequestAt: Date | null;
  } {
    this.checkDailyReset();
    this.cleanupOldMinuteRequests();

    return {
      minuteUsage: this.minuteRequests.length,
      minuteLimit: this.MINUTE_LIMIT,
      dailyUsage: this.dailyCount,
      dailyLimit: this.DAILY_LIMIT,
      dailyResetAt: this.dailyResetAt,
      lastRequestAt: this.lastRequestAt,
    };
  }
}

// Singleton instance for application-wide rate limiting
let rateLimiterInstance: GeminiRateLimiter | null = null;

/**
 * Get the singleton rate limiter instance
 * @returns GeminiRateLimiter instance
 */
export function getGeminiRateLimiter(): GeminiRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new GeminiRateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Reset the singleton instance (for testing purposes)
 */
export function resetGeminiRateLimiter(): void {
  rateLimiterInstance = null;
}
