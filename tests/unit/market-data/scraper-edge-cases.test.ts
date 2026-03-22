/**
 * Unit Tests for Scraper Service Edge Cases
 * 
 * Tests specific edge cases and error conditions for the scraper service.
 * Focuses on malformed HTML, network errors, empty results, and price parsing.
 * 
 * Requirements: 1.6, 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';
import { scrapeSource } from '../../../src/features/market-data/services/scraper.service';
import * as rateLimiter from '../../../src/features/market-data/services/rate-limiter.service';

// Mock axios and rate limiter
vi.mock('axios');
vi.mock('../../../src/features/market-data/services/rate-limiter.service');

describe('Scraper Service - Edge Cases', () => {
  const mockProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock rate limiter to allow requests
    vi.mocked(rateLimiter.waitForRateLimit).mockResolvedValue(undefined);
    vi.mocked(rateLimiter.recordRequest).mockResolvedValue(undefined);
    
    // Mock robots.txt check to allow scraping
    vi.mocked(axios.get).mockImplementation((url: string) => {
      if (url.includes('robots.txt')) {
        return Promise.resolve({
          data: 'User-agent: *\nAllow: /',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      }
      return Promise.reject(new Error('Not mocked'));
    });
  });

  describe('Malformed HTML Handling', () => {
    it('should handle HTML with no matching selectors', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: '<html><body><p>No listings here</p></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0);
    });

    it('should handle completely malformed HTML', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: '<html><body><div class="listing"><<<<invalid>>>></div></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0);
    });

    it('should handle HTML with partial listing data', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        // HTML with price but no title or link
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing">
                <span class="price">₦5,000,000</span>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0); // Should skip incomplete listings
    });
  });

  describe('Network Errors', () => {
    it('should handle connection timeout', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        const error = new Error('timeout of 5000ms exceeded') as AxiosError;
        error.code = 'ECONNABORTED';
        error.isAxiosError = true;
        return Promise.reject(error);
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.prices).toHaveLength(0);
    });

    it('should handle DNS resolution errors', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        const error = new Error('getaddrinfo ENOTFOUND') as AxiosError;
        error.code = 'ENOTFOUND';
        error.isAxiosError = true;
        return Promise.reject(error);
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.prices).toHaveLength(0);
    });

    it('should handle HTTP 404 errors', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        const error = new Error('Request failed with status code 404') as AxiosError;
        error.isAxiosError = true;
        error.response = {
          status: 404,
          statusText: 'Not Found',
          data: {},
          headers: {},
          config: {} as any,
        };
        return Promise.reject(error);
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
      expect(result.prices).toHaveLength(0);
    });

    it('should handle HTTP 500 server errors', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        const error = new Error('Request failed with status code 500') as AxiosError;
        error.isAxiosError = true;
        error.response = {
          status: 500,
          statusText: 'Internal Server Error',
          data: {},
          headers: {},
          config: {} as any,
        };
        return Promise.reject(error);
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(result.prices).toHaveLength(0);
    });
  });

  describe('Empty Results', () => {
    it('should handle pages with no listings', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: '<html><body><h1>No results found</h1></body></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0);
    });

    it('should handle empty HTML response', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: '',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0);
    });
  });

  describe('Price Parsing Edge Cases', () => {
    it('should handle prices without currency symbol', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing-item">
                <span class="price">5000000</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="listing-link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(5000000);
    });

    it('should handle prices with commas', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing-item">
                <span class="price">₦5,000,000</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="listing-link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(5000000);
    });

    it('should reject invalid price formats', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing">
                <span class="price">Call for price</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0); // Invalid price should be skipped
    });

    it('should reject negative prices', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing">
                <span class="price">-5000000</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0); // Negative price should be rejected
    });

    it('should reject unreasonably high prices', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing">
                <span class="price">₦99,999,999,999</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0); // Price over 10 billion should be rejected
    });

    it('should handle prices with decimal points', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing-item">
                <span class="price">₦5,000,000.50</span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="listing-link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(5000000.50);
    });

    it('should handle empty price strings', async () => {
      vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('robots.txt')) {
          return Promise.resolve({
            data: 'User-agent: *\nAllow: /',
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          });
        }
        
        return Promise.resolve({
          data: `
            <html><body>
              <div class="listing">
                <span class="price"></span>
                <h3 class="title">Toyota Camry 2020</h3>
                <a class="link" href="/listing/123">View</a>
              </div>
            </body></html>
          `,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
      });

      const result = await scrapeSource('cheki', mockProperty);

      expect(result.success).toBe(true);
      expect(result.prices).toHaveLength(0); // Empty price should be skipped
    });
  });
});
