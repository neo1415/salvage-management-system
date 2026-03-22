/**
 * Property-based tests for Gemini photo count handling
 * 
 * Feature: gemini-damage-detection-migration
 * Property 6: Photo Count Handling
 * 
 * **Validates: Requirements 3.3, 12.1, 12.2, 12.3**
 * 
 * This property test verifies that:
 * - For 1-6 photos, all are included in request
 * - For >6 photos, only first 6 are processed and warning logged
 * - Runs with 100+ random photo count scenarios
 * 
 * Requirements: 3.3, 12.1, 12.2, 12.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import type { Server } from 'http';
import * as fc from 'fast-check';

describe('Property 6: Photo Count Handling', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockServer: Server;
  let serverPort: number;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up valid API key for tests
    process.env.GEMINI_API_KEY = 'AIzaSyD-bn93qeRCc3YsnmOOAw8TUu7hR9ObQNE';
    
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

  it('Property 6: For 1-6 photos, all are included in request', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: For any photo count from 1 to 6, all photos should be processed
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        async (photoCount) => {
          // Generate photo URLs
          const imageUrls = Array(photoCount).fill(`http://localhost:${serverPort}/photo.jpg`);
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Spy on console.info to verify photo conversion
          const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
          
          // Act
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error) {
            // Expected to throw "not yet implemented"
          }

          // Assert: All photos should be converted
          const conversionLogs = infoSpy.mock.calls.filter(call => 
            call[0].includes('Converted photo') && call[0].includes('to base64')
          );
          
          expect(conversionLogs.length).toBe(photoCount);
          
          // Verify each photo was logged
          for (let i = 1; i <= photoCount; i++) {
            expect(infoSpy).toHaveBeenCalledWith(
              expect.stringContaining(`Converted photo ${i}/${photoCount} to base64`)
            );
          }

          // Verify success log shows correct count
          expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Successfully converted ${photoCount} photos to base64`)
          );

          infoSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: For >6 photos, only first 6 are processed and warning logged', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: For any photo count > 6, only first 6 should be processed
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 7, max: 20 }),
        async (photoCount) => {
          // Generate photo URLs
          const imageUrls = Array(photoCount).fill(`http://localhost:${serverPort}/photo.jpg`);
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          // Spy on console.warn to verify warning is logged
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
          
          // Spy on console.info to verify photo conversion
          const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
          
          // Act
          try {
            await assessDamageWithGemini(imageUrls, vehicleContext);
          } catch (error) {
            // Expected to throw "not yet implemented"
          }

          // Assert: Warning should be logged
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Received ${photoCount} photos, but maximum is 6`)
          );
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Processing first 6 photos only')
          );

          // Assert: Only 6 photos should be converted
          const conversionLogs = infoSpy.mock.calls.filter(call => 
            call[0].includes('Converted photo') && call[0].includes('to base64')
          );
          
          expect(conversionLogs.length).toBe(6);

          // Verify success log shows only 6 photos
          expect(infoSpy).toHaveBeenCalledWith(
            expect.stringContaining('Successfully converted 6 photos to base64')
          );

          warnSpy.mockRestore();
          infoSpy.mockRestore();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Photo count boundary conditions (exactly 6 and exactly 7)', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Test exactly 6 photos (boundary - should not warn)
    const sixPhotos = Array(6).fill(`http://localhost:${serverPort}/photo.jpg`);
    const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

    const warnSpy6 = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy6 = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    try {
      await assessDamageWithGemini(sixPhotos, vehicleContext);
    } catch (error) {
      // Expected to throw "not yet implemented"
    }

    // Assert: No warning for exactly 6 photos
    const warningCalls6 = warnSpy6.mock.calls.filter(call => 
      call[0].includes('Received') && call[0].includes('photos, but maximum is 6')
    );
    expect(warningCalls6.length).toBe(0);

    // Assert: All 6 photos converted
    expect(infoSpy6).toHaveBeenCalledWith(
      expect.stringContaining('Successfully converted 6 photos to base64')
    );

    warnSpy6.mockRestore();
    infoSpy6.mockRestore();

    // Test exactly 7 photos (boundary - should warn)
    const sevenPhotos = Array(7).fill(`http://localhost:${serverPort}/photo.jpg`);

    const warnSpy7 = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy7 = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    try {
      await assessDamageWithGemini(sevenPhotos, vehicleContext);
    } catch (error) {
      // Expected to throw "not yet implemented"
    }

    // Assert: Warning for 7 photos
    expect(warnSpy7).toHaveBeenCalledWith(
      expect.stringContaining('Received 7 photos, but maximum is 6')
    );

    // Assert: Only 6 photos converted
    expect(infoSpy7).toHaveBeenCalledWith(
      expect.stringContaining('Successfully converted 6 photos to base64')
    );

    warnSpy7.mockRestore();
    infoSpy7.mockRestore();
  });

  it('Property 6: Photo count consistency across multiple requests', async () => {
    // Arrange
    const { initializeGeminiService, assessDamageWithGemini } = await import(
      '../../../src/lib/integrations/gemini-damage-detection'
    );
    await initializeGeminiService();

    // Property: Photo count handling should be consistent across multiple requests
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 15 }), { minLength: 5, maxLength: 10 }),
        async (photoCounts) => {
          const vehicleContext = { make: 'Toyota', model: 'Camry', year: 2021 };

          for (const photoCount of photoCounts) {
            const imageUrls = Array(photoCount).fill(`http://localhost:${serverPort}/photo.jpg`);

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            
            try {
              await assessDamageWithGemini(imageUrls, vehicleContext);
            } catch (error) {
              // Expected to throw "not yet implemented"
            }

            // Assert: Behavior is consistent
            if (photoCount <= 6) {
              // Should not warn
              const warningCalls = warnSpy.mock.calls.filter(call => 
                call[0].includes('Received') && call[0].includes('photos, but maximum is 6')
              );
              expect(warningCalls.length).toBe(0);

              // Should convert all photos
              expect(infoSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully converted ${photoCount} photos to base64`)
              );
            } else {
              // Should warn
              expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Received ${photoCount} photos, but maximum is 6`)
              );

              // Should convert only 6 photos
              expect(infoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Successfully converted 6 photos to base64')
              );
            }

            warnSpy.mockRestore();
            infoSpy.mockRestore();
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
