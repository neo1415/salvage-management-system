import crypto from 'node:crypto';
import sharp from 'sharp';
import exifr from 'exifr/dist/lite.esm.mjs';
import { desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  imageUploadMetadata,
  type ImageMetadataEntityType,
  type ImageUploadClientMetadata,
} from '@/lib/db/schema/image-metadata';

interface RecordImageMetadataInput {
  entityType: ImageMetadataEntityType;
  entityId: string;
  imageUrl: string;
  imageIndex?: number;
  purpose?: string;
  uploadedBy?: string;
  clientMetadata?: ImageUploadClientMetadata;
  serverBuffer?: Buffer;
  fallbackMimeType?: string;
}

function numericString(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return String(value);
}

function dateFromValue(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function metadataStatus(
  clientMetadata: ImageUploadClientMetadata | undefined,
  serverExif: Record<string, unknown>,
  warnings: string[]
): 'captured' | 'partial' | 'unavailable' | 'failed' {
  if (warnings.some((warning) => warning.toLowerCase().includes('failed'))) return 'failed';
  if (clientMetadata?.exifCapturedAt || serverExif.DateTimeOriginal || serverExif.CreateDate || serverExif.latitude) {
    return 'captured';
  }
  if (clientMetadata?.width || clientMetadata?.height || clientMetadata?.lastModified) return 'partial';
  return 'unavailable';
}

function isMissingImageMetadataTableError(error: unknown): boolean {
  const candidate = error as { code?: unknown; cause?: { code?: unknown }; message?: unknown };
  return candidate.code === '42P01' ||
    candidate.cause?.code === '42P01' ||
    (typeof candidate.message === 'string' && candidate.message.includes('image_upload_metadata'));
}

export async function extractImageMetadataFromBuffer(buffer: Buffer, mimeType?: string): Promise<{
  exif: Record<string, unknown>;
  width?: number;
  height?: number;
  warnings: string[];
  sha256Hash: string;
}> {
  const warnings: string[] = [];
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  let exif: Record<string, unknown> = {};
  let width: number | undefined;
  let height: number | undefined;

  if (!mimeType?.startsWith('image/')) {
    return {
      exif,
      warnings: ['Metadata extraction skipped because the uploaded file is not an image.'],
      sha256Hash,
    };
  }

  try {
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
    width = metadata.width;
    height = metadata.height;
  } catch (error) {
    warnings.push(`Image dimensions could not be read: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  try {
    exif = asRecord(await exifr.parse(buffer, true));
  } catch (error) {
    warnings.push(`EXIF metadata could not be parsed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  if (Object.keys(exif).length === 0) {
    warnings.push('No EXIF metadata was found on the original uploaded image.');
  }

  return { exif, width, height, warnings, sha256Hash };
}

export async function recordImageUploadMetadata(input: RecordImageMetadataInput) {
  const serverMetadata: {
    exif: Record<string, unknown>;
    warnings: string[];
    sha256Hash?: string;
    width?: number;
    height?: number;
  } = input.serverBuffer
    ? await extractImageMetadataFromBuffer(input.serverBuffer, input.fallbackMimeType || input.clientMetadata?.type)
    : { exif: {}, warnings: [], sha256Hash: undefined, width: undefined, height: undefined };
  const exif = serverMetadata.exif;
  const clientMetadata = input.clientMetadata;
  const serverWarnings = clientMetadata
    ? serverMetadata.warnings.filter((warning) => !warning.includes('No EXIF metadata was found'))
    : serverMetadata.warnings;
  const warnings = [
    ...(clientMetadata?.metadataWarnings || []),
    ...serverWarnings,
  ];
  const capturedAt = dateFromValue(
    clientMetadata?.exifCapturedAt ||
    exif.DateTimeOriginal ||
    exif.CreateDate ||
    exif.ModifyDate
  );
  const width = firstNumber(clientMetadata?.width, serverMetadata.width, exif.ImageWidth, exif.ExifImageWidth);
  const height = firstNumber(clientMetadata?.height, serverMetadata.height, exif.ImageHeight, exif.ExifImageHeight);
  const gpsLatitude = firstNumber(clientMetadata?.gpsLatitude, exif.latitude, exif.GPSLatitude);
  const gpsLongitude = firstNumber(clientMetadata?.gpsLongitude, exif.longitude, exif.GPSLongitude);

  try {
    await db.insert(imageUploadMetadata).values({
      entityType: input.entityType,
      entityId: input.entityId,
      imageUrl: input.imageUrl,
      imageIndex: input.imageIndex != null ? String(input.imageIndex) : null,
      purpose: input.purpose || 'evidence',
      uploadedBy: input.uploadedBy || null,
      source: (clientMetadata?.captureSource as typeof imageUploadMetadata.$inferInsert['source']) || 'server_upload',
      originalFilename: clientMetadata?.name || null,
      mimeType: clientMetadata?.type || input.fallbackMimeType || null,
      fileSizeBytes: clientMetadata?.size != null ? String(clientMetadata.size) : null,
      browserLastModifiedAt: clientMetadata?.lastModified ? new Date(clientMetadata.lastModified) : null,
      capturedAt,
      gpsLatitude: numericString(gpsLatitude),
      gpsLongitude: numericString(gpsLongitude),
      gpsAltitude: numericString(firstNumber(clientMetadata?.gpsAltitude, exif.GPSAltitude)),
      deviceMake: firstString(clientMetadata?.deviceMake, exif.Make),
      deviceModel: firstString(clientMetadata?.deviceModel, exif.Model),
      deviceSoftware: firstString(clientMetadata?.deviceSoftware, exif.Software),
      orientation: numericString(firstNumber(clientMetadata?.orientation, exif.Orientation)),
      width: numericString(width),
      height: numericString(height),
      metadataStatus: metadataStatus(clientMetadata, exif, warnings),
      metadataWarnings: warnings.length ? warnings : null,
      sha256Hash: serverMetadata.sha256Hash || clientMetadata?.clientSha256Hash || null,
      rawMetadata: {
        client: clientMetadata || null,
        serverExif: Object.keys(exif).length ? exif : null,
        browserRecordedAt: clientMetadata?.browserRecordedAt || null,
        locationSource: clientMetadata?.locationSource || null,
        gpsAccuracy: clientMetadata?.gpsAccuracy ?? null,
        originalFileSha256: clientMetadata?.clientSha256Hash || null,
      },
    });
  } catch (error) {
    if (isMissingImageMetadataTableError(error)) {
      console.warn('Image metadata table is not available yet; skipping metadata persistence.');
      return;
    }
    console.warn('Image metadata persistence failed; continuing primary workflow:', error);
  }
}

export async function recordImageUploadMetadataBatch(
  inputs: RecordImageMetadataInput[]
): Promise<void> {
  for (const input of inputs) {
    await recordImageUploadMetadata(input);
  }
}

export async function listImageUploadMetadataForEntities(
  entityIds: string[]
): Promise<Array<typeof imageUploadMetadata.$inferSelect>> {
  const uniqueEntityIds = Array.from(new Set(entityIds.filter(Boolean)));
  if (uniqueEntityIds.length === 0) return [];

  try {
    return await db
      .select()
      .from(imageUploadMetadata)
      .where(inArray(imageUploadMetadata.entityId, uniqueEntityIds))
      .orderBy(desc(imageUploadMetadata.uploadedAt));
  } catch (error) {
    if (isMissingImageMetadataTableError(error)) {
      console.warn('Image metadata table is not available yet; evidence export will continue without image metadata.');
      return [];
    }
    throw error;
  }
}
