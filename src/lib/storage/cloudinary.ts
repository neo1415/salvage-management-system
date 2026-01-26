/**
 * Cloudinary Storage Service
 * 
 * Provides secure file upload, deletion, and transformation capabilities
 * for salvage case photos and KYC documents.
 * 
 * Features:
 * - Signed upload URLs for secure client-side uploads
 * - Automatic image compression and optimization
 * - Organized folder structure by entity type
 * - Image transformation presets
 * - Secure deletion with signature verification
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Folder structure for organized storage
 */
export const CLOUDINARY_FOLDERS = {
  SALVAGE_CASES: 'salvage-cases',
  KYC_DOCUMENTS: 'kyc-documents',
} as const;

/**
 * Image transformation presets for different use cases
 */
export const TRANSFORMATION_PRESETS = {
  // Thumbnail for list views (200x200, cropped)
  THUMBNAIL: {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto:good',
    fetch_format: 'auto',
  },
  // Medium size for detail views (800x600, fit)
  MEDIUM: {
    width: 800,
    height: 600,
    crop: 'fit',
    quality: 'auto:good',
    fetch_format: 'auto',
  },
  // Large size for full-screen views (1920x1080, fit)
  LARGE: {
    width: 1920,
    height: 1080,
    crop: 'fit',
    quality: 'auto:best',
    fetch_format: 'auto',
  },
  // Compressed for mobile data savings (max 5MB)
  COMPRESSED: {
    quality: 'auto:eco',
    fetch_format: 'auto',
    flags: 'lossy',
  },
} as const;

/**
 * Upload options interface
 */
export interface UploadOptions {
  folder: string;
  publicId?: string;
  transformation?: typeof TRANSFORMATION_PRESETS[keyof typeof TRANSFORMATION_PRESETS];
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
  tags?: string[];
}

/**
 * Upload result interface
 */
export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

/**
 * Signed upload parameters interface
 */
export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId?: string;
  transformation?: string;
}

/**
 * Upload a file to Cloudinary
 * 
 * @param file - File path or buffer to upload
 * @param options - Upload configuration options
 * @returns Upload result with URLs and metadata
 * 
 * @example
 * ```typescript
 * const result = await uploadFile('/path/to/image.jpg', {
 *   folder: `${CLOUDINARY_FOLDERS.SALVAGE_CASES}/case-123`,
 *   transformation: TRANSFORMATION_PRESETS.COMPRESSED,
 *   tags: ['vehicle', 'front-damage'],
 * });
 * console.log(result.secureUrl);
 * ```
 */
export async function uploadFile(
  file: string | Buffer,
  options: UploadOptions
): Promise<UploadResult> {
  try {
    const uploadOptions: any = {
      folder: options.folder,
      resource_type: options.resourceType || 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    // Add public ID if provided
    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    // Add transformation if provided
    if (options.transformation) {
      uploadOptions.transformation = options.transformation;
    }

    // Add tags if provided
    if (options.tags && options.tags.length > 0) {
      uploadOptions.tags = options.tags;
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      typeof file === 'string' ? file : `data:image/jpeg;base64,${file.toString('base64')}`,
      uploadOptions
    );

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Failed to upload file to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate signed upload parameters for client-side uploads
 * 
 * This allows secure uploads directly from the browser without exposing API secrets.
 * The signature ensures that only authorized uploads with specific parameters can succeed.
 * 
 * @param folder - Cloudinary folder path
 * @param publicId - Optional public ID for the uploaded file
 * @param transformation - Optional transformation preset
 * @returns Signed upload parameters for client-side use
 * 
 * @example
 * ```typescript
 * // Server-side: Generate signed params
 * const params = generateSignedUploadParams(
 *   `${CLOUDINARY_FOLDERS.SALVAGE_CASES}/case-123`
 * );
 * 
 * // Client-side: Use params to upload
 * const formData = new FormData();
 * formData.append('file', file);
 * formData.append('signature', params.signature);
 * formData.append('timestamp', params.timestamp.toString());
 * formData.append('folder', params.folder);
 * 
 * await fetch(`https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`, {
 *   method: 'POST',
 *   body: formData,
 * });
 * ```
 */
export function generateSignedUploadParams(
  folder: string,
  publicId?: string,
  transformation?: typeof TRANSFORMATION_PRESETS[keyof typeof TRANSFORMATION_PRESETS]
): SignedUploadParams {
  const timestamp = Math.round(Date.now() / 1000);
  
  const params: Record<string, any> = {
    timestamp,
    folder,
  };

  if (publicId) {
    params.public_id = publicId;
  }

  if (transformation) {
    params.transformation = JSON.stringify(transformation);
  }

  // Generate signature
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    publicId,
    transformation: transformation ? JSON.stringify(transformation) : undefined,
  };
}

/**
 * Delete a file from Cloudinary
 * 
 * @param publicId - The public ID of the file to delete
 * @param resourceType - Type of resource (image, raw, video)
 * @returns Deletion result
 * 
 * @example
 * ```typescript
 * await deleteFile('salvage-cases/case-123/photo-1', 'image');
 * ```
 */
export async function deleteFile(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<{ result: string }> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // Invalidate CDN cache
    });

    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete file from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete multiple files from Cloudinary
 * 
 * @param publicIds - Array of public IDs to delete
 * @param resourceType - Type of resource (image, raw, video)
 * @returns Deletion results
 * 
 * @example
 * ```typescript
 * await deleteMultipleFiles([
 *   'salvage-cases/case-123/photo-1',
 *   'salvage-cases/case-123/photo-2',
 * ]);
 * ```
 */
export async function deleteMultipleFiles(
  publicIds: string[],
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<{ deleted: Record<string, string> }> {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
      invalidate: true,
    });

    return result;
  } catch (error) {
    console.error('Cloudinary bulk delete error:', error);
    throw new Error(`Failed to delete files from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a transformed image URL
 * 
 * @param publicId - The public ID of the image
 * @param transformation - Transformation preset or custom transformation
 * @returns Transformed image URL
 * 
 * @example
 * ```typescript
 * const thumbnailUrl = getTransformedUrl(
 *   'salvage-cases/case-123/photo-1',
 *   TRANSFORMATION_PRESETS.THUMBNAIL
 * );
 * ```
 */
export function getTransformedUrl(
  publicId: string,
  transformation: typeof TRANSFORMATION_PRESETS[keyof typeof TRANSFORMATION_PRESETS] | Record<string, any>
): string {
  return cloudinary.url(publicId, {
    ...transformation,
    secure: true,
  });
}

/**
 * Helper function to build folder path for salvage cases
 * 
 * @param caseId - The salvage case ID
 * @returns Folder path for the case
 * 
 * @example
 * ```typescript
 * const folder = getSalvageCaseFolder('case-123');
 * // Returns: 'salvage-cases/case-123'
 * ```
 */
export function getSalvageCaseFolder(caseId: string): string {
  return `${CLOUDINARY_FOLDERS.SALVAGE_CASES}/${caseId}`;
}

/**
 * Helper function to build folder path for KYC documents
 * 
 * @param vendorId - The vendor ID
 * @returns Folder path for the vendor's KYC documents
 * 
 * @example
 * ```typescript
 * const folder = getKycDocumentFolder('vendor-456');
 * // Returns: 'kyc-documents/vendor-456'
 * ```
 */
export function getKycDocumentFolder(vendorId: string): string {
  return `${CLOUDINARY_FOLDERS.KYC_DOCUMENTS}/${vendorId}`;
}

/**
 * Validate file size and type
 * 
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB
 * @param allowedTypes - Allowed MIME types
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const isValid = validateFile(file, 5, ['image/jpeg', 'image/png']);
 * if (!isValid.valid) {
 *   console.error(isValid.error);
 * }
 * ```
 */
export function validateFile(
  file: { size: number; type: string },
  maxSizeMB: number = 5,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'application/pdf']
): { valid: boolean; error?: string } {
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

export default cloudinary;
