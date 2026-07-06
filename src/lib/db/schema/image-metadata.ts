import { index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export type ImageMetadataEntityType =
  | 'salvage_case'
  | 'pickup_evidence'
  | 'payment_proof'
  | 'kyc_document'
  | 'profile_picture'
  | 'brand_asset';

export type ImageMetadataSource = 'camera' | 'file_upload' | 'browser_file_input' | 'browser_camera_input' | 'server_upload';

export interface ImageUploadClientMetadata {
  index?: number;
  name?: string;
  size?: number;
  type?: string;
  lastModified?: number;
  captureSource?: string;
  width?: number;
  height?: number;
  hasClientExif?: boolean;
  exifCapturedAt?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  gpsAccuracy?: number;
  locationSource?: 'exif' | 'browser_geolocation';
  browserRecordedAt?: string;
  clientSha256Hash?: string;
  deviceMake?: string;
  deviceModel?: string;
  deviceSoftware?: string;
  orientation?: number;
  metadataStatus?: 'captured' | 'partial' | 'unavailable' | 'failed';
  metadataWarnings?: string[];
  rawExif?: Record<string, unknown>;
}

export const imageUploadMetadata = pgTable('image_upload_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 40 }).notNull().$type<ImageMetadataEntityType>(),
  entityId: uuid('entity_id').notNull(),
  imageUrl: text('image_url').notNull(),
  imageIndex: numeric('image_index', { precision: 6, scale: 0 }),
  purpose: varchar('purpose', { length: 80 }).notNull().default('evidence'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  source: varchar('source', { length: 80 }).$type<ImageMetadataSource>(),
  originalFilename: varchar('original_filename', { length: 255 }),
  mimeType: varchar('mime_type', { length: 120 }),
  fileSizeBytes: numeric('file_size_bytes', { precision: 14, scale: 0 }),
  browserLastModifiedAt: timestamp('browser_last_modified_at'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  capturedAt: timestamp('captured_at'),
  gpsLatitude: numeric('gps_latitude', { precision: 10, scale: 7 }),
  gpsLongitude: numeric('gps_longitude', { precision: 10, scale: 7 }),
  gpsAltitude: numeric('gps_altitude', { precision: 10, scale: 2 }),
  deviceMake: varchar('device_make', { length: 120 }),
  deviceModel: varchar('device_model', { length: 120 }),
  deviceSoftware: varchar('device_software', { length: 255 }),
  orientation: numeric('orientation', { precision: 4, scale: 0 }),
  width: numeric('width', { precision: 8, scale: 0 }),
  height: numeric('height', { precision: 8, scale: 0 }),
  metadataStatus: varchar('metadata_status', { length: 30 }).notNull().default('unavailable'),
  metadataWarnings: text('metadata_warnings').array(),
  sha256Hash: varchar('sha256_hash', { length: 64 }),
  rawMetadata: jsonb('raw_metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('idx_image_metadata_entity').on(table.entityType, table.entityId),
  uploadedByIdx: index('idx_image_metadata_uploaded_by').on(table.uploadedBy),
  imageUrlIdx: index('idx_image_metadata_image_url').on(table.imageUrl),
  capturedAtIdx: index('idx_image_metadata_captured_at').on(table.capturedAt),
  uploadedAtIdx: index('idx_image_metadata_uploaded_at').on(table.uploadedAt),
}));
