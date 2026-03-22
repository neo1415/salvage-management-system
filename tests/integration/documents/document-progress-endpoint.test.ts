/**
 * Integration Tests: Document Progress Endpoint
 * 
 * Tests the GET /api/auctions/[id]/documents/progress endpoint
 * with various signing states (0/3, 1/3, 2/3, 3/3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, sql } from 'drizzle-orm';

describe('Document Progress Endpoint Integration Tests', () => {
  let testUser: any;
  let testVendor: any;
  let testCase: any;
  let testAuction: any;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-${Date.now()}@example.com`,
        fullName: 'Test Vendor',
        phone: `+234801234${Math.floor(Math.random() * 10000)}`, // Unique phone number
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890', // Dummy bcrypt hash
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        emailVerified: true,
        phoneVerified: true,
      })
      .returning();
    testUser = user;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUser.id,
        businessName: 'Test Business',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendor = vendor;

    // Create test case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-${Date.now()}`,
        assetType: 'vehicle',
        vehicleCondition: 'fair',
        locationName: 'Test Location',
        locationCoordinates: { lat: 6.5244, lng: 3.3792 },
        gpsLocation: sql`point(6.5244, 3.3792)`, // PostgreSQL point format
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: 5000000, // ₦5,000,000
        estimatedSalvageValue: 1500000, // ₦1,500,000
        reservePrice: 1000000, // ₦1,000,000
        photos: ['https://example.com/photo1.jpg'], // Required field
        status: 'approved',
        createdBy: testUser.id,
      })
      .returning();
    testCase = salvageCase;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        title: 'Test Auction',
        startingBid: 100000,
        currentBid: 150000,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
        status: 'closed',
        winnerId: testVendor.id,
        createdBy: testUser.id,
      })
      .returning();
    testAuction = auction;
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    if (testAuction) {
      await db.delete(releaseForms).where(eq(releaseForms.auctionId, testAuction.id));
      await db.delete(auctions).where(eq(auctions.id, testAuction.id));
    }
    if (testCase) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    }
    if (testVendor) {
      await db.delete(vendors).where(eq(vendors.id, testVendor.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  it('should return 0/3 progress when no documents are signed', async () => {
    // Create 3 pending documents
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'pending',
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'pending',
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    // Import the function directly for testing
    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(0);
    expect(progress.progress).toBe(0);
    expect(progress.allSigned).toBe(false);
    expect(progress.documents).toHaveLength(3);
    expect(progress.documents.every(doc => doc.status === 'pending')).toBe(true);
  });

  it('should return 1/3 progress when one document is signed', async () => {
    // Create 3 documents, 1 signed
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'pending',
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(1);
    expect(progress.progress).toBe(33); // 1/3 = 33%
    expect(progress.allSigned).toBe(false);
    expect(progress.documents.filter(doc => doc.status === 'signed')).toHaveLength(1);
  });

  it('should return 2/3 progress when two documents are signed', async () => {
    // Create 3 documents, 2 signed
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(2);
    expect(progress.progress).toBe(67); // 2/3 = 67%
    expect(progress.allSigned).toBe(false);
    expect(progress.documents.filter(doc => doc.status === 'signed')).toHaveLength(2);
  });

  it('should return 3/3 progress when all documents are signed', async () => {
    // Create 3 documents, all signed
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(3);
    expect(progress.progress).toBe(100); // 3/3 = 100%
    expect(progress.allSigned).toBe(true);
    expect(progress.documents.filter(doc => doc.status === 'signed')).toHaveLength(3);
  });

  it('should return correct document details including type and title', async () => {
    // Create 3 documents with different statuses
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Release & Waiver of Liability',
        status: 'pending',
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'voided',
        voidedAt: new Date(),
        voidedBy: testUser.id,
        voidedReason: 'Test void',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.documents).toHaveLength(3);
    
    const billOfSale = progress.documents.find(doc => doc.type === 'bill_of_sale');
    expect(billOfSale).toBeDefined();
    expect(billOfSale?.status).toBe('signed');
    expect(billOfSale?.signedAt).toBeDefined();

    const liabilityWaiver = progress.documents.find(doc => doc.type === 'liability_waiver');
    expect(liabilityWaiver).toBeDefined();
    expect(liabilityWaiver?.status).toBe('pending');
    expect(liabilityWaiver?.signedAt).toBeNull();

    const pickupAuth = progress.documents.find(doc => doc.type === 'pickup_authorization');
    expect(pickupAuth).toBeDefined();
    expect(pickupAuth?.status).toBe('voided');
  });

  it('should handle case with no documents gracefully', async () => {
    // Don't create any documents
    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(0);
    expect(progress.progress).toBe(0);
    expect(progress.allSigned).toBe(false);
    expect(progress.documents).toHaveLength(0);
  });

  it('should only count signed documents, not voided ones', async () => {
    // Create 3 documents: 1 signed, 1 pending, 1 voided
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale.pdf',
        pdfPublicId: 'test_bill_of_sale',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'pending',
        pdfUrl: 'https://example.com/liability_waiver.pdf',
        pdfPublicId: 'test_liability_waiver',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'voided',
        voidedAt: new Date(),
        voidedBy: testUser.id,
        voidedReason: 'Test void',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(1); // Only count signed, not voided
    expect(progress.progress).toBe(33);
    expect(progress.allSigned).toBe(false);
  });
});
