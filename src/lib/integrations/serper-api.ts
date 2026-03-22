/**
 * Serper.dev API Client for Universal Internet Search
 * 
 * This service provides a robust interface to the Serper.dev Google Search API
 * for real-time market price discovery and salvage value calculations.
 * 
 * Features:
 * - Rate limiting (2,500/month, 100/minute)
 * - Error handling and retry logic
 * - Request/response logging
 * - API key validation
 */

// Types
export interface SerperSearchOptions {
  q: string;
  gl?: string; // Geographic location (default: 'ng' for Nigeria)
  hl?: string; // Language (default: 'en')
  type?: 'search' | 'images' | 'news';
  engine?: 'google' | 'bing';
  num?: number; // Number of results (1-100, default: 10)
}

export interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  rating?: number;
  ratingCount?: number;
  currency?: string;
  price?: number;
  priceRange?: string;
}

export interface SerperResponse {
  searchParameters: {
    q: string;
    gl: string;
    type: string;
    engine: string;
  };
  organic: SerperSearchResult[];
  credits: number;
}

export interface RateLimitInfo {
  monthlyUsage: number;
  monthlyLimit: number;
  minuteUsage: number;
  minuteLimit: number;
  resetTime: Date;
}

export interface SearchError {
  code: string;
  message: string;
  retryable: boolean;
  rateLimited: boolean;
}

// Rate limiter class
class SerperRateLimiter {
  private monthlyUsage = 0;
  private minuteUsage = 0;
  private lastMinuteReset = new Date();
  private lastMonthReset = new Date();
  
  private readonly MONTHLY_LIMIT = parseInt(process.env.SERPER_RATE_LIMIT_PER_MONTH || '2500');
  private readonly MINUTE_LIMIT = parseInt(process.env.SERPER_RATE_LIMIT_PER_MINUTE || '100');

  checkQuota(): { allowed: boolean; reason?: string } {
    this.resetCountersIfNeeded();
    
    if (this.monthlyUsage >= this.MONTHLY_LIMIT) {
      return { 
        allowed: false, 
        reason: `Monthly quota exceeded (${this.monthlyUsage}/${this.MONTHLY_LIMIT})` 
      };
    }
    
    if (this.minuteUsage >= this.MINUTE_LIMIT) {
      return { 
        allowed: false, 
        reason: `Rate limit exceeded (${this.minuteUsage}/${this.MINUTE_LIMIT} per minute)` 
      };
    }
    
    return { allowed: true };
  }

  recordUsage(): void {
    this.resetCountersIfNeeded();
    this.monthlyUsage++;
    this.minuteUsage++;
  }

  getRateLimitInfo(): RateLimitInfo {
    this.resetCountersIfNeeded();
    
    const nextMinuteReset = new Date(this.lastMinuteReset);
    nextMinuteReset.setMinutes(nextMinuteReset.getMinutes() + 1);
    
    return {
      monthlyUsage: this.monthlyUsage,
      monthlyLimit: this.MONTHLY_LIMIT,
      minuteUsage: this.minuteUsage,
      minuteLimit: this.MINUTE_LIMIT,
      resetTime: nextMinuteReset
    };
  }

  private resetCountersIfNeeded(): void {
    const now = new Date();
    
    // Reset minute counter every minute
    if (now.getTime() - this.lastMinuteReset.getTime() >= 60000) {
      this.minuteUsage = 0;
      this.lastMinuteReset = now;
    }
    
    // Reset monthly counter every month
    if (now.getMonth() !== this.lastMonthReset.getMonth() || 
        now.getFullYear() !== this.lastMonthReset.getFullYear()) {
      this.monthlyUsage = 0;
      this.lastMonthReset = now;
    }
  }
}

// Main API client class
export class SerperApiClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev/search';
  private readonly rateLimiter = new SerperRateLimiter();
  
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY environment variable is required');
    }
  }

  /**
   * Perform a Google search using Serper.dev API
   */
  async searchGoogle(
    query: string, 
    options: Partial<SerperSearchOptions> = {}
  ): Promise<SerperResponse> {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      const quotaCheck = this.rateLimiter.checkQuota();
      if (!quotaCheck.allowed) {
        throw this.createError('RATE_LIMIT_EXCEEDED', quotaCheck.reason!, false, true);
      }

      // Validate and sanitize query
      const sanitizedQuery = this.sanitizeQuery(query);
      if (!sanitizedQuery) {
        throw this.createError('INVALID_QUERY', 'Query is empty or invalid', false, false);
      }

      // Build search options
      const searchOptions: SerperSearchOptions = {
        q: sanitizedQuery,
        gl: 'ng', // Nigeria by default
        hl: 'en',
        type: 'search',
        engine: 'google',
        num: 10,
        ...options
      };

      // Make API request
      const response = await this.makeRequest(searchOptions);
      
      // Record successful usage
      this.rateLimiter.recordUsage();
      
      // Log successful search
      await this.logSearch(query, searchOptions, response, Date.now() - startTime, true);
      
      return response;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log failed search
      await this.logSearch(query, options, null, responseTime, false, error);
      
      // Re-throw with proper error handling
      if (error instanceof Error && 'code' in error) {
        throw error; // Already a SearchError
      }
      
      throw this.createError('API_ERROR', `Search failed: ${error}`, true, false);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.searchGoogle('test query', { num: 1 });
      return true;
    } catch (error: any) {
      if (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_API_KEY') {
        return false;
      }
      // Other errors don't necessarily mean invalid API key
      return true;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitInfo {
    return this.rateLimiter.getRateLimitInfo();
  }

  /**
   * Alias for searchGoogle for backward compatibility
   */
  async search(
    query: string, 
    options: Partial<SerperSearchOptions> = {}
  ): Promise<SerperResponse> {
    return this.searchGoogle(query, options);
  }

  /**
   * Make HTTP request to Serper API with retry logic
   */
  private async makeRequest(
    options: SerperSearchOptions, 
    retryCount = 0
  ): Promise<SerperResponse> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific HTTP status codes
        switch (response.status) {
          case 401:
            throw this.createError('UNAUTHORIZED', 'Invalid API key', false, false);
          case 429:
            throw this.createError('RATE_LIMIT_EXCEEDED', 'API rate limit exceeded', true, true);
          case 500:
          case 502:
          case 503:
          case 504:
            throw this.createError('SERVER_ERROR', `Server error: ${response.status}`, true, false);
          default:
            throw this.createError('HTTP_ERROR', `HTTP ${response.status}: ${errorText}`, false, false);
        }
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.organic || !Array.isArray(data.organic)) {
        throw this.createError('INVALID_RESPONSE', 'Invalid API response structure', false, false);
      }

      return data;
      
    } catch (error: any) {
      // Retry logic for retryable errors
      if (error.retryable && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.makeRequest(options, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Sanitize search query to prevent injection attacks
   */
  private sanitizeQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Remove dangerous characters and patterns
    const sanitized = query
      .replace(/[<>\"']/g, '') // HTML/JS injection
      .replace(/[;&|`$()]/g, '') // Shell injection
      .replace(/\b(script|eval|function)\b/gi, '') // JS keywords
      .trim();

    // Limit length
    return sanitized.substring(0, 500);
  }

  /**
   * Create standardized error object
   */
  private createError(
    code: string, 
    message: string, 
    retryable: boolean, 
    rateLimited: boolean
  ): SearchError {
    const error = new Error(message) as SearchError;
    error.code = code;
    error.retryable = retryable;
    error.rateLimited = rateLimited;
    return error;
  }

  /**
   * Log search request and response for debugging and analytics
   */
  private async logSearch(
    originalQuery: string,
    options: Partial<SerperSearchOptions>,
    response: SerperResponse | null,
    responseTime: number,
    success: boolean,
    error?: any
  ): Promise<void> {
    try {
      const logData = {
        service: 'serper-api',
        action: 'search',
        query: originalQuery,
        options: {
          gl: options.gl,
          num: options.num,
          type: options.type
        },
        success,
        responseTime,
        resultCount: response?.organic?.length || 0,
        credits: response?.credits,
        error: error ? {
          code: error.code || 'UNKNOWN',
          message: error.message,
          retryable: error.retryable
        } : undefined,
        timestamp: new Date().toISOString()
      };

      // For now, use console logging. Later we can integrate with proper audit system
      if (process.env.NODE_ENV === 'development') {
        console.log('Serper API Search:', JSON.stringify(logData, null, 2));
      }
    } catch (logError) {
      // Don't let logging errors affect the main operation
      console.error('Failed to log Serper search:', logError);
    }
  }
}

// Lazy-loaded singleton instance
let _serperApiInstance: SerperApiClient | null = null;

export const serperApi = {
  get instance(): SerperApiClient {
    if (!_serperApiInstance) {
      _serperApiInstance = new SerperApiClient();
    }
    return _serperApiInstance;
  },
  
  // Delegate methods to the instance
  async searchGoogle(query: string, options: Partial<SerperSearchOptions> = {}): Promise<SerperResponse> {
    return this.instance.searchGoogle(query, options);
  },
  
  async search(query: string, options: Partial<SerperSearchOptions> = {}): Promise<SerperResponse> {
    return this.instance.search(query, options);
  },
  
  async validateApiKey(): Promise<boolean> {
    return this.instance.validateApiKey();
  },
  
  getRateLimitStatus(): RateLimitInfo {
    return this.instance.getRateLimitStatus();
  }
};

// Export helper functions
export function handleApiError(error: any): SearchError {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as SearchError;
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'Unknown error occurred',
    retryable: false,
    rateLimited: false
  };
}