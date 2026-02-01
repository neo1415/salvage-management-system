import { redis } from '@/lib/redis/client';

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  limit: number;
  
  /**
   * Time window in seconds
   */
  window: number;
  
  /**
   * Optional identifier (defaults to IP address)
   */
  identifier?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Rate limiting utility using Redis
 * Implements sliding window algorithm for accurate rate limiting
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Get identifier (IP address or custom identifier)
    const identifier = config.identifier || getClientIdentifier(request);
    
    // Create Redis key
    const key = `rate_limit:${identifier}`;
    
    // Get current timestamp
    const now = Date.now();
    const windowStart = now - config.window * 1000;
    
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);
    
    // Count requests in current window
    const requestCount = await redis.zcard(key);
    
    // Check if limit exceeded
    if (requestCount >= config.limit) {
      // Get oldest request timestamp to calculate retry-after
      const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true });
      const oldestTimestamp = oldestRequest.length > 0 ? Number(oldestRequest[1]) : now;
      const resetTime = oldestTimestamp + config.window * 1000;
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      };
    }
    
    // Add current request to sorted set
    await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    
    // Set expiry on key (cleanup)
    await redis.expire(key, config.window);
    
    // Calculate reset time
    const resetTime = now + config.window * 1000;
    
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - requestCount - 1,
      reset: resetTime,
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Date.now() + config.window * 1000,
    };
  }
}

/**
 * Get client identifier from request
 * Prioritizes X-Forwarded-For header, falls back to X-Real-IP, then connection
 */
function getClientIdentifier(request: Request): string {
  const headers = request.headers;
  
  // Try X-Forwarded-For (proxy/load balancer)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to 'unknown'
  return 'unknown';
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
  };
}
