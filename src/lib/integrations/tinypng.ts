/**
 * TinyPNG Image Compression Service
 * 
 * Provides image compression capabilities using TinyPNG API to reduce
 * file sizes for mobile data savings while maintaining visual quality.
 * 
 * Features:
 * - Automatic image compression before upload
 * - Lossy compression optimized for mobile
 * - Support for JPEG, PNG, and WebP formats
 * - Preserves image metadata
 * - Reduces file sizes by 50-80% on average
 * 
 * Requirements: 12.9, Enterprise Standards Section 14.2
 */

import tinify from 'tinify';

// Configure TinyPNG API key
if (process.env.TINYPNG_API_KEY) {
  tinify.key = process.env.TINYPNG_API_KEY;
}

/**
 * Compression options interface
 */
export interface CompressionOptions {
  /**
   * Maximum width in pixels (optional)
   * If provided, image will be resized to fit within this width while maintaining aspect ratio
   */
  maxWidth?: number;
  
  /**
   * Maximum height in pixels (optional)
   * If provided, image will be resized to fit within this height while maintaining aspect ratio
   */
  maxHeight?: number;
  
  /**
   * Whether to preserve metadata (EXIF, IPTC, XMP)
   * Default: false (removes metadata to reduce file size)
   */
  preserveMetadata?: boolean;
}

/**
 * Compression result interface
 */
export interface CompressionResult {
  /**
   * Compressed image buffer
   */
  buffer: Buffer;
  
  /**
   * Original file size in bytes
   */
  originalSize: number;
  
  /**
   * Compressed file size in bytes
   */
  compressedSize: number;
  
  /**
   * Compression ratio as percentage (0-100)
   * Higher percentage means more compression
   */
  compressionRatio: number;
  
  /**
   * File size reduction in bytes
   */
  savedBytes: number;
}

/**
 * Compress an image using TinyPNG API
 * 
 * This function reduces image file size while maintaining visual quality,
 * optimized for mobile data savings. Supports JPEG, PNG, and WebP formats.
 * 
 * @param imageBuffer - Input image as Buffer
 * @param options - Compression options (optional)
 * @returns Compression result with compressed buffer and statistics
 * 
 * @throws Error if TinyPNG API key is not configured
 * @throws Error if compression fails
 * 
 * @example
 * ```typescript
 * // Basic compression
 * const result = await compressImage(imageBuffer);
 * console.log(`Reduced size by ${result.compressionRatio}%`);
 * 
 * // Compression with resizing
 * const result = await compressImage(imageBuffer, {
 *   maxWidth: 1920,
 *   maxHeight: 1080,
 * });
 * 
 * // Preserve metadata (e.g., for legal documents)
 * const result = await compressImage(imageBuffer, {
 *   preserveMetadata: true,
 * });
 * ```
 */
export async function compressImage(
  imageBuffer: Buffer,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  // Validate API key is configured
  if (!process.env.TINYPNG_API_KEY) {
    throw new Error('TINYPNG_API_KEY environment variable is not configured');
  }

  // Validate input
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error('Input must be a Buffer');
  }

  if (imageBuffer.length === 0) {
    throw new Error('Input buffer is empty');
  }

  const originalSize = imageBuffer.length;

  try {
    // Start compression
    let source = tinify.fromBuffer(imageBuffer);

    // Apply resizing if specified
    if (options.maxWidth || options.maxHeight) {
      const resizeOptions: { method: 'fit'; width?: number; height?: number } = {
        method: 'fit',
      };

      if (options.maxWidth) {
        resizeOptions.width = options.maxWidth;
      }

      if (options.maxHeight) {
        resizeOptions.height = options.maxHeight;
      }

      source = source.resize(resizeOptions);
    }

    // Preserve metadata if requested
    if (options.preserveMetadata) {
      source = source.preserve('copyright', 'creation', 'location');
    }

    // Get compressed buffer
    const compressedBuffer = await source.toBuffer();
    const compressedSize = compressedBuffer.length;

    // Calculate statistics
    const savedBytes = originalSize - compressedSize;
    const compressionRatio = Math.round((savedBytes / originalSize) * 100);

    return {
      buffer: Buffer.from(compressedBuffer), // Convert to Buffer if needed
      originalSize,
      compressedSize,
      compressionRatio,
      savedBytes,
    };
  } catch (error) {
    // Handle TinyPNG API errors
    if (error instanceof Error) {
      // Check for specific TinyPNG errors
      if ('message' in error && typeof error.message === 'string') {
        if (error.message.includes('Unauthorized')) {
          throw new Error('TinyPNG API key is invalid or unauthorized');
        }
        if (error.message.includes('TooManyRequests')) {
          throw new Error('TinyPNG API rate limit exceeded. Please try again later.');
        }
        if (error.message.includes('BadRequest')) {
          throw new Error('Invalid image format. TinyPNG supports JPEG, PNG, and WebP only.');
        }
      }
      
      throw new Error(`Image compression failed: ${error.message}`);
    }
    
    throw new Error('Image compression failed: Unknown error');
  }
}

/**
 * Compress multiple images in parallel
 * 
 * Efficiently compresses multiple images using Promise.all for parallel processing.
 * Useful for batch operations like case creation with multiple photos.
 * 
 * @param imageBuffers - Array of image buffers to compress
 * @param options - Compression options applied to all images
 * @returns Array of compression results
 * 
 * @example
 * ```typescript
 * const results = await compressMultipleImages([buffer1, buffer2, buffer3], {
 *   maxWidth: 1920,
 * });
 * 
 * const totalSaved = results.reduce((sum, r) => sum + r.savedBytes, 0);
 * console.log(`Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
 * ```
 */
export async function compressMultipleImages(
  imageBuffers: Buffer[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error('Input must be a non-empty array of Buffers');
  }

  // Compress all images in parallel
  const compressionPromises = imageBuffers.map((buffer) =>
    compressImage(buffer, options)
  );

  return Promise.all(compressionPromises);
}

/**
 * Check if image compression is available
 * 
 * Verifies that TinyPNG API key is configured and service is ready to use.
 * 
 * @returns True if compression is available, false otherwise
 * 
 * @example
 * ```typescript
 * if (isCompressionAvailable()) {
 *   const result = await compressImage(buffer);
 * } else {
 *   console.warn('Image compression not available, uploading original');
 * }
 * ```
 */
export function isCompressionAvailable(): boolean {
  return !!process.env.TINYPNG_API_KEY;
}

/**
 * Get TinyPNG API usage statistics
 * 
 * Returns the number of compressions made this month.
 * TinyPNG free tier allows 500 compressions per month.
 * 
 * @returns Compression count for current month
 * 
 * @throws Error if API key is not configured
 * 
 * @example
 * ```typescript
 * const count = await getCompressionCount();
 * console.log(`Used ${count} of 500 free compressions this month`);
 * ```
 */
export async function getCompressionCount(): Promise<number> {
  if (!process.env.TINYPNG_API_KEY) {
    throw new Error('TINYPNG_API_KEY environment variable is not configured');
  }

  try {
    // TinyPNG tracks compression count internally
    // We can access it via tinify.compressionCount after any compression
    return tinify.compressionCount || 0;
  } catch (error) {
    console.error('Failed to get compression count:', error);
    return 0;
  }
}

/**
 * Preset compression options for common use cases
 */
export const COMPRESSION_PRESETS = {
  /**
   * Mobile optimized - aggressive compression for mobile data savings
   * Max 1920x1080, removes metadata
   */
  MOBILE: {
    maxWidth: 1920,
    maxHeight: 1080,
    preserveMetadata: false,
  },
  
  /**
   * Thumbnail - small size for list views
   * Max 400x400, removes metadata
   */
  THUMBNAIL: {
    maxWidth: 400,
    maxHeight: 400,
    preserveMetadata: false,
  },
  
  /**
   * Document - preserves quality and metadata for legal documents
   * No resizing, preserves metadata
   */
  DOCUMENT: {
    preserveMetadata: true,
  },
  
  /**
   * High quality - minimal compression for important photos
   * Max 3840x2160 (4K), removes metadata
   */
  HIGH_QUALITY: {
    maxWidth: 3840,
    maxHeight: 2160,
    preserveMetadata: false,
  },
} as const;
