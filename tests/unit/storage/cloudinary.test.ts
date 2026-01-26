/**
 * Unit tests for Cloudinary storage service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSalvageCaseFolder,
  getKycDocumentFolder,
  validateFile,
  CLOUDINARY_FOLDERS,
  TRANSFORMATION_PRESETS,
} from '@/lib/storage/cloudinary';

describe('Cloudinary Storage Service', () => {
  describe('Folder Path Helpers', () => {
    it('should generate correct salvage case folder path', () => {
      const caseId = 'case-123';
      const folder = getSalvageCaseFolder(caseId);
      
      expect(folder).toBe(`${CLOUDINARY_FOLDERS.SALVAGE_CASES}/${caseId}`);
      expect(folder).toBe('salvage-cases/case-123');
    });

    it('should generate correct KYC document folder path', () => {
      const vendorId = 'vendor-456';
      const folder = getKycDocumentFolder(vendorId);
      
      expect(folder).toBe(`${CLOUDINARY_FOLDERS.KYC_DOCUMENTS}/${vendorId}`);
      expect(folder).toBe('kyc-documents/vendor-456');
    });

    it('should handle special characters in IDs', () => {
      const caseId = 'case-abc-123-xyz';
      const folder = getSalvageCaseFolder(caseId);
      
      expect(folder).toBe('salvage-cases/case-abc-123-xyz');
    });
  });

  describe('File Validation', () => {
    it('should validate file within size limit', () => {
      const file = {
        size: 3 * 1024 * 1024, // 3MB
        type: 'image/jpeg',
      };
      
      const result = validateFile(file, 5);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file exceeding size limit', () => {
      const file = {
        size: 6 * 1024 * 1024, // 6MB
        type: 'image/jpeg',
      };
      
      const result = validateFile(file, 5);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 5MB limit');
    });

    it('should validate allowed file types', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      
      const jpegFile = { size: 1024, type: 'image/jpeg' };
      const pngFile = { size: 1024, type: 'image/png' };
      const jpgFile = { size: 1024, type: 'image/jpg' };
      
      expect(validateFile(jpegFile, 5, allowedTypes).valid).toBe(true);
      expect(validateFile(pngFile, 5, allowedTypes).valid).toBe(true);
      expect(validateFile(jpgFile, 5, allowedTypes).valid).toBe(true);
    });

    it('should reject disallowed file types', () => {
      const file = {
        size: 1024,
        type: 'application/exe',
      };
      
      const result = validateFile(file, 5, ['image/jpeg', 'image/png']);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should use default allowed types when not specified', () => {
      const jpegFile = { size: 1024, type: 'image/jpeg' };
      const pngFile = { size: 1024, type: 'image/png' };
      const pdfFile = { size: 1024, type: 'application/pdf' };
      const heicFile = { size: 1024, type: 'image/heic' };
      
      expect(validateFile(jpegFile).valid).toBe(true);
      expect(validateFile(pngFile).valid).toBe(true);
      expect(validateFile(pdfFile).valid).toBe(true);
      expect(validateFile(heicFile).valid).toBe(true);
    });

    it('should use default max size of 5MB when not specified', () => {
      const smallFile = { size: 4 * 1024 * 1024, type: 'image/jpeg' };
      const largeFile = { size: 6 * 1024 * 1024, type: 'image/jpeg' };
      
      expect(validateFile(smallFile).valid).toBe(true);
      expect(validateFile(largeFile).valid).toBe(false);
    });

    it('should handle edge case of exactly max size', () => {
      const file = {
        size: 5 * 1024 * 1024, // Exactly 5MB
        type: 'image/jpeg',
      };
      
      const result = validateFile(file, 5);
      
      expect(result.valid).toBe(true);
    });

    it('should handle zero-size files', () => {
      const file = {
        size: 0,
        type: 'image/jpeg',
      };
      
      const result = validateFile(file, 5);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Transformation Presets', () => {
    it('should have THUMBNAIL preset with correct dimensions', () => {
      expect(TRANSFORMATION_PRESETS.THUMBNAIL).toEqual({
        width: 200,
        height: 200,
        crop: 'fill',
        quality: 'auto:good',
        fetch_format: 'auto',
      });
    });

    it('should have MEDIUM preset with correct dimensions', () => {
      expect(TRANSFORMATION_PRESETS.MEDIUM).toEqual({
        width: 800,
        height: 600,
        crop: 'fit',
        quality: 'auto:good',
        fetch_format: 'auto',
      });
    });

    it('should have LARGE preset with correct dimensions', () => {
      expect(TRANSFORMATION_PRESETS.LARGE).toEqual({
        width: 1920,
        height: 1080,
        crop: 'fit',
        quality: 'auto:best',
        fetch_format: 'auto',
      });
    });

    it('should have COMPRESSED preset with lossy compression', () => {
      expect(TRANSFORMATION_PRESETS.COMPRESSED).toEqual({
        quality: 'auto:eco',
        fetch_format: 'auto',
        flags: 'lossy',
      });
    });
  });

  describe('Folder Constants', () => {
    it('should have correct folder constants', () => {
      expect(CLOUDINARY_FOLDERS.SALVAGE_CASES).toBe('salvage-cases');
      expect(CLOUDINARY_FOLDERS.KYC_DOCUMENTS).toBe('kyc-documents');
    });
  });
});
