/**
 * Rate Limiter Service
 * 
 * Enforces rate limiting using Vercel KV (Redis) to prevent overwhelming e-commerce sources.
 * Implements sliding window rate limiting: 2 requests per second per source.
 * 
 * Requirements: 1.8, 7.5
 */

import { kv } from '@vercel/kv';

export interface RateLimitConfig {
  source: string;
  requestsPerSecond: number;
  burstSize: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // milliseconds
}

/**
 * Default rate limit configurations per source
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  jiji: {
    source: 'jiji',
    requestsPerSecond: 2,
    burstSize: 5,
  },
  jumia: {
    source: 'jumia',
    requestsPerSecond: 2,
    burstSize: 5,
  },
  cars45: {
    source: 'cars45',
    requestsPerSecond: 2,
    burstSize: 5,
  },
  cheki: {
    source: 'cheki',
    requestsPerSecond: 2,
    burstSize: 5,
  },
};

/**
 * Get rate limit key for a source
 */
function getRateLimitKey(source: string): string {
  return `rate_limit:${source}`;
}

/**
 * Check if a request is allowed under rate limiting
 * Uses sliding window algorithm with Redis
 */
export async function checkRateLimit(source: string): Promise<RateLimitResult> {
  const config = DEFAULT_RATE_LIMITS[source] || {
    source,
    requestsPerSecond: 2,
    burstSize: 5,
  };

  const key = getRateLimitKey(source);
  const now = Date.now();
  const windowSize = 1000; // 1 second in milliseconds
  const windowStart = now - windowSize;

  try {
    // Get all timestamps in the current window using zrange
    const timestamps = await kv.zrange(key, windowStart, now, { byScore: true }) as string[];
    
    // Count requests in current window
    const requestCount = timestamps ? timestamps.length : 0;

    // Check if under limit
    if (requestCount < config.requestsPerSecond) {
      return { allowed: true };
    }

    // Calculate retry after time
    const oldestTimestamp = timestamps && timestamps.length > 0 
      ? parseInt(timestamps[0]) 
      : now;
    const retryAfter = Math.max(0, oldestTimestamp + windowSize - now);

    return {
      allowed: false,
      retryAfter,
    };
  } catch (error) {
    console.error(`Rate limit check failed for ${source}:`, error);
    // Fail open - allow request if Redis is unavailable
    return { allowed: true };
  }
}

/**
 * Record a request for rate limiting
 * Adds timestamp to sliding window
 */
export async function recordRequest(source: string): Promise<void> {
  const key = getRateLimitKey(source);
  const now = Date.now();
  const windowSize = 1000; // 1 second
  const windowStart = now - windowSize;

  try {
    // Add current timestamp to sorted set
    await kv.zadd(key, { score: now, member: now.toString() });

    // Remove old timestamps outside the window
    await kv.zremrangebyscore(key, 0, windowStart);

    // Set expiration to clean up old keys (2 seconds)
    await kv.expire(key, 2);
  } catch (error) {
    console.error(`Failed to record request for ${source}:`, error);
    // Don't throw - rate limiting is best effort
  }
}

/**
 * Wait for rate limit to clear before proceeding
 * Implements exponential backoff with jitter
 */
export async function waitForRateLimit(source: string): Promise<void> {
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    const result = await checkRateLimit(source);

    if (result.allowed) {
      return;
    }

    // Calculate wait time with exponential backoff and jitter
    const baseWait = result.retryAfter || 500;
    const jitter = Math.random() * 100;
    const waitTime = baseWait + jitter;

    console.log(`Rate limit hit for ${source}, waiting ${waitTime}ms (attempt ${attempt + 1}/${maxAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, waitTime));
    attempt++;
  }

  throw new Error(`Rate limit exceeded for ${source} after ${maxAttempts} attempts`);
}

/**
 * Get current rate limit status for a source
 * Useful for monitoring and debugging
 */
export async function getRateLimitStatus(source: string): Promise<{
  requestCount: number;
  allowed: boolean;
  retryAfter?: number;
}> {
  const key = getRateLimitKey(source);
  const now = Date.now();
  const windowSize = 1000;
  const windowStart = now - windowSize;

  try {
    const timestamps = await kv.zrange(key, windowStart, now, { byScore: true }) as string[];
    const requestCount = timestamps ? timestamps.length : 0;
    const config = DEFAULT_RATE_LIMITS[source] || { requestsPerSecond: 2 };
    const allowed = requestCount < config.requestsPerSecond;

    let retryAfter: number | undefined;
    if (!allowed && timestamps && timestamps.length > 0) {
      const oldestTimestamp = parseInt(timestamps[0]);
      retryAfter = Math.max(0, oldestTimestamp + windowSize - now);
    }

    return {
      requestCount,
      allowed,
      retryAfter,
    };
  } catch (error) {
    console.error(`Failed to get rate limit status for ${source}:`, error);
    return {
      requestCount: 0,
      allowed: true,
    };
  }
}

/**
 * Reset rate limit for a source
 * Useful for testing and manual intervention
 */
export async function resetRateLimit(source: string): Promise<void> {
  const key = getRateLimitKey(source);

  try {
    await kv.del(key);
  } catch (error) {
    console.error(`Failed to reset rate limit for ${source}:`, error);
    throw new Error(`Failed to reset rate limit for ${source}`);
  }
}
