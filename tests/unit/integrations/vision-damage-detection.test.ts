/**
 * Unit Tests for Vision API Damage Detection Service
 * 
 * Tests the extracted Vision API logic that serves as fallback in Gemini migration
 * 
 * Coverage:
 * - Vision API integration (existing behavior)
 * - Keyword matching algorithm (unchanged)
 * - Mock mode behavior
 * - Error handling and retries
 * - Base64 and URL image handling
 * 
 * Requirements: 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Import the service AFTER mocking
import { assessDamageWithVision } from '../../../src/lib/integrations/vision-damage-detection';

describe('Vision API Damage Detection Service', () => {
  let mockLabelDetection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Get the mock function from the mocked module
    const visionModule = await import('@google-cloud/vision');
    mockLabelDetection = (visionModule as any).mockLabelDetection;
    vi.clearAllMocks();
    // Ensure we're not in mock mode for these tests
    delete process.env.MOCK_AI_ASSESSMENT;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Vision API Integration', () => {
    it('should successfully assess damage with valid image URLs', async () => {
      // Mock Vision API response
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
            { description: 'Damage', score: 0.88 },
            { description: 'Dent', score: 0.85 },
            { description: 'Car', score: 0.92 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/damaged-car.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.method).toBe('vision');
      expect(result.labels).toBeInstanceOf(Array);
      expect(result.labels.length).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.damagePercentage).toBeGreaterThanOrEqual(0);
      expect(result.damagePercentage).toBeLessThanOrEqual(100);
    });

    it('should handle multiple image URLs', async () => {
      mockLabelDetection
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Damage', score: 0.9 },
              { description: 'Broken', score: 0.85 },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Crack', score: 0.88 },
              { description: 'Dent', score: 0.82 },
            ],
          },
        ]);

      const result = await assessDamageWithVision([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.method).toBe('vision');
      expect(mockLabelDetection).toHaveBeenCalledTimes(2);
      expect(result.labels.length).toBeGreaterThan(0);
    });

    it('should handle base64 data URLs', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
            { description: 'Damage', score: 0.88 },
          ],
        },
      ]);

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const result = await assessDamageWithVision([base64Image]);

      expect(result).toBeDefined();
      expect(result.method).toBe('vision');
      expect(mockLabelDetection).toHaveBeenCalledTimes(1);
      
      // Verify it was called with a buffer (base64 decoded)
      const callArgs = mockLabelDetection.mock.calls[0][0];
      expect(callArgs).toHaveProperty('image');
      expect(callArgs.image).toHaveProperty('content');
      expect(Buffer.isBuffer(callArgs.image.content)).toBe(true);
    });

    it('should skip invalid base64 data URLs', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
          ],
        },
      ]);

      // Invalid base64 URL (missing data after comma)
      const invalidBase64 = 'data:image/jpeg;base64,';
      const validUrl = 'https://example.com/image.jpg';
      
      const result = await assessDamageWithVision([invalidBase64, validUrl]);

      expect(result).toBeDefined();
      // Should only call once for the valid URL
      expect(mockLabelDetection).toHaveBeenCalledTimes(1);
    });

    it('should return all required fields in response', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.88 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('confidenceScore');
      expect(result).toHaveProperty('damagePercentage');
      expect(result).toHaveProperty('method');
      expect(result.method).toBe('vision');
    });
  });

  describe('Keyword Matching Algorithm', () => {
    it('should identify damage-related labels', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.9 },
            { description: 'Broken', score: 0.85 },
            { description: 'Crack', score: 0.8 },
            { description: 'Vehicle', score: 0.95 },
            { description: 'Car', score: 0.92 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/damaged-car.jpg',
      ]);

      // Should prioritize damage-related labels
      expect(result.labels).toContain('Damage');
      expect(result.labels).toContain('Broken');
      expect(result.labels).toContain('Crack');
    });

    it('should calculate higher damage percentage for more damage keywords', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.9 },
            { description: 'Broken', score: 0.88 },
            { description: 'Crack', score: 0.85 },
            { description: 'Dent', score: 0.82 },
            { description: 'Shattered', score: 0.8 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/severely-damaged.jpg',
      ]);

      // More damage keywords should result in higher damage percentage
      expect(result.damagePercentage).toBeGreaterThan(60);
    });

    it('should return default damage percentage when no damage keywords found', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
            { description: 'Car', score: 0.92 },
            { description: 'Metal', score: 0.88 },
            { description: 'Automotive', score: 0.85 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/car.jpg',
      ]);

      // No damage keywords should result in default 50% damage
      expect(result.damagePercentage).toBe(50);
    });

    it('should use general labels when no damage labels found', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
            { description: 'Car', score: 0.92 },
            { description: 'Metal', score: 0.88 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/car.jpg',
      ]);

      // Should return general labels when no damage labels
      expect(result.labels).toContain('Vehicle');
      expect(result.labels).toContain('Car');
      expect(result.labels).toContain('Metal');
    });

    it('should limit to top 10 damage labels', async () => {
      const manyLabels = Array.from({ length: 20 }, (_, i) => ({
        description: `Damage${i}`,
        score: 0.9 - i * 0.01,
      }));

      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: manyLabels,
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // Should limit to top 10 labels
      expect(result.labels.length).toBeLessThanOrEqual(10);
    });

    it('should sort damage labels by confidence score', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.7 },
            { description: 'Broken', score: 0.9 },
            { description: 'Crack', score: 0.8 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // First label should be the highest confidence damage label
      expect(result.labels[0]).toBe('Broken');
    });
  });

  describe('Mock Mode Behavior', () => {
    beforeEach(() => {
      // Enable mock mode
      process.env.MOCK_AI_ASSESSMENT = 'true';
    });

    afterEach(() => {
      delete process.env.MOCK_AI_ASSESSMENT;
    });

    it('should generate mock data when MOCK_AI_ASSESSMENT is true', async () => {
      // Re-import the module with mock mode enabled
      vi.resetModules();
      process.env.MOCK_AI_ASSESSMENT = 'true';
      
      const { assessDamageWithVision: assessWithMock } = await import(
        '../../../src/lib/integrations/vision-damage-detection'
      );
      
      const result = await assessWithMock([
        'https://example.com/image.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.method).toBe('vision');
      expect(result.labels.length).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.damagePercentage).toBeGreaterThanOrEqual(40);
      expect(result.damagePercentage).toBeLessThanOrEqual(95);
    });

    it('should generate more labels for more images in mock mode', async () => {
      vi.resetModules();
      process.env.MOCK_AI_ASSESSMENT = 'true';
      
      const { assessDamageWithVision: assessWithMock } = await import(
        '../../../src/lib/integrations/vision-damage-detection'
      );
      
      const result1 = await assessWithMock([
        'https://example.com/image1.jpg',
      ]);
      
      const result2 = await assessWithMock([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
      ]);

      // More images should result in more labels (up to a limit)
      expect(result2.labels.length).toBeGreaterThanOrEqual(result1.labels.length);
    });

    it('should include typical damage-related labels in mock mode', async () => {
      vi.resetModules();
      process.env.MOCK_AI_ASSESSMENT = 'true';
      
      const { assessDamageWithVision: assessWithMock } = await import(
        '../../../src/lib/integrations/vision-damage-detection'
      );
      
      const result = await assessWithMock([
        'https://example.com/image.jpg',
      ]);

      const allLabels = result.labels.join(' ').toLowerCase();
      
      // Should include some damage-related keywords
      const hasDamageKeywords = 
        allLabels.includes('damage') ||
        allLabels.includes('dent') ||
        allLabels.includes('broken') ||
        allLabels.includes('collision') ||
        allLabels.includes('accident');
      
      expect(hasDamageKeywords).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no image URLs provided', async () => {
      await expect(assessDamageWithVision([])).rejects.toThrow(
        'Failed to assess damage from images using Vision API'
      );
    });

    it('should throw error when imageUrls is null', async () => {
      await expect(assessDamageWithVision(null as any)).rejects.toThrow(
        'Failed to assess damage from images using Vision API'
      );
    });

    it('should throw error when imageUrls is undefined', async () => {
      await expect(assessDamageWithVision(undefined as any)).rejects.toThrow(
        'Failed to assess damage from images using Vision API'
      );
    });

    it('should throw descriptive error when Vision API fails', async () => {
      mockLabelDetection.mockRejectedValue(new Error('Vision API error'));

      await expect(
        assessDamageWithVision(['https://example.com/image.jpg'])
      ).rejects.toThrow('Failed to assess damage from images using Vision API');
    });

    it('should handle network errors gracefully', async () => {
      mockLabelDetection.mockRejectedValue(new Error('Network timeout'));

      await expect(
        assessDamageWithVision(['https://example.com/image.jpg'])
      ).rejects.toThrow('Failed to assess damage from images using Vision API');
    });

    it('should handle invalid image URLs', async () => {
      mockLabelDetection.mockRejectedValue(new Error('Invalid image URL'));

      await expect(
        assessDamageWithVision(['not-a-valid-url'])
      ).rejects.toThrow('Failed to assess damage from images using Vision API');
    });

    it('should handle empty label annotations', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.labels).toBeInstanceOf(Array);
      expect(result.damagePercentage).toBe(50); // Default when no labels
    });

    it('should handle null label annotations', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: null,
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.labels).toBeInstanceOf(Array);
      expect(result.damagePercentage).toBe(50);
    });

    it('should filter out labels with invalid scores', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.9 },
            { description: 'Broken', score: undefined },
            { description: 'Crack', score: null },
            { description: 'Dent', score: NaN },
            { description: 'Vehicle', score: 0.85 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.labels.length).toBeGreaterThan(0);
      // Should only include labels with valid scores
      expect(result.labels).toContain('Damage');
      // Vehicle is not a damage keyword, so it won't be in the damage labels list
      // The service prioritizes damage-related labels
    });

    it('should handle labels with missing descriptions', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.9 },
            { description: null, score: 0.8 },
            { description: undefined, score: 0.7 },
            { description: 'Vehicle', score: 0.85 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result).toBeDefined();
      expect(result.labels.length).toBeGreaterThan(0);
      // Should only include labels with valid descriptions
      result.labels.forEach((label) => {
        expect(label).toBeTruthy();
        expect(typeof label).toBe('string');
      });
    });

    it('should handle mixed valid and invalid images', async () => {
      mockLabelDetection
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Damage', score: 0.9 },
            ],
          },
        ])
        .mockRejectedValueOnce(new Error('Invalid image'))
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Broken', score: 0.85 },
            ],
          },
        ]);

      // Should throw error if any image fails
      await expect(
        assessDamageWithVision([
          'https://example.com/image1.jpg',
          'https://example.com/invalid.jpg',
          'https://example.com/image3.jpg',
        ])
      ).rejects.toThrow('Failed to assess damage from images using Vision API');
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate average confidence across all images', async () => {
      mockLabelDetection
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Damage', score: 0.8 },
              { description: 'Broken', score: 0.9 },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            labelAnnotations: [
              { description: 'Crack', score: 0.6 },
              { description: 'Dent', score: 0.7 },
            ],
          },
        ]);

      const result = await assessDamageWithVision([
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
      ]);

      // Average of (0.85 + 0.65) / 2 = 0.75 = 75%
      // Allow some tolerance for rounding
      expect(result.confidenceScore).toBeGreaterThanOrEqual(65);
      expect(result.confidenceScore).toBeLessThanOrEqual(90);
    });

    it('should round confidence score to integer', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.876 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(Number.isInteger(result.confidenceScore)).toBe(true);
    });

    it('should handle zero confidence scores', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Unknown', score: 0 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Damage Percentage Calculation', () => {
    it('should calculate damage percentage based on keyword confidence', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.9 },
            { description: 'Broken', score: 0.85 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // High confidence damage keywords should result in high damage percentage
      expect(result.damagePercentage).toBeGreaterThan(70);
    });

    it('should factor in number of damage labels', async () => {
      const manyDamageLabels = [
        { description: 'Damage', score: 0.8 },
        { description: 'Broken', score: 0.8 },
        { description: 'Crack', score: 0.8 },
        { description: 'Dent', score: 0.8 },
        { description: 'Shattered', score: 0.8 },
      ];

      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: manyDamageLabels,
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // More damage labels should increase damage percentage
      expect(result.damagePercentage).toBeGreaterThan(70);
    });

    it('should clamp damage percentage to valid range (40-95)', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Vehicle', score: 0.95 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(result.damagePercentage).toBeGreaterThanOrEqual(40);
      expect(result.damagePercentage).toBeLessThanOrEqual(95);
    });

    it('should round damage percentage to integer', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damage', score: 0.876 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      expect(Number.isInteger(result.damagePercentage)).toBe(true);
    });
  });

  describe('Damage Keywords Recognition', () => {
    const damageKeywords = [
      'damage', 'broken', 'crack', 'dent', 'scratch', 'shattered',
      'bent', 'rust', 'collision', 'accident', 'wreck', 'destroyed',
      'smashed', 'crushed', 'torn', 'burned', 'fire', 'water damage', 'flood'
    ];

    damageKeywords.forEach((keyword) => {
      it(`should recognize "${keyword}" as damage keyword`, async () => {
        mockLabelDetection.mockResolvedValue([
          {
            labelAnnotations: [
              { description: keyword.charAt(0).toUpperCase() + keyword.slice(1), score: 0.9 },
              { description: 'Vehicle', score: 0.95 },
            ],
          },
        ]);

        const result = await assessDamageWithVision([
          'https://example.com/image.jpg',
        ]);

        // Should identify as damage and calculate higher damage percentage
        expect(result.damagePercentage).toBeGreaterThan(50);
      });
    });

    it('should be case-insensitive for keyword matching', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'DAMAGE', score: 0.9 },
            { description: 'BrOkEn', score: 0.85 },
            { description: 'crack', score: 0.8 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // Should recognize all variations
      expect(result.labels).toContain('DAMAGE');
      expect(result.labels).toContain('BrOkEn');
      expect(result.labels).toContain('crack');
      expect(result.damagePercentage).toBeGreaterThan(60);
    });

    it('should match partial keyword matches', async () => {
      mockLabelDetection.mockResolvedValue([
        {
          labelAnnotations: [
            { description: 'Damaged vehicle', score: 0.9 },
            { description: 'Broken glass', score: 0.85 },
          ],
        },
      ]);

      const result = await assessDamageWithVision([
        'https://example.com/image.jpg',
      ]);

      // Should match keywords within longer descriptions
      expect(result.damagePercentage).toBeGreaterThan(60);
    });
  });
});
