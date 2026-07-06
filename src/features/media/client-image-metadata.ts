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

async function sha256File(file: File): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;

  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

function getBrowserLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 }
    );
  });
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
  captureSource: string,
  browserLocation?: { latitude: number; longitude: number; accuracy: number } | null
): Promise<ImageUploadClientMetadata> {
  const warnings: string[] = [];
  const [dimensions, clientSha256Hash] = await Promise.all([
    getImageDimensions(file),
    sha256File(file),
  ]);
  let rawExif: Record<string, unknown> | undefined;

  try {
    rawExif = await exifr.parse(file, true) as Record<string, unknown> | undefined;
  } catch (error) {
    warnings.push(`EXIF metadata could not be read before upload: ${error instanceof Error ? error.message : 'unknown error'}`);
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
    gpsLatitude: numberValue(rawExif?.latitude || rawExif?.GPSLatitude) ?? browserLocation?.latitude,
    gpsLongitude: numberValue(rawExif?.longitude || rawExif?.GPSLongitude) ?? browserLocation?.longitude,
    gpsAltitude: numberValue(rawExif?.GPSAltitude),
    gpsAccuracy: browserLocation?.accuracy,
    locationSource: rawExif?.latitude || rawExif?.GPSLatitude ? 'exif' : browserLocation ? 'browser_geolocation' : undefined,
    browserRecordedAt: new Date().toISOString(),
    clientSha256Hash,
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
  const shouldRequestLocation = captureSource.includes('camera');
  const browserLocation = shouldRequestLocation ? await getBrowserLocation() : null;
  return Promise.all(
    files.map((file, index) => collectImageFileMetadata(file, index, captureSource, browserLocation))
  );
}
