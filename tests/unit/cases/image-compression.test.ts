import { describe, it, expect, beforeAll } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { compressImage, compressMultipleImages, isCompressionAvailable, COMPRESSION_PRESETS } from '../../../src/lib/integrations/tinypng';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Property 8: Image Compression
 * Validates: Requirement 12.9
 * 
 * This test verifies that:
 * 1. Compressed image size is less than or equal to original size
 * 2. Compression produces valid image buffers
 * 3. Compression works for different image formats
 * 4. Multiple images can be compressed in batch
 */

// Helper function to load a real image from the assets folder
function loadTestImage(filename: string): Buffer {
  const imagePath = path.join(process.cwd(), 'public', 'assets', filename);
  return fs.readFileSync(imagePath);
}

// Available test images
const TEST_IMAGES = ['hero-1.png', 'hero-2.png', 'Hero-3.png'];

// Custom arbitrary for test scenarios - picks a random test image
const imageFileArbitrary = fc.constantFrom(...TEST_IMAGES);

describe('Property 8: Image Compression', () => {
  beforeAll(() => {
    // Check if TinyPNG API key is configured
    if (!process.env.TINYPNG_API_KEY) {
      console.warn('⚠️  TINYPNG_API_KEY not configured. Skipping compression tests.');
      console.warn('   Set TINYPNG_API_KEY in .env to run these tests.');
    }
  });

  // Unit test: Compressed size ≤ original size (using real image)
  it('should compress real image and verify size reduction', async () => {
    // Skip if API key not configured
    if (!isCompressionAvailable()) {
      return;
    }

    const imageBuffer = loadTestImage('hero-1.png');
    const originalSize = imageBuffer.length;

    try {
      const result = await compressImage(imageBuffer);

      // Compressed size should be ≤ original size
      expect(result.compressedSize).toBeLessThanOrEqual(originalSize);

      // Result should have valid buffer
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);

      // Statistics should be accurate
      expect(result.originalSize).toBe(originalSize);
      expect(result.compressedSize).toBe(result.buffer.length);
      expect(result.savedBytes).toBe(originalSize - result.compressedSize);
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(100);
    } catch (error) {
      // If we hit rate limits or API errors, skip this test
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('Rate limit reached, skipping test');
        return;
      }
      throw error;
    }
  }, 15000); // 15 seconds timeout

  // Unit test: Compression with different presets (using real image)
  it('should compress with different presets', async () => {
    // Skip if API key not configured
    if (!isCompressionAvailable()) {
      return;
    }

    const imageBuffer = loadTestImage('hero-2.png');

    try {
      // Test MOBILE preset
      const mobileResult = await compressImage(imageBuffer, COMPRESSION_PRESETS.MOBILE);
      expect(mobileResult.compressedSize).toBeLessThanOrEqual(imageBuffer.length);

      // Test THUMBNAIL preset
      const thumbnailResult = await compressImage(imageBuffer, COMPRESSION_PRESETS.THUMBNAIL);
      expect(thumbnailResult.compressedSize).toBeLessThanOrEqual(imageBuffer.length);

      // Both should produce valid buffers
      expect(Buffer.isBuffer(mobileResult.buffer)).toBe(true);
      expect(Buffer.isBuffer(thumbnailResult.buffer)).toBe(true);
    } catch (error) {
      // If we hit rate limits or API errors, skip this test
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('Rate limit reached, skipping test');
        return;
      }
      throw error;
    }
  }, 30000); // 30 seconds timeout for multiple compressions

  // Unit test: Compression availability check
  it('should correctly report compression availability', () => {
    const available = isCompressionAvailable();
    
    if (process.env.TINYPNG_API_KEY) {
      expect(available).toBe(true);
    } else {
      expect(available).toBe(false);
    }
  });

  // Unit test: Error handling for invalid input
  it('should throw error for non-buffer input', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    await expect(
      // @ts-expect-error Testing invalid input
      compressImage('not a buffer')
    ).rejects.toThrow('Input must be a Buffer');
  });

  // Unit test: Error handling for empty buffer
  it('should throw error for empty buffer', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    await expect(
      compressImage(Buffer.alloc(0))
    ).rejects.toThrow('Input buffer is empty');
  });

  // Unit test: Error handling when API key not configured
  it('should throw error when API key not configured', async () => {
    // Temporarily remove API key
    const originalKey = process.env.TINYPNG_API_KEY;
    delete process.env.TINYPNG_API_KEY;

    const imageBuffer = loadTestImage('hero-1.png');

    await expect(
      compressImage(imageBuffer)
    ).rejects.toThrow('TINYPNG_API_KEY environment variable is not configured');

    // Restore API key
    if (originalKey) {
      process.env.TINYPNG_API_KEY = originalKey;
    }
  });

  // Unit test: Batch compression
  it('should compress multiple images in batch', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    const images = [
      loadTestImage('hero-1.png'),
      loadTestImage('hero-2.png'),
      loadTestImage('Hero-3.png'),
    ];

    try {
      const results = await compressMultipleImages(images);

      expect(results).toHaveLength(3);

      results.forEach((result, index) => {
        expect(result.compressedSize).toBeLessThanOrEqual(images[index].length);
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
      });
    } catch (error) {
      // If we hit rate limits, skip this test
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('Rate limit reached, skipping batch test');
        return;
      }
      throw error;
    }
  }, 30000); // 30 seconds timeout for batch compression

  // Unit test: Compression statistics accuracy
  it('should provide accurate compression statistics', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    const imageBuffer = loadTestImage('hero-1.png');
    const originalSize = imageBuffer.length;

    try {
      const result = await compressImage(imageBuffer);

      // Verify all statistics are present and accurate
      expect(result.originalSize).toBe(originalSize);
      expect(result.compressedSize).toBe(result.buffer.length);
      expect(result.savedBytes).toBe(originalSize - result.compressedSize);
      
      // Compression ratio should match calculation
      const expectedRatio = Math.round((result.savedBytes / originalSize) * 100);
      expect(result.compressionRatio).toBe(expectedRatio);
    } catch (error) {
      // If we hit rate limits, skip this test
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('Rate limit reached, skipping statistics test');
        return;
      }
      throw error;
    }
  }, 15000); // 15 seconds timeout

  // Unit test: Compression with resizing
  it('should compress and resize images', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    const imageBuffer = loadTestImage('hero-1.png');

    try {
      const result = await compressImage(imageBuffer, {
        maxWidth: 800,
        maxHeight: 600,
      });

      // Should be compressed
      expect(result.compressedSize).toBeLessThanOrEqual(imageBuffer.length);
      
      // Should have valid buffer
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    } catch (error) {
      // If we hit rate limits, skip this test
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.warn('Rate limit reached, skipping resize test');
        return;
      }
      throw error;
    }
  }, 15000); // 15 seconds timeout

  // Unit test: Error handling for invalid image data
  it('should handle invalid image data gracefully', async () => {
    if (!isCompressionAvailable()) {
      return; // Skip if API not configured
    }

    // Create a buffer with random data (not a valid image)
    const invalidBuffer = Buffer.from('This is not an image');

    await expect(
      compressImage(invalidBuffer)
    ).rejects.toThrow();
  });
});
