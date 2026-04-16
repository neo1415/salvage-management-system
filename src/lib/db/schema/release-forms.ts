import { pgTable, uuid, varchar, timestamp, text, jsonb, pgEnum, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auctions } from './auctions';
import { vendors } from './vendors';
import { users } from './users';

export const documentTypeEnum = pgEnum('document_type', [
  'bill_of_sale',
  'liability_waiver',
  'pickup_authorization',
  'salvage_certificate',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'signed',
  'voided',
  'expired',
]);

export const releaseForms = pgTable('release_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  documentType: documentTypeEnum('document_type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: documentStatusEnum('status').notNull().default('pending'),
  disabled: boolean('disabled').default(false), // For forfeiture - disables document signing

  // Deposit system fields (Requirements 6.3, 8.5)
  validityDeadline: timestamp('validity_deadline'), // Deadline for signing (default 48 hours)
  extensionCount: integer('extension_count').default(0).notNull(), // Number of extensions granted
  originalDeadline: timestamp('original_deadline'), // Original deadline before extensions
  paymentDeadline: timestamp('payment_deadline'), // Payment deadline after signing (default 72 hours)

  // Digital signature data
  digitalSignature: text('digital_signature'), // Base64 encoded signature image
  signedAt: timestamp('signed_at'),
  signatureIpAddress: varchar('signature_ip_address', { length: 45 }),
  signatureDeviceType: varchar('signature_device_type', { length: 20 }),
  signatureUserAgent: varchar('signature_user_agent', { length: 500 }),

  // Document storage
  pdfUrl: varchar('pdf_url', { length: 500 }), // Cloudinary URL
  pdfPublicId: varchar('pdf_public_id', { length: 255 }), // Cloudinary public ID

  // Document metadata
  documentData: jsonb('document_data')
    .notNull()
    .$type<{
      // Buyer information
      buyerName: string;
      buyerEmail: string;
      buyerPhone: string;
      buyerBvn?: string; // Last 4 digits only
      
      // Seller information
      sellerName: string;
      sellerAddress: string;
      sellerContact: string;
      
      // Asset information
      assetType: string;
      assetDescription: string;
      assetCondition: string;
      vin?: string; // For vehicles
      make?: string;
      model?: string;
      year?: number;
      
      // Transaction information
      salePrice: number;
      paymentMethod: string;
      paymentReference?: string;
      transactionDate: string;
      
      // Pickup information
      pickupLocation: string;
      pickupDeadline: string;
      pickupAuthCode?: string;
      
      // Additional metadata
      qrCodeData?: string;
      verificationUrl?: string;
    }>(),

  // Audit trail
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  generatedBy: uuid('generated_by').references(() => users.id),
  voidedAt: timestamp('voided_at'),
  voidedBy: uuid('voided_by').references(() => users.id),
  voidedReason: text('voided_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const documentDownloads = pgTable('document_downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseFormId: uuid('release_form_id')
    .notNull()
    .references(() => releaseForms.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),

  // Download metadata
  downloadedAt: timestamp('downloaded_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceType: varchar('device_type', { length: 20 }).notNull(),
  userAgent: varchar('user_agent', { length: 500 }).notNull(),

  // Download context
  downloadMethod: varchar('download_method', { length: 50 }).notNull(), // 'email', 'portal', 'api'

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const releaseFormsRelations = relations(releaseForms, ({ one, many }) => ({
  auction: one(auctions, {
    fields: [releaseForms.auctionId],
    references: [auctions.id],
  }),
  vendor: one(vendors, {
    fields: [releaseForms.vendorId],
    references: [vendors.id],
  }),
  generatedByUser: one(users, {
    fields: [releaseForms.generatedBy],
    references: [users.id],
  }),
  voidedByUser: one(users, {
    fields: [releaseForms.voidedBy],
    references: [users.id],
  }),
  downloads: many(documentDownloads),
}));

export const documentDownloadsRelations = relations(documentDownloads, ({ one }) => ({
  releaseForm: one(releaseForms, {
    fields: [documentDownloads.releaseFormId],
    references: [releaseForms.id],
  }),
  vendor: one(vendors, {
    fields: [documentDownloads.vendorId],
    references: [vendors.id],
  }),
}));

// Type exports
export type ReleaseForm = typeof releaseForms.$inferSelect;
export type NewReleaseForm = typeof releaseForms.$inferInsert;
export type DocumentDownload = typeof documentDownloads.$inferSelect;
export type NewDocumentDownload = typeof documentDownloads.$inferInsert;
export type DocumentType = 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization' | 'salvage_certificate';
export type DocumentStatus = 'pending' | 'signed' | 'voided' | 'expired';
