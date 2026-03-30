/**
 * Client-Side Image Compression Utility
 * 
 * Compresses images in the browser before upload to prevent FUNCTION_PAYLOAD_TOO_LARGE errors.
 * Critical for mobile camera photos which can be 8-12MB and cause 413 errors.
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  maxSizeMB?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressionResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress an image file in the browser and return base64
 * 
 * @param file - Image file from input
 * @param options - Compression options
 * @returns Base64 string of compressed image
 * 
 * @example
 * ```typescript
 * const compressed = await compressImage(file, {
 *   maxWidth: 1920,
 *   maxHeight: 1920,
 *   quality: 0.85,
 *   maxSizeMB: 1,
 * });
 * ```
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 1,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Try to compress to target size
        let currentQuality = quality;
        let base64 = canvas.toDataURL(mimeType, currentQuality);
        
        // If still too large, reduce quality iteratively
        const targetBytes = maxSizeMB * 1024 * 1024;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (base64.length > targetBytes && currentQuality > 0.5 && attempts < maxAttempts) {
          currentQuality -= 0.1;
          base64 = canvas.toDataURL(mimeType, currentQuality);
          attempts++;
        }
        
        console.log(`📸 Compression: ${file.size} → ${base64.length} bytes (${((1 - base64.length / file.size) * 100).toFixed(1)}% reduction, quality: ${currentQuality.toFixed(2)})`);
        
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Compress multiple images in parallel
 * 
 * @param files - Array of image files
 * @param options - Compression options
 * @returns Array of base64 strings
 */
export async function compressMultipleImages(
  files: File[],
  options: ImageCompressionOptions = {}
): Promise<string[]> {
  const compressionPromises = files.map((file) => compressImage(file, options));
  return Promise.all(compressionPromises);
}

/**
 * Get estimated compressed size without actually compressing
 * Useful for showing progress indicators
 */
export function estimateCompressedSize(
  originalSize: number,
  options: ImageCompressionOptions = {}
): number {
  const { quality = 0.85, maxSizeMB = 1 } = options;
  
  // Rough estimation: quality * 0.7 (JPEG compression factor)
  const estimated = originalSize * quality * 0.7;
  const maxBytes = maxSizeMB * 1024 * 1024;
  
  return Math.min(estimated, maxBytes);
}
