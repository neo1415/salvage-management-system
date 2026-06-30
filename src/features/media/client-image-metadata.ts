import exifr from 'exifr/dist/lite.esm.mjs';
import type { ImageUploadClientMetadata } from '@/lib/db/schema/image-metadata';

function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function getImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return {};

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    image.src = url;
  });
}

export async function collectImageFileMetadata(
  file: File,
  index: number,
  captureSource: string
): Promise<ImageUploadClientMetadata> {
  const warnings: string[] = [];
  const dimensions = await getImageDimensions(file);
  let rawExif: Record<string, unknown> | undefined;

  try {
    rawExif = await exifr.parse(file, true) as Record<string, unknown> | undefined;
  } catch (error) {
    warnings.push(`EXIF metadata could not be read before upload: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  if (!rawExif || Object.keys(rawExif).length === 0) {
    warnings.push('No EXIF metadata was found on the original file before upload.');
  }

  return {
    index,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    captureSource,
    width: dimensions.width,
    height: dimensions.height,
    hasClientExif: Boolean(rawExif && Object.keys(rawExif).length > 0),
    exifCapturedAt: toIsoDate(rawExif?.DateTimeOriginal || rawExif?.CreateDate || rawExif?.ModifyDate),
    gpsLatitude: numberValue(rawExif?.latitude || rawExif?.GPSLatitude),
    gpsLongitude: numberValue(rawExif?.longitude || rawExif?.GPSLongitude),
    gpsAltitude: numberValue(rawExif?.GPSAltitude),
    deviceMake: stringValue(rawExif?.Make),
    deviceModel: stringValue(rawExif?.Model),
    deviceSoftware: stringValue(rawExif?.Software),
    orientation: numberValue(rawExif?.Orientation),
    metadataStatus: rawExif && Object.keys(rawExif).length > 0 ? 'captured' : dimensions.width ? 'partial' : 'unavailable',
    metadataWarnings: warnings,
    rawExif,
  };
}

export async function collectImageFilesMetadata(
  files: File[],
  captureSource: string
): Promise<ImageUploadClientMetadata[]> {
  return Promise.all(files.map((file, index) => collectImageFileMetadata(file, index, captureSource)));
}
