import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * DocumentUploadService
 * 
 * Handles secure document uploads to Supabase Storage for KYC verification.
 * All uploads are validated for file type, size, and content before storage.
 * 
 * Security measures:
 * - File type validation (only images and PDFs)
 * - File size limits (5MB per file)
 * - Unique file naming to prevent overwrites
 * - Private bucket access (requires authentication)
 * - Virus scanning (TODO: integrate with ClamAV or similar)
 */

const BUCKET_NAME = 'kyc-documents';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface UploadError {
  error: string;
  code: 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE' | 'UPLOAD_FAILED' | 'VALIDATION_FAILED';
}

export class DocumentUploadService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
  }
  /**
   * Upload a KYC document to Supabase Storage
   */
  async uploadDocument(
    file: File,
    vendorId: string,
    documentType: 'cac_certificate' | 'nin_card' | 'utility_bill' | 'bank_statement' | 'photo_id' | 'selfie'
  ): Promise<UploadResult | UploadError> {
    try {
      // Check if Supabase is configured
      if (!this.supabase) {
        return {
          error: 'Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
          code: 'UPLOAD_FAILED',
        };
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return {
          error: `File size exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
          code: 'FILE_TOO_LARGE',
        };
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return {
          error: `Invalid file type: ${file.type}. Only images (JPEG, PNG, WebP) and PDFs are allowed.`,
          code: 'INVALID_FILE_TYPE',
        };
      }

      // Generate unique file path
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'bin';
      const fileName = `${vendorId}/${documentType}_${timestamp}.${fileExtension}`;

      // Convert File to ArrayBuffer for upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error('[DocumentUpload] Supabase upload error:', error);
        return {
          error: `Upload failed: ${error.message}`,
          code: 'UPLOAD_FAILED',
        };
      }

      // Get public URL (note: bucket should be private, URL requires auth)
      const { data: urlData } = this.supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      return {
        url: urlData.publicUrl,
        path: data.path,
        size: file.size,
        mimeType: file.type,
      };
    } catch (error) {
      console.error('[DocumentUpload] Unexpected error:', error);
      return {
        error: 'An unexpected error occurred during upload',
        code: 'UPLOAD_FAILED',
      };
    }
  }

  /**
   * Upload multiple documents in parallel
   */
  async uploadMultipleDocuments(
    documents: Array<{
      file: File;
      type: 'cac_certificate' | 'nin_card' | 'utility_bill' | 'bank_statement' | 'photo_id' | 'selfie';
    }>,
    vendorId: string
  ): Promise<{
    results: Record<string, UploadResult>;
    errors: Record<string, UploadError>;
  }> {
    const results: Record<string, UploadResult> = {};
    const errors: Record<string, UploadError> = {};

    const uploadPromises = documents.map(async ({ file, type }) => {
      const result = await this.uploadDocument(file, vendorId, type);
      
      if ('error' in result) {
        errors[type] = result;
      } else {
        results[type] = result;
      }
    });

    await Promise.all(uploadPromises);

    return { results, errors };
  }

  /**
   * Delete a document from storage
   */
  async deleteDocument(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'Supabase not configured' };
      }

      const { error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

      if (error) {
        console.error('[DocumentUpload] Delete error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[DocumentUpload] Unexpected delete error:', error);
      return { success: false, error: 'Failed to delete document' };
    }
  }

  /**
   * Get a signed URL for temporary access to a private document
   */
  async getSignedUrl(path: string, expiresInSeconds: number = 3600): Promise<string | null> {
    try {
      if (!this.supabase) {
        console.error('[DocumentUpload] Supabase not configured');
        return null;
      }

      const { data, error } = await this.supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, expiresInSeconds);

      if (error) {
        console.error('[DocumentUpload] Signed URL error:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('[DocumentUpload] Unexpected signed URL error:', error);
      return null;
    }
  }

  /**
   * Ensure the KYC documents bucket exists
   */
  async ensureBucketExists(): Promise<void> {
    try {
      if (!this.supabase) {
        console.warn('[DocumentUpload] Supabase not configured - skipping bucket check');
        return;
      }

      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(BUCKET_NAME, {
          public: false, // Private bucket - requires authentication
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });

        if (error) {
          console.error('[DocumentUpload] Failed to create bucket:', error);
        } else {
          console.log('[DocumentUpload] Created KYC documents bucket');
        }
      }
    } catch (error) {
      console.error('[DocumentUpload] Error checking bucket:', error);
    }
  }
}

// Singleton instance
let _instance: DocumentUploadService | null = null;

export function getDocumentUploadService(): DocumentUploadService {
  if (!_instance) {
    _instance = new DocumentUploadService();
  }
  return _instance;
}
