/**
 * Property-Based Tests for AI Damage Assessment
 * 
 * Property 9: AI Damage Assessment Completeness
 * Validates: Requirements 14.3-14.7
 * 
 * For any set of uploaded photos, the AI assessment should return:
 * - damage severity (minor/moderate/severe)
 * - confidence score (0-100)
 * - damage labels array
 * - estimated salvage value calculated as market value × (100 - damage percentage) / 100
 * - reserve price at 70% of estimated value
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the Google Cloud Vision client BEFORE importing the service
vi.mock('@google-cloud/vision', () => {
  const mockLabelDetection = vi.fn();
  return {
    ImageAnnotatorClient: class MockImageAnnotatorClient {
      labelDetection = mockLabelDetection;
      constructor() {}
    },
    mockLabelDetection, // Export for test access
  };
});

// Mock the Google Document AI client
vi.mock('@google-cloud/documentai', () => {
  return {
    DocumentProcessorServiceClient: class MockDocumentProcessorServiceClient {
      constructor() {}
    },
  };
});

// Import the service AFTER mocking
import { assessDamage } from '../../../src/features/cases/services/ai-assessment.service';

describe('Property 9: AI Damage Assessment Completeness', () => {
  let mockLabelDetection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get the mock function from the mocked module
    const visionModule = await import('@google-cloud/vision');
    mockLabelDetection = (visionModule as any).mockLabelDetection;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: All required fields must be present in assessment
   */
  it('should return all required fields for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random image URLs (1-10 images)
        fc.array(
          fc.webUrl({ withFragments: false, withQueryParameters: false }),
          { minLength: 1, maxLength: 10 }
        ),
        // Generate random market value (₦100k - ₦10M)
        fc.integer({ min: 100000, max: 10000000 }),
        // Generate random labels with confidence scores
        fc.array(
          fc.record({
            description: fc.oneof(
              fc.constant('damage'),
              fc.constant('broken'),
              fc.constant('crack'),
              fc.constant('dent'),
              fc.constant('vehicle'),
              fc.constant('car'),
              fc.constant('metal')
            ),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          // Mock the Vision API response
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          // Call the assessDamage function
          const result = await assessDamage(imageUrls, marketValue);

          // Verify all required fields are present
          expect(result).toBeDefined();
          expect(result).toHaveProperty('labels');
          expect(result).toHaveProperty('confidenceScore');
          expect(result).toHaveProperty('damagePercentage');
          expect(result).toHaveProperty('processedAt');
          expect(result).toHaveProperty('damageSeverity');
          expect(result).toHaveProperty('estimatedSalvageValue');
          expect(result).toHaveProperty('reservePrice');

          // Verify field types
          expect(Array.isArray(result.labels)).toBe(true);
          expect(typeof result.confidenceScore).toBe('number');
          expect(typeof result.damagePercentage).toBe('number');
          expect(result.processedAt).toBeInstanceOf(Date);
          expect(['minor', 'moderate', 'severe']).toContain(result.damageSeverity);
          expect(typeof result.estimatedSalvageValue).toBe('number');
          expect(typeof result.reservePrice).toBe('number');

          // Verify field constraints
          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(100);
          expect(result.damagePercentage).toBeGreaterThanOrEqual(0);
          expect(result.damagePercentage).toBeLessThanOrEqual(100);
          expect(result.estimatedSalvageValue).toBeGreaterThanOrEqual(0);
          expect(result.reservePrice).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 20 } // Run 20 random test cases
    );
  });

  /**
   * Property: Estimated salvage value calculation
   * estimatedSalvageValue = marketValue × (100 - damagePercentage) / 100
   */
  it('should calculate estimated salvage value correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string(),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const result = await assessDamage(imageUrls, marketValue);

          // Calculate expected salvage value
          const expectedSalvageValue =
            marketValue * ((100 - result.damagePercentage) / 100);

          // Allow small rounding differences (within 1%)
          const tolerance = expectedSalvageValue * 0.01;
          expect(result.estimatedSalvageValue).toBeGreaterThanOrEqual(
            expectedSalvageValue - tolerance
          );
          expect(result.estimatedSalvageValue).toBeLessThanOrEqual(
            expectedSalvageValue + tolerance
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Reserve price calculation
   * reservePrice = estimatedSalvageValue × 0.7
   */
  it('should calculate reserve price as 70% of estimated salvage value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string(),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const result = await assessDamage(imageUrls, marketValue);

          // Calculate expected reserve price
          const expectedReservePrice = result.estimatedSalvageValue * 0.7;

          // Allow small rounding differences (within 1%)
          const tolerance = expectedReservePrice * 0.01;
          expect(result.reservePrice).toBeGreaterThanOrEqual(
            expectedReservePrice - tolerance
          );
          expect(result.reservePrice).toBeLessThanOrEqual(
            expectedReservePrice + tolerance
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Damage severity mapping
   * Minor: 40-60% damage
   * Moderate: 60-80% damage
   * Severe: 80-95% damage
   */
  it('should map damage percentage to correct severity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string(),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const result = await assessDamage(imageUrls, marketValue);

          // Verify severity matches damage percentage
          if (result.damagePercentage >= 40 && result.damagePercentage <= 60) {
            expect(result.damageSeverity).toBe('minor');
          } else if (result.damagePercentage >= 60 && result.damagePercentage <= 80) {
            expect(result.damageSeverity).toBe('moderate');
          } else {
            expect(result.damageSeverity).toBe('severe');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Confidence score range
   * Confidence score must be between 0 and 100
   */
  it('should return confidence score within valid range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string(),
            score: fc.double({ min: 0, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const result = await assessDamage(imageUrls, marketValue);

          expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
          expect(result.confidenceScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Labels array is non-empty
   * At least one label should be returned
   */
  it('should return non-empty labels array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string({ minLength: 1 }),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const result = await assessDamage(imageUrls, marketValue);

          expect(result.labels.length).toBeGreaterThan(0);
          result.labels.forEach((label) => {
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: ProcessedAt timestamp is recent
   * The processedAt timestamp should be within the last minute
   */
  it('should set processedAt to current time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 100000, max: 10000000 }),
        fc.array(
          fc.record({
            description: fc.string(),
            score: fc.double({ min: 0.5, max: 1.0 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (imageUrls, marketValue, mockLabels) => {
          mockLabelDetection.mockResolvedValue([
            {
              labelAnnotations: mockLabels,
            },
          ]);

          const beforeTime = new Date();
          const result = await assessDamage(imageUrls, marketValue);
          const afterTime = new Date();

          expect(result.processedAt.getTime()).toBeGreaterThanOrEqual(
            beforeTime.getTime()
          );
          expect(result.processedAt.getTime()).toBeLessThanOrEqual(
            afterTime.getTime()
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Edge case: Empty image URLs should throw error
   */
  it('should throw error for empty image URLs', async () => {
    await expect(assessDamage([], 100000)).rejects.toThrow();
  });

  /**
   * Edge case: Zero market value
   */
  it('should handle zero market value', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: [
          { description: 'damage', score: 0.8 },
          { description: 'broken', score: 0.7 },
        ],
      },
    ]);

    const result = await assessDamage(['https://example.com/image.jpg'], 0);

    expect(result.estimatedSalvageValue).toBe(0);
    expect(result.reservePrice).toBe(0);
  });

  /**
   * Edge case: Very high market value
   */
  it('should handle very high market values', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: [
          { description: 'vehicle', score: 0.9 },
          { description: 'car', score: 0.85 },
        ],
      },
    ]);

    const highValue = 100000000; // ₦100M
    const result = await assessDamage(['https://example.com/image.jpg'], highValue);

    expect(result.estimatedSalvageValue).toBeLessThanOrEqual(highValue);
    expect(result.reservePrice).toBeLessThanOrEqual(result.estimatedSalvageValue);
  });

  /**
   * Error handling: Vision API failure
   */
  it('should throw error when Vision API fails', async () => {
    mockLabelDetection.mockRejectedValue(new Error('Vision API error'));

    await expect(
      assessDamage(['https://example.com/image.jpg'], 100000)
    ).rejects.toThrow('Failed to assess damage from images');
  });

  /**
   * Error handling: Invalid image URL
   */
  it('should handle invalid image URLs gracefully', async () => {
    mockLabelDetection.mockRejectedValue(new Error('Invalid image URL'));

    await expect(
      assessDamage(['not-a-valid-url'], 100000)
    ).rejects.toThrow('Failed to assess damage from images');
  });

  /**
   * Error handling: Empty label annotations
   */
  it('should handle empty label annotations', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: [],
      },
    ]);

    const result = await assessDamage(['https://example.com/image.jpg'], 100000);

    expect(result.labels).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.damagePercentage).toBeGreaterThanOrEqual(40);
  });

  /**
   * Error handling: Null label annotations
   */
  it('should handle null label annotations', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: null,
      },
    ]);

    const result = await assessDamage(['https://example.com/image.jpg'], 100000);

    expect(result.labels).toBeDefined();
    expect(Array.isArray(result.labels)).toBe(true);
  });

  /**
   * Error handling: Labels with missing scores
   */
  it('should filter out labels with invalid scores', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: [
          { description: 'damage', score: 0.8 },
          { description: 'broken', score: undefined },
          { description: 'crack', score: null },
          { description: 'dent', score: NaN },
          { description: 'vehicle', score: 0.9 },
        ],
      },
    ]);

    const result = await assessDamage(['https://example.com/image.jpg'], 100000);

    expect(result.labels).toBeDefined();
    expect(result.labels.length).toBeGreaterThan(0);
  });

  /**
   * Error handling: Multiple images with mixed results
   */
  it('should handle multiple images with varying label quality', async () => {
    let callCount = 0;
    mockLabelDetection.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return [{ labelAnnotations: [{ description: 'damage', score: 0.9 }] }];
      } else if (callCount === 2) {
        return [{ labelAnnotations: [] }];
      } else {
        return [{ labelAnnotations: [{ description: 'broken', score: 0.7 }] }];
      }
    });

    const result = await assessDamage(
      [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ],
      100000
    );

    expect(result.labels).toBeDefined();
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
  });

  /**
   * Error handling: Negative market value
   */
  it('should handle negative market value', async () => {
    mockLabelDetection.mockResolvedValue([
      {
        labelAnnotations: [
          { description: 'damage', score: 0.8 },
        ],
      },
    ]);

    const result = await assessDamage(['https://example.com/image.jpg'], -100000);

    // Negative market value should result in negative salvage value
    expect(result.estimatedSalvageValue).toBeLessThanOrEqual(0);
    expect(result.reservePrice).toBeLessThanOrEqual(0);
  });
});
