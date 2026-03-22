/**
 * Unit tests for Gemini photo handling and conversion
 * 
 * Tests Task 6.2 requirements:
 * - Test with 1 photo (minimum valid input)
 * - Test with 6 photos (maximum per request)
 * - Test with 10 photos (should process first 6 and log warning)
 * - Test with 0 photos (should return error)
 * - Test with invalid image format (should return descriptive error)
 * - Test with corrupted image files
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.5, 13.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import type { Server } from 'http';

describe('Gemini Photo Handling', () => {
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
        const url = req.url || '';
        
        if (url.includes('/valid-photo.jpg')) {
          // Serve a valid JPEG (1x1 red pixel)
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
        } else if (url.includes('/valid-photo.png')) {
          // Serve a valid PNG (1x1 red pixel)
          const pngData = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
            0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
            0x44, 0xAE, 0x42, 0x60, 0x82
          ]);
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(pngData);
        } else if (url.includes('/valid-photo.webp')) {
          // Serve a minimal valid WebP
          const webpData = Buffer.from([
            0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
            0x0E, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9D,
            0x01, 0x2A, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
            0x00, 0x00
          ]);
          res.writeHead(200, { 'Content-Type': 'image/webp' });
          res.end(webpData);
        } else if (url.includes('/invalid-format.gif')) {
          // Serve a GIF (unsupported format)
          res.writeHead(200, { 'Content-Type': 'image/gif' });
          res.end(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));
        } else if (url.includes('/corrupted.jpg')) {
          // Serve corrupted data
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(Buffer.from([0x00, 0x00, 0x00, 0x00]));
        } else if (url.includes('/not-found.jpg')) {
          // Serve 404
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
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

  describe('Photo Count Handling', () => {
    it('should accept 1 photo (minimum valid input)', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/valid-photo.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Note: Will throw "not yet implemented" error, but should not fail on photo count
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should accept 6 photos (maximum per request)', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = Array(6).fill(`http://localhost:${serverPort}/valid-photo.jpg`);
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Note: Will throw "not yet implemented" error, but should not fail on photo count
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should process first 6 photos when 10 photos provided', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = Array(10).fill(`http://localhost:${serverPort}/valid-photo.jpg`);
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Spy on console.warn to verify warning is logged
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Act
      try {
        await assessDamageWithGemini(imageUrls, vehicleContext);
      } catch (error) {
        // Expected to throw "not yet implemented"
      }
      
      // Assert
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received 10 photos, but maximum is 6')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing first 6 photos only')
      );
      
      warnSpy.mockRestore();
    });

    it('should return error with 0 photos', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls: string[] = [];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/At least one image URL is required/);
    });
  });

  describe('Image Format Validation', () => {
    it('should accept JPEG format', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/valid-photo.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Should not throw format validation error (will throw "not yet implemented")
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should accept PNG format', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/valid-photo.png`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Should not throw format validation error (will throw "not yet implemented")
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should accept WebP format', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/valid-photo.webp`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Should not throw format validation error (will throw "not yet implemented")
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should reject invalid image format with descriptive error', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/invalid-format.gif`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Invalid image format/);
      
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Supported formats: JPEG, PNG, WebP/);
    });

    it('should include URL in format error message', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/invalid-format.gif`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/invalid-format\.gif/);
    });

    it('should reject unsupported formats (BMP)', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/photo.bmp`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Invalid image format/);
    });

    it('should reject unsupported formats (TIFF)', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/photo.tiff`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Invalid image format/);
    });
  });

  describe('Corrupted Image Handling', () => {
    it('should handle corrupted image files gracefully', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/corrupted.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Should not throw format validation error (format is valid, content is corrupted)
      // Will throw "not yet implemented" or conversion error
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/not-found.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Failed to fetch image/);
    });

    it('should include error context in conversion failures', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/not-found.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Failed to convert image to base64/);
    });
  });

  describe('Mixed Photo Scenarios', () => {
    it('should handle mix of valid formats', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [
        `http://localhost:${serverPort}/valid-photo.jpg`,
        `http://localhost:${serverPort}/valid-photo.png`,
        `http://localhost:${serverPort}/valid-photo.webp`,
      ];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      // Should not throw format validation error (will throw "not yet implemented")
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/not yet implemented/);
    });

    it('should fail fast on first invalid format in batch', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [
        `http://localhost:${serverPort}/valid-photo.jpg`,
        `http://localhost:${serverPort}/invalid-format.gif`,
        `http://localhost:${serverPort}/valid-photo.png`,
      ];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Act & Assert
      await expect(
        assessDamageWithGemini(imageUrls, vehicleContext)
      ).rejects.toThrow(/Invalid image format/);
    });
  });

  describe('Logging', () => {
    it('should log photo conversion progress', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [
        `http://localhost:${serverPort}/valid-photo.jpg`,
        `http://localhost:${serverPort}/valid-photo.png`,
      ];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Spy on console.info
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      // Act
      try {
        await assessDamageWithGemini(imageUrls, vehicleContext);
      } catch (error) {
        // Expected to throw "not yet implemented"
      }
      
      // Assert
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Converted photo 1/2 to base64')
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Converted photo 2/2 to base64')
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully converted 2 photos to base64')
      );
      
      infoSpy.mockRestore();
    });

    it('should log MIME types during conversion', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/valid-photo.png`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Spy on console.info
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      // Act
      try {
        await assessDamageWithGemini(imageUrls, vehicleContext);
      } catch (error) {
        // Expected to throw "not yet implemented"
      }
      
      // Assert
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Format: image/png')
      );
      
      infoSpy.mockRestore();
    });

    it('should log conversion errors with context', async () => {
      // Arrange
      const { initializeGeminiService, assessDamageWithGemini } = await import(
        '../../../src/lib/integrations/gemini-damage-detection'
      );
      await initializeGeminiService();
      
      const imageUrls = [`http://localhost:${serverPort}/not-found.jpg`];
      const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };
      
      // Spy on console.error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      try {
        await assessDamageWithGemini(imageUrls, vehicleContext);
      } catch (error) {
        // Expected to throw
      }
      
      // Assert
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to convert photo 1/1')
      );
      
      errorSpy.mockRestore();
    });
  });
});
