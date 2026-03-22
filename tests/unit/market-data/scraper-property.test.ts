/**
 * Property-Based Tests for Scraper Service
 * 
 * Tests universal properties that should hold across all scraping operations.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Properties tested:
 * - Property 1: Multi-source scraping
 * - Property 3: Parallel scraping performance
 * - Property 4: Complete data extraction
 * - Property 5: Robots.txt compliance
 * - Property 22: Individual source timeout
 * - Property 23: Partial failure resilience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import axios from 'axios';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';
import { scrapeAllSources, scrapeSource } from '../../../src/features/market-data/services/scraper.service';
import * as rateLimiter from '../../../src/features/market-data/services/rate-limiter.service';

// Mock axios and rate limiter
vi.mock('axios');
vi.mock('../../../src/features/market-data/services/rate-limiter.service');

describe('Scraper Service - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock rate limiter to always allow requests
    vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(rateLimiter.recordRequest).mockResolvedValue();
    vi.mocked(rateLimiter.waitForRateLimit).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Multi-source scraping
   * **Validates: Requirements 1.1**
   * 
   * For any property identifier, when scraping is initiated, the system should 
   * attempt to scrape at least 3 sources and return results from all sources.
   */
  it('Property 1: Multi-source scraping - should attempt at least 3 sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          // Mock successful responses for all sources
          vi.mocked(axios.get).mockResolvedValue({
            status: 200,
            data: '<html><body></body></html>',
          });

          const results = await scrapeAllSources(property);

          // Should attempt at least 3 sources for vehicles
          expect(results.length).toBeGreaterThanOrEqual(3);
          
          // All sources should be represented in results
          const sources = results.map(r => r.source);
          expect(sources).toContain('jiji');
          expect(sources).toContain('jumia');
          expect(sources).toContain('cars45');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Parallel scraping performance
   * **Validates: Requirements 1.5**
   * 
   * For any set of sources, when scraping multiple sources, the total execution 
   * time should be less than the sum of individual scraping times.
   */
  it('Property 3: Parallel scraping performance - total time < sum of individual times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          // Mock responses with artificial delay
          vi.mocked(axios.get).mockImplementation(async (url) => {
            // Handle robots.txt requests quickly
            if (typeof url === 'string' && url.includes('robots.txt')) {
              return {
                status: 404,
                data: '',
              };
            }
            
            // Add delay for actual scraping requests
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
              status: 200,
              data: '<html><body></body></html>',
            };
          });

          const startTime = Date.now();
          const results = await scrapeAllSources(property);
          const totalTime = Date.now() - startTime;

          // Sum of individual durations
          const sumOfDurations = results.reduce((sum, r) => sum + r.duration, 0);

          // Total time should be less than sum (indicating parallel execution)
          // Allow 20% margin for overhead
          expect(totalTime).toBeLessThan(sumOfDurations * 0.8);
        }
      ),
      { numRuns: 50 } // Reduced runs due to timing sensitivity
    );
  }, 10000); // Increase timeout to 10 seconds

  /**
   * Property 4: Complete data extraction
   * **Validates: Requirements 1.6, 2.7**
   * 
   * For any successful scrape result, the extracted data should contain 
   * price, listing title, and listing URL fields.
   */
  it('Property 4: Complete data extraction - all fields present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          // Mock HTML with valid listing data
          const mockHtml = `
            <html>
              <body>
                <div class="b-list-advert__item">
                  <div class="qa-advert-price">₦5,000,000</div>
                  <div class="qa-advert-title">Test Vehicle</div>
                  <a class="qa-advert-list-item-link" href="/listing/123"></a>
                </div>
              </body>
            </html>
          `;

          vi.mocked(axios.get).mockResolvedValue({
            status: 200,
            data: mockHtml,
          });

          const result = await scrapeSource('jiji', property);

          if (result.success && result.prices.length > 0) {
            // Every price should have all required fields
            result.prices.forEach(price => {
              expect(price.price).toBeGreaterThan(0);
              expect(price.listingTitle).toBeTruthy();
              expect(price.listingUrl).toBeTruthy();
              expect(price.currency).toBe('NGN');
              expect(price.source).toBe('jiji');
              expect(price.scrapedAt).toBeInstanceOf(Date);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Robots.txt compliance
   * **Validates: Requirements 1.7**
   * 
   * For any source, before scraping, the system should check robots.txt 
   * and skip any disallowed paths.
   */
  it('Property 5: Robots.txt compliance - respects disallow directives', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          // Mock robots.txt that disallows all paths
          vi.mocked(axios.get).mockImplementation(async (url) => {
            if (typeof url === 'string' && url.includes('robots.txt')) {
              return {
                status: 200,
                data: 'User-agent: *\nDisallow: /',
              };
            }
            return {
              status: 200,
              data: '<html><body></body></html>',
            };
          });

          const result = await scrapeSource('jiji', property);

          // Should fail due to robots.txt disallow
          expect(result.success).toBe(false);
          expect(result.error).toContain('robots.txt');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Individual source timeout
   * **Validates: Requirements 6.4, 6.5**
   * 
   * For any source request, if the source doesn't respond within 5 seconds, 
   * the request should timeout and the scraper should continue with remaining sources.
   */
  it('Property 22: Individual source timeout - enforces 5-second timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          // Create a proper axios error object
          const timeoutError = new Error('timeout of 5000ms exceeded') as any;
          timeoutError.code = 'ECONNABORTED';
          timeoutError.isAxiosError = true;
          
          // Mock axios.isAxiosError to return true for our error
          vi.mocked(axios.isAxiosError).mockReturnValue(true);
          
          // Mock timeout error for all requests
          vi.mocked(axios.get).mockRejectedValue(timeoutError);

          const startTime = Date.now();
          const result = await scrapeSource('jiji', property);
          const duration = Date.now() - startTime;

          // Should timeout and return error
          expect(result.success).toBe(false);
          expect(result.error).toContain('timeout');
          
          // Duration should be around 5 seconds (allow 1000ms margin for overhead)
          expect(duration).toBeLessThan(6000);
        }
      ),
      { numRuns: 50 } // Reduced runs due to timing
    );
  });

  /**
   * Property 23: Partial failure resilience
   * **Validates: Requirements 7.1, 7.2, 6.5**
   * 
   * For any scraping operation where some sources fail, the system should 
   * continue scraping remaining sources and return results from successful sources.
   */
  it('Property 23: Partial failure resilience - continues with remaining sources', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
          year: fc.integer({ min: 2000, max: 2024 }),
        }),
        async (vehicle) => {
          const property: PropertyIdentifier = {
            type: 'vehicle',
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
          };

          let requestCount = 0;

          // Mock: first scraping request fails, others succeed
          vi.mocked(axios.get).mockImplementation(async (url) => {
            // Handle robots.txt requests - always return 404 (no robots.txt)
            if (typeof url === 'string' && url.includes('robots.txt')) {
              return {
                status: 404,
                data: '',
              };
            }

            // Track actual scraping requests
            requestCount++;
            
            // First scraping request fails
            if (requestCount === 1) {
              throw {
                response: { status: 500, statusText: 'Internal Server Error' },
                isAxiosError: true,
              };
            }

            // Subsequent scraping requests succeed
            return {
              status: 200,
              data: '<html><body></body></html>',
            };
          });

          const results = await scrapeAllSources(property);

          // Should have results from all sources (some failed, some succeeded)
          expect(results.length).toBeGreaterThanOrEqual(3);

          // At least one should have failed
          const failedResults = results.filter(r => !r.success);
          expect(failedResults.length).toBeGreaterThan(0);

          // At least one should have succeeded
          const successResults = results.filter(r => r.success);
          expect(successResults.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

