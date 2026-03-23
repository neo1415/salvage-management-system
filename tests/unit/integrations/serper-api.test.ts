/**
 * Unit tests for Serper.dev API Client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SerperApiClient, handleApiError } from '@/lib/integrations/serper-api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe('SerperApiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      SERPER_API_KEY: 'test-api-key-12345',
      SERPER_RATE_LIMIT_PER_MONTH: '2500',
      SERPER_RATE_LIMIT_PER_MINUTE: '100'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should initialize with API key from environment', () => {
      expect(() => new SerperApiClient()).not.toThrow();
    });

    it('should throw error if API key is missing', () => {
      delete process.env.SERPER_API_KEY;
      expect(() => new SerperApiClient()).toThrow('SERPER_API_KEY environment variable is required');
    });
  });

  describe('searchGoogle', () => {
    let client: SerperApiClient;

    beforeEach(() => {
      client = new SerperApiClient();
    });

    it('should perform successful search', async () => {
      const mockResponse = {
        searchParameters: {
          q: 'Toyota Camry 2021',
          gl: 'ng',
          type: 'search',
          engine: 'google'
        },
        organic: [
          {
            title: 'Toyota Camry 2021 in Nigeria',
            link: 'https://jiji.ng/cars/toyota-camry-2021',
            snippet: 'Toyota Camry 2021 Black · ₦ 48,950,000',
            position: 1,
            price: 48950000,
            currency: 'NGN'
          }
        ],
        credits: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.searchGoogle('Toyota Camry 2021');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://google.serper.dev/search',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-KEY': 'test-api-key-12345',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: 'Toyota Camry 2021',
            gl: 'ng',
            hl: 'en',
            type: 'search',
            engine: 'google',
            num: 10
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(client.searchGoogle('test query')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
        retryable: false,
        rateLimited: false
      });
    });

    it('should handle rate limiting', async () => {
      mockFetch.mockRejectedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      await expect(client.searchGoogle('test query')).rejects.toMatchObject({
        code: 'API_ERROR',
        retryable: true
      });
    });

    it('should sanitize dangerous queries', async () => {
      const mockResponse = {
        searchParameters: { q: 'safe query', gl: 'ng', type: 'search', engine: 'google' },
        organic: [],
        credits: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await client.searchGoogle('<script>alert("xss")</script>safe query');

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.q).toBe('scriptalertxss/scriptsafe query'); // Should be sanitized
    });

    it('should respect custom search options', async () => {
      const mockResponse = {
        searchParameters: { q: 'test', gl: 'us', type: 'search', engine: 'google' },
        organic: [],
        credits: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await client.searchGoogle('test query', {
        gl: 'us',
        num: 5,
        type: 'news'
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.gl).toBe('us');
      expect(body.num).toBe(5);
      expect(body.type).toBe('news');
    });
  });

  describe('Rate Limiting', () => {
    let client: SerperApiClient;

    beforeEach(() => {
      client = new SerperApiClient();
    });

    it('should track rate limit usage', () => {
      const rateLimitInfo = client.getRateLimitStatus();
      
      expect(rateLimitInfo).toMatchObject({
        monthlyUsage: expect.any(Number),
        monthlyLimit: 2500,
        minuteUsage: expect.any(Number),
        minuteLimit: 100,
        resetTime: expect.any(Date)
      });
    });
  });

  describe('validateApiKey', () => {
    let client: SerperApiClient;

    beforeEach(() => {
      client = new SerperApiClient();
    });

    it('should return true for valid API key', async () => {
      const mockResponse = {
        searchParameters: { q: 'test query', gl: 'ng', type: 'search', engine: 'google' },
        organic: [],
        credits: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const isValid = await client.validateApiKey();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      const isValid = await client.validateApiKey();
      expect(isValid).toBe(false);
    });
  });
});

describe('handleApiError', () => {
  it('should handle SearchError objects', () => {
    const searchError = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded',
      retryable: true,
      rateLimited: true
    };

    const result = handleApiError(searchError);
    expect(result).toEqual(searchError);
  });

  it('should handle generic errors', () => {
    const genericError = new Error('Something went wrong');
    
    const result = handleApiError(genericError);
    expect(result).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong',
      retryable: false,
      rateLimited: false
    });
  });

  it('should handle unknown error types', () => {
    const result = handleApiError('string error');
    expect(result).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      retryable: false,
      rateLimited: false
    });
  });
});