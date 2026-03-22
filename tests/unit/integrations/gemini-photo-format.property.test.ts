/**
 * Property-based tests for Gemini photo format validation
 * 
 * Feature: gemini-damage-detection-migration
 * Property 12: Photo Format Validation
 * 
 * **Validates: Requirements 12.5**
 * 
 * This property test verifies that:
 * - Supported formats (JPEG, PNG, WebP) are accepted
 * - Unsupported formats are rejected with descriptive error
 * - Runs with 100+ random format scenarios
 * 
 * Requirements: 12.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import type { Server } from 'http';
import * as fc from 'fast-check';

describe('Property 12: Photo Format Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockServer: Server;
  let serverPort: number;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up mock API key for tests (use real key from .env in actual tests)
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-mock-api-key-for-unit-tests';
    
    // Clear module cache to force re-initialization
    vi.resetModules();

    // Create a mock HTTP server to serve test images
    await new Promise<void>((resolve) => {
      mockServer = createServer((req, res) => {
        // Serve a minimal valid JPEG (1x1 red pixel)
        const jpegData = Buffer.from([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
          0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
          0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
          0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00,
          0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
          0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
          0x3F, 0x00, 0x7F, 0xFF, 0xD9
        ]);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(jpegData);
      });

      mockServer.listen(0, () => {
        const address = mockServer.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
          resolve();
        }
      });
    });
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    // Close mock server
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
  });

  it('Property 12: Supported formats (JPEG, PNG, WebP) are accepted', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Define supported formats
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];

    // Property: For any supported format, the photo should be accepted
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...supportedFormats),
        fc.integer({ min: 1, max: 3 }), // Number of photos
        async (format, photoCount) => {
          // Generate photo URLs with the format
          const imageUrls = Array(photoCount)
            .fill(null)
            .map((_, i) => `http://localhost:${serverPort}/photo${i}${format}`);
          
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Spy on console.error to check for format errors
          const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          
          // Act
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error: any) {
            // Expected to throw "not yet implemented" or other errors
            // But should NOT throw format validation error
            expect(error.message).not.toMatch(/Invalid image format/);
            expect(error.message).not.toMatch(/Supported formats/);
          }

          // Assert: No format validation errors should be logged
          const formatErrors = errorSpy.mock.calls.filter(call => 
            call[0].includes('Invalid image format')
          );
          expect(formatErrors.length).toBe(0);

          errorSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Unsupported formats are rejected with descriptive error', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Define unsupported formats
    const unsupportedFormats = ['.gif', '.bmp', '.tiff', '.tif', '.svg', '.ico', '.heic', '.raw'];

    // Property: For any unsupported format, the photo should be rejected with descriptive error
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...unsupportedFormats),
        async (format) => {
          // Generate photo URL with the unsupported format
          const imageUrls = [`http://localhost:${serverPort}/photo${format}`];
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Act & Assert
          await expect(
            assessDamageWithGemini(imageUrls, vehicleContext)
          ).rejects.toThrow(/Invalid image format/);

          await expect(
            assessDamageWithGemini(imageUrls, vehicleContext)
          ).rejects.toThrow(/Supported formats: JPEG, PNG, WebP/);

          // Verify error includes the URL
          await expect(
            assessDamageWithGemini(imageUrls, vehicleContext)
          ).rejects.toThrow(new RegExp(format.replace('.', '\\.')));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Format validation is case-insensitive', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: Format validation should work regardless of case
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('.jpg', '.jpeg', '.png', '.webp'),
        fc.constantFrom('lower', 'upper', 'mixed'),
        async (format, caseType) => {
          // Transform format based on case type
          let transformedFormat = format;
          if (caseType === 'upper') {
            transformedFormat = format.toUpperCase();
          } else if (caseType === 'mixed') {
            // Mix case: .JpG, .PnG, etc.
            transformedFormat = format
              .split('')
              .map((char, i) => (i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
              .join('');
          }

          const imageUrls = [`http://localhost:${serverPort}/photo${transformedFormat}`];
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Spy on console.error to check for format errors
          const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          
          // Act
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error: any) {
            // Expected to throw "not yet implemented" or other errors
            // But should NOT throw format validation error
            expect(error.message).not.toMatch(/Invalid image format/);
          }

          // Assert: No format validation errors should be logged
          const formatErrors = errorSpy.mock.calls.filter(call => 
            call[0].includes('Invalid image format')
          );
          expect(formatErrors.length).toBe(0);

          errorSpy.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 12: Format validation works with query parameters and fragments', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: Format validation should work even with query params and fragments
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('.jpg', '.jpeg', '.png', '.webp'),
        fc.boolean(), // Has query params
        fc.boolean(), // Has fragment
        async (format, hasQuery, hasFragment) => {
          let url = `http://localhost:${serverPort}/photo${format}`;
          
          if (hasQuery) {
            url += '?size=large&quality=high';
          }
          
          if (hasFragment) {
            url += '#section1';
          }

          const imageUrls = [url];
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Spy on console.error to check for format errors
          const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          
          // Act
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error: any) {
            // Expected to throw "not yet implemented" or other errors
            // But should NOT throw format validation error
            expect(error.message).not.toMatch(/Invalid image format/);
          }

          // Assert: No format validation errors should be logged
          const formatErrors = errorSpy.mock.calls.filter(call => 
            call[0].includes('Invalid image format')
          );
          expect(formatErrors.length).toBe(0);

          errorSpy.mockRestore();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 12: Mixed valid and invalid formats fail fast on first invalid', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: When mixing valid and invalid formats, should fail on first invalid
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // Number of valid photos before invalid
        fc.constantFrom('.gif', '.bmp', '.tiff', '.svg'),
        fc.integer({ min: 0, max: 2 }), // Number of photos after invalid
        async (validBefore, invalidFormat, photosAfter) => {
          // Build array: valid photos, then invalid, then more photos
          const imageUrls = [
            ...Array(validBefore).fill(`http://localhost:${serverPort}/photo.jpg`),
            `http://localhost:${serverPort}/invalid${invalidFormat}`,
            ...Array(photosAfter).fill(`http://localhost:${serverPort}/photo.png`),
          ];

          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Act & Assert
          await expect(
            assessDamageWithGemini(imageUrls, vehicleContext)
          ).rejects.toThrow(/Invalid image format/);

          // Verify error mentions the invalid format
          await expect(
            assessDamageWithGemini(imageUrls, vehicleContext)
          ).rejects.toThrow(new RegExp(invalidFormat.replace('.', '\\.')));
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 12: Error message quality for unsupported formats', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: Error messages should always be descriptive and helpful
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('.gif', '.bmp', '.tiff', '.svg', '.ico'),
        async (format) => {
          const imageUrls = [`http://localhost:${serverPort}/photo${format}`];
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Act
          let errorMessage = '';
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error: any) {
            errorMessage = error.message;
          }

          // Assert: Error message should contain all required information
          expect(errorMessage).toMatch(/Invalid image format/);
          expect(errorMessage).toMatch(/Supported formats: JPEG, PNG, WebP/);
          expect(errorMessage).toMatch(/Received URL:/);
          expect(errorMessage).toMatch(/Please provide images in one of the supported formats/);
          expect(errorMessage).toMatch(new RegExp(format.replace('.', '\\.')));
        }
      ),
      { numRuns: 50 }
    );
  });
});
