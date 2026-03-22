/**
 * Integration Test: Scraper Year Filtering
 * 
 * Tests year filtering integration in the scraper service.
 * Validates that only year-matched listings are returned.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { scrapeSource } from '../../../src/features/market-data/services/scraper.service';
import type { PropertyIdentifier } from '../../../src/features/market-data/types';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock rate limiter
vi.mock('../../../src/features/market-data/services/rate-limiter.service', () => ({
  waitForRateLimit: vi.fn().mockResolvedValue(undefined),
  recordRequest: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('Scraper Year Filtering Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for robots.txt (404 = no robots.txt)
    mockedAxios.get.mockResolvedValue({ data: '', status: 404 });
  });

  it('should filter listings by year and return only year-matched results', async () => {
    // Mock HTML response with listings of various years
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Honda Accord 2004 - Clean</div>
              <div class="qa-advert-price">₦2,500,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing2">
              <div class="qa-advert-title">Honda Accord 2013 - Excellent</div>
              <div class="qa-advert-price">₦5,350,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing3">
              <div class="qa-advert-title">Honda Accord 2005 - Good</div>
              <div class="qa-advert-price">₦2,800,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing4">
              <div class="qa-advert-title">Honda Accord - No year</div>
              <div class="qa-advert-price">₦3,000,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2004,
    };

    const result = await scrapeSource('jiji', property);

    // Should succeed
    expect(result.success).toBe(true);
    
    // Should only return year-matched listings (2004 and 2005, within ±1 year)
    expect(result.prices).toHaveLength(2);
    expect(result.prices[0].listingTitle).toContain('2004');
    expect(result.prices[1].listingTitle).toContain('2005');
    
    // All returned listings should be marked as year-matched
    expect(result.prices[0].yearMatched).toBe(true);
    expect(result.prices[1].yearMatched).toBe(true);
  });

  it('should store extracted years in results', async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Toyota Camry 2010</div>
              <div class="qa-advert-price">₦3,500,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2010,
    };

    const result = await scrapeSource('jiji', property);

    expect(result.success).toBe(true);
    expect(result.prices).toHaveLength(1);
    expect(result.prices[0].extractedYear).toBe(2010);
  });

  it('should include year filter metadata in results', async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Honda Accord 2004</div>
              <div class="qa-advert-price">₦2,500,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing2">
              <div class="qa-advert-title">Honda Accord 2013</div>
              <div class="qa-advert-price">₦5,350,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing3">
              <div class="qa-advert-title">Honda Accord 2005</div>
              <div class="qa-advert-price">₦2,800,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2004,
    };

    const result = await scrapeSource('jiji', property);

    expect(result.success).toBe(true);
    expect(result.yearFilterMetadata).toBeDefined();
    expect(result.yearFilterMetadata?.targetYear).toBe(2004);
    expect(result.yearFilterMetadata?.tolerance).toBe(1);
    expect(result.yearFilterMetadata?.totalListings).toBe(3);
    expect(result.yearFilterMetadata?.validListings).toBe(2);
    expect(result.yearFilterMetadata?.rejectedListings).toBe(1);
    expect(result.yearFilterMetadata?.yearMatchRate).toBeCloseTo(66.67, 1);
  });

  it('should include rejection reasons in metadata', async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Honda Accord 2004</div>
              <div class="qa-advert-price">₦2,500,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing2">
              <div class="qa-advert-title">Honda Accord 2013</div>
              <div class="qa-advert-price">₦5,350,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing3">
              <div class="qa-advert-title">Honda Accord - Clean</div>
              <div class="qa-advert-price">₦3,000,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2004,
    };

    const result = await scrapeSource('jiji', property);

    expect(result.success).toBe(true);
    expect(result.yearFilterMetadata?.rejectionReasons).toBeDefined();
    
    // Should have rejection reasons
    const reasons = result.yearFilterMetadata?.rejectionReasons || {};
    expect(Object.keys(reasons).length).toBeGreaterThan(0);
  });

  it.skip('should not apply year filtering when property has no year (requires query builder update)', async () => {
    // NOTE: Currently the query builder requires year for vehicles
    // This test is skipped until Requirement 1.3 is implemented
    // (query builder should proceed with make/model only when year is missing)
    
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Honda Accord 2004</div>
              <div class="qa-advert-price">₦2,500,000</div>
            </a>
          </div>
          <div class="qa-advert-list-item">
            <a href="/listing2">
              <div class="qa-advert-title">Honda Accord 2013</div>
              <div class="qa-advert-price">₦5,350,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    // Mock both robots.txt and HTML response
    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      // No year specified
    };

    const result = await scrapeSource('jiji', property);

    expect(result.success).toBe(true);
    
    // Should return all listings (no filtering)
    expect(result.prices).toHaveLength(2);
    
    // Should not have year filter metadata
    expect(result.yearFilterMetadata).toBeUndefined();
  });

  it('should handle empty results after year filtering', async () => {
    const mockHtml = `
      <html>
        <body>
          <div class="qa-advert-list-item">
            <a href="/listing1">
              <div class="qa-advert-title">Honda Accord 2015</div>
              <div class="qa-advert-price">₦8,500,000</div>
            </a>
          </div>
        </body>
      </html>
    `;

    mockedAxios.get
      .mockResolvedValueOnce({ data: '', status: 404 }) // robots.txt
      .mockResolvedValueOnce({ data: mockHtml, status: 200 }); // HTML

    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: 'Honda',
      model: 'Accord',
      year: 2004,
    };

    const result = await scrapeSource('jiji', property);

    expect(result.success).toBe(true);
    
    // 2015 is outside ±1 year of 2004, so should be rejected
    expect(result.prices).toHaveLength(0);
    
    // Should have metadata showing all were rejected
    expect(result.yearFilterMetadata?.totalListings).toBe(1);
    expect(result.yearFilterMetadata?.validListings).toBe(0);
    expect(result.yearFilterMetadata?.rejectedListings).toBe(1);
    expect(result.yearFilterMetadata?.yearMatchRate).toBe(0);
  });
});
