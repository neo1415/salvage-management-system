import { describe, expect, it } from 'vitest';
import { summarizeImageIntegrity, type ImageIntegrityResult } from '@/features/media/services/image-integrity.service';

describe('summarizeImageIntegrity', () => {
  it('suppresses processed-image EXIF warnings when original client metadata was captured', () => {
    const results: ImageIntegrityResult[] = [
      {
        index: 0,
        status: 'warning',
        warnings: [
          'No EXIF/IPTC/XMP metadata was found; this can happen after browser compression or Cloudinary processing, but staff should rely on visual review.',
        ],
        hasMetadata: false,
        hashSha256: 'hash',
      },
    ];

    const summary = summarizeImageIntegrity(results, [
      {
        index: 0,
        name: 'photo.jpg',
        size: 1234,
        type: 'image/jpeg',
        lastModified: Date.now(),
        captureSource: 'case_photo_upload',
        width: 1200,
        height: 900,
        metadataStatus: 'partial',
        metadataWarnings: ['No EXIF metadata was found on the original file before upload.'],
      },
    ]);

    expect(summary.status).toBe('passed');
    expect(summary.warnings).toEqual([]);
  });

  it('keeps real image integrity warnings even when client metadata exists', () => {
    const results: ImageIntegrityResult[] = [
      {
        index: 0,
        status: 'warning',
        warnings: ['Image resolution is low for evidence review.'],
        hasMetadata: false,
        hashSha256: 'hash',
      },
    ];

    const summary = summarizeImageIntegrity(results, [
      {
        index: 0,
        name: 'photo.jpg',
        size: 1234,
        type: 'image/jpeg',
        lastModified: Date.now(),
        captureSource: 'case_photo_upload',
        width: 320,
        height: 240,
        metadataStatus: 'partial',
      },
    ]);

    expect(summary.status).toBe('warning');
    expect(summary.warnings).toEqual(['Photo 1: Image resolution is low for evidence review.']);
  });
});
