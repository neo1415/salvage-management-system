/**
 * Claude API Rate Limiter
 * 
 * Implements a local safety limit for paid Claude damage requests.
 * 
 * Claude is available only when the paid fallback is explicitly enabled.
 * 
 * Limits:
 * - Conservative daily cap, configurable with CLAUDE_DAMAGE_DAILY_LIMIT
 * - 10 requests/minute (prevent burst costs)
 * 
 * Storage: In-memory (resets on server restart)
 * Provider-side spend limits remain authoritative. Use shared persistent
 * accounting when a hard organization-wide budget is required.
 */

interface RateLimitState {
  minuteRequests: Array<number>; // Timestamps of requests in current minute
  dailyRequests: Array<number>;  // Timestamps of requests in current day
}

class ClaudeRateLimiter {
  private state: RateLimitState = {
    minuteRequests: [],
    dailyRequests: [],
  };

  // Rate limits
  private readonly REQUESTS_PER_MINUTE = 10;
  private readonly REQUESTS_PER_DAY = Math.max(1, Number(process.env.CLAUDE_DAMAGE_DAILY_LIMIT) || 2);

  /**
   * Check if a request is allowed under current rate limits
   * 
   * @returns Object with allowed status and remaining quotas
   */
  checkQuota(): {
    allowed: boolean;
    minuteRemaining: number;
    dailyRemaining: number;
    resetMinute: Date;
    resetDaily: Date;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean up old requests
    this.state.minuteRequests = this.state.minuteRequests.filter(time => time > oneMinuteAgo);
    this.state.dailyRequests = this.state.dailyRequests.filter(time => time > oneDayAgo);

    // Calculate remaining quotas
    const minuteRemaining = Math.max(0, this.REQUESTS_PER_MINUTE - this.state.minuteRequests.length);
    const dailyRemaining = Math.max(0, this.REQUESTS_PER_DAY - this.state.dailyRequests.length);

    // Check if allowed
    const allowed = minuteRemaining > 0 && dailyRemaining > 0;

    // Calculate reset times
    const oldestMinuteRequest = this.state.minuteRequests[0] || now;
    const oldestDailyRequest = this.state.dailyRequests[0] || now;
    const resetMinute = new Date(oldestMinuteRequest + 60 * 1000);
    const resetDaily = new Date(oldestDailyRequest + 24 * 60 * 60 * 1000);

    return {
      allowed,
      minuteRemaining,
      dailyRemaining,
      resetMinute,
      resetDaily,
    };
  }

  /**
   * Record a successful request
   * Call this after a successful Claude API call
   */
  recordRequest(): void {
    const now = Date.now();
    this.state.minuteRequests.push(now);
    this.state.dailyRequests.push(now);

    console.info(
      `[Claude Rate Limiter] Request recorded. ` +
      `Minute: ${this.state.minuteRequests.length}/${this.REQUESTS_PER_MINUTE}, ` +
      `Daily: ${this.state.dailyRequests.length}/${this.REQUESTS_PER_DAY}`
    );
  }

  /**
   * Get current usage statistics
   */
  getStats(): {
    minuteUsed: number;
    minuteLimit: number;
    dailyUsed: number;
    dailyLimit: number;
    minutePercentage: number;
    dailyPercentage: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean up old requests
    this.state.minuteRequests = this.state.minuteRequests.filter(time => time > oneMinuteAgo);
    this.state.dailyRequests = this.state.dailyRequests.filter(time => time > oneDayAgo);

    const minuteUsed = this.state.minuteRequests.length;
    const dailyUsed = this.state.dailyRequests.length;

    return {
      minuteUsed,
      minuteLimit: this.REQUESTS_PER_MINUTE,
      dailyUsed,
      dailyLimit: this.REQUESTS_PER_DAY,
      minutePercentage: (minuteUsed / this.REQUESTS_PER_MINUTE) * 100,
      dailyPercentage: (dailyUsed / this.REQUESTS_PER_DAY) * 100,
    };
  }

  /**
   * Reset all rate limits (for testing)
   */
  reset(): void {
    this.state = {
      minuteRequests: [],
      dailyRequests: [],
    };
    console.info('[Claude Rate Limiter] Rate limits reset');
  }
}

// Export singleton instance
const claudeRateLimiter = new ClaudeRateLimiter();

export function getClaudeRateLimiter(): ClaudeRateLimiter {
  return claudeRateLimiter;
}
