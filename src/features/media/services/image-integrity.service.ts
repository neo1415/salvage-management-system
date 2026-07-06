import crypto from 'crypto';
import sharp from 'sharp';
import type { ImageUploadClientMetadata } from '@/lib/db/schema/image-metadata';

export type ImageIntegrityStatus = 'passed' | 'warning' | 'failed';

export interface ImageIntegrityResult {
  index: number;
  status: ImageIntegrityStatus;
  warnings: string[];
  mimeType?: string;
  width?: number;
  height?: number;
  hasMetadata: boolean;
  metadataSoftware?: string;
  hashSha256: string;
}

const EDITING_SOFTWARE_PATTERNS = [
  /photoshop/i,
  /lightroom/i,
  /canva/i,
  /gimp/i,
  /snapseed/i,
  /stable diffusion/i,
  /midjourney/i,
  /dall[-\s]?e/i,
  /firefly/i,
  /generative/i,
  /ai image/i,
];

function inferMimeTypeFromBuffer(buffer: Buffer): string | undefined {
  const hex = buffer.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return undefined;
}

function metadataText(metadata: sharp.Metadata): string {
  const values = [
    metadata.format,
    metadata.space,
    metadata.compression,
    metadata.exif?.toString('utf8'),
    metadata.iptc?.toString('utf8'),
    metadata.xmp?.toString('utf8'),
  ];

  return values.filter(Boolean).join('\n');
}

export async function inspectImageBufferIntegrity(
  buffer: Buffer,
  index: number
): Promise<ImageIntegrityResult> {
  const warnings: string[] = [];
  const hashSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const mimeType = inferMimeTypeFromBuffer(buffer);

  if (!mimeType) {
    warnings.push('Image format could not be confidently identified as JPEG, PNG, or WebP.');
  }

  try {
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
    const hasMetadata = Boolean(metadata.exif || metadata.iptc || metadata.xmp);
    const allMetadataText = metadataText(metadata);
    const softwareMatch = EDITING_SOFTWARE_PATTERNS.find((pattern) => pattern.test(allMetadataText));

    if (!metadata.width || !metadata.height) {
      warnings.push('Image dimensions could not be read.');
    } else if (metadata.width < 480 || metadata.height < 480) {
      warnings.push('Image resolution is low for evidence review.');
    }

    if (!hasMetadata) {
      warnings.push('No EXIF/IPTC/XMP metadata was found; this can happen after browser compression or Cloudinary processing, but staff should rely on visual review.');
    }

    if (softwareMatch) {
      warnings.push('Image metadata references editing or generative-image software.');
    }

    return {
      index,
      status: warnings.length > 0 ? 'warning' : 'passed',
      warnings,
      mimeType: mimeType || (metadata.format ? `image/${metadata.format}` : undefined),
      width: metadata.width,
      height: metadata.height,
      hasMetadata,
      metadataSoftware: softwareMatch?.source,
      hashSha256,
    };
  } catch (error) {
    return {
      index,
      status: 'failed',
      warnings: [`Image could not be decoded for integrity review: ${error instanceof Error ? error.message : 'unknown error'}`],
      mimeType,
      hasMetadata: false,
      hashSha256,
    };
  }
}

export async function inspectImageUrlIntegrity(url: string, index: number): Promise<ImageIntegrityResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      return {
        index,
        status: 'failed',
        warnings: [`Image URL could not be fetched for integrity review (${response.status}).`],
        hasMetadata: false,
        hashSha256: crypto.createHash('sha256').update(url).digest('hex'),
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return inspectImageBufferIntegrity(buffer, index);
  } catch (error) {
    return {
      index,
      status: 'failed',
      warnings: [`Image integrity review failed: ${error instanceof Error ? error.message : 'unknown error'}`],
      hasMetadata: false,
      hashSha256: crypto.createHash('sha256').update(url).digest('hex'),
    };
  }
}

export async function inspectImageSetIntegrityFromBuffers(buffers: Buffer[]): Promise<ImageIntegrityResult[]> {
  return Promise.all(buffers.map((buffer, index) => inspectImageBufferIntegrity(buffer, index)));
}

export async function inspectImageSetIntegrityFromUrls(urls: string[]): Promise<ImageIntegrityResult[]> {
  return Promise.all(urls.map((url, index) => inspectImageUrlIntegrity(url, index)));
}

function hasClientMetadata(metadata: ImageUploadClientMetadata | undefined): boolean {
  if (!metadata) return false;
  return Boolean(
    metadata.hasClientExif ||
    metadata.exifCapturedAt ||
    metadata.gpsLatitude ||
    metadata.gpsLongitude ||
    metadata.deviceMake ||
    metadata.deviceModel ||
    metadata.width ||
    metadata.height ||
    metadata.lastModified
  );
}

function isMissingMetadataWarning(warning: string): boolean {
  return warning.toLowerCase().includes('no exif/iptc/xmp metadata was found');
}

function isLowResolutionWarning(warning: string): boolean {
  return warning.toLowerCase().includes('image resolution is low');
}

export function summarizeImageIntegrity(
  results: ImageIntegrityResult[],
  clientMetadata: ImageUploadClientMetadata[] = []
): {
  status: ImageIntegrityStatus;
  warnings: string[];
} {
  const warnings = results.flatMap((result) => {
    const metadata = clientMetadata.find((item) => item.index === result.index) ?? clientMetadata[result.index];
    const shouldSuppressProcessedExifWarning = hasClientMetadata(metadata);
    const originalResolutionIsSufficient =
      typeof metadata?.width === 'number'
      && typeof metadata?.height === 'number'
      && metadata.width >= 480
      && metadata.height >= 480;
    return result.warnings
      .filter((warning) => !(shouldSuppressProcessedExifWarning && isMissingMetadataWarning(warning)))
      .filter((warning) => !(originalResolutionIsSufficient && isLowResolutionWarning(warning)))
      .map((warning) => `Photo ${result.index + 1}: ${warning}`);
  });
  const status: ImageIntegrityStatus = results.some((result) => result.status === 'failed')
    ? 'failed'
    : warnings.length > 0
      ? 'warning'
      : 'passed';

  return { status, warnings };
}
