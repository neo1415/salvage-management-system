/**
 * Integration Tests: Documents Page with Progress Component
 * 
 * Tests the vendor documents page integration with DocumentSigningProgress component:
 * - Progress component displays when auctionId is provided
 * - Progress updates after document signing
 * - Component shows correct document statuses
 * - Handles loading and error states
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, sql } from 'drizzle-orm';

describe('Documents Page Integration Tests', () => {
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
        phone: `+234801234${Math.floor(Math.random() * 10000)}`,
        passwordHash: '$2a$10$dummyhashfortest1234567890123456789012345678901234567890',
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
        gpsLocation: sql`point(6.5244, 3.3792)`,
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: 5000000,
        estimatedSalvageValue: 1500000,
        reservePrice: 1000000,
        photos: ['https://example.com/photo1.jpg'],
        status: 'approved',
        createdBy: testUser.id,
      })
      .returning();
    testCase = salvageCase;

    // Create test auction
    const endTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        title: 'Test Auction',
        startingBid: 100000,
        currentBid: 150000,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: endTime,
        originalEndTime: endTime,
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

  it('should fetch document progress when auctionId is provided', async () => {
    // Create 3 documents with mixed statuses
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
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    // Verify progress data structure matches component props
    expect(progress).toHaveProperty('totalDocuments');
    expect(progress).toHaveProperty('signedDocuments');
    expect(progress).toHaveProperty('progress');
    expect(progress).toHaveProperty('allSigned');
    expect(progress).toHaveProperty('documents');

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(1);
    expect(progress.progress).toBe(33);
    expect(progress.allSigned).toBe(false);
    expect(progress.documents).toHaveLength(3);
  });

  it('should update progress after document signing', async () => {
    // Create 3 pending documents
    const [doc1, doc2, doc3] = await db.insert(releaseForms).values([
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
        status: 'pending',
        pdfUrl: 'https://example.com/pickup_authorization.pdf',
        pdfPublicId: 'test_pickup_authorization',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]).returning();

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');

    // Initial progress: 0/3
    let progress = await getDocumentProgress(testAuction.id, testVendor.id);
    expect(progress.signedDocuments).toBe(0);
    expect(progress.progress).toBe(0);

    // Sign first document
    await db
      .update(releaseForms)
      .set({ status: 'signed', signedAt: new Date() })
      .where(eq(releaseForms.id, doc1.id));

    // Progress should be 1/3
    progress = await getDocumentProgress(testAuction.id, testVendor.id);
    expect(progress.signedDocuments).toBe(1);
    expect(progress.progress).toBe(33);
    expect(progress.allSigned).toBe(false);

    // Sign second document
    await db
      .update(releaseForms)
      .set({ status: 'signed', signedAt: new Date() })
      .where(eq(releaseForms.id, doc2.id));

    // Progress should be 2/3
    progress = await getDocumentProgress(testAuction.id, testVendor.id);
    expect(progress.signedDocuments).toBe(2);
    expect(progress.progress).toBe(67);
    expect(progress.allSigned).toBe(false);

    // Sign third document
    await db
      .update(releaseForms)
      .set({ status: 'signed', signedAt: new Date() })
      .where(eq(releaseForms.id, doc3.id));

    // Progress should be 3/3
    progress = await getDocumentProgress(testAuction.id, testVendor.id);
    expect(progress.signedDocuments).toBe(3);
    expect(progress.progress).toBe(100);
    expect(progress.allSigned).toBe(true);
  });

  it('should provide correct document data for progress component', async () => {
    // Create documents with different statuses
    await db.insert(releaseForms).values([
      {
        auctionId: testAuction.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date('2024-01-15T10:00:00Z'),
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

    // Verify document structure matches component expectations
    expect(progress.documents).toHaveLength(3);
    
    progress.documents.forEach(doc => {
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('type');
      expect(doc).toHaveProperty('status');
      expect(doc).toHaveProperty('signedAt');
      
      // Verify status is one of the expected values
      expect(['pending', 'signed', 'voided']).toContain(doc.status);
      
      // Verify type is one of the expected document types
      expect(['bill_of_sale', 'liability_waiver', 'pickup_authorization']).toContain(doc.type);
    });

    // Verify signed document has signedAt timestamp
    const signedDoc = progress.documents.find(doc => doc.status === 'signed');
    expect(signedDoc?.signedAt).toBeDefined();
    expect(signedDoc?.signedAt).not.toBeNull();

    // Verify pending document has null signedAt
    const pendingDoc = progress.documents.find(doc => doc.status === 'pending');
    expect(pendingDoc?.signedAt).toBeNull();
  });

  it('should handle multiple auctions for same vendor', async () => {
    // Create second auction
    const endTime2 = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const [auction2] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        title: 'Test Auction 2',
        startingBid: 100000,
        currentBid: 200000,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: endTime2,
        originalEndTime: endTime2,
        status: 'closed',
        winnerId: testVendor.id,
        createdBy: testUser.id,
      })
      .returning();

    // Create documents for first auction (1 signed)
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

    // Create documents for second auction (all signed)
    await db.insert(releaseForms).values([
      {
        auctionId: auction2.id,
        vendorId: testVendor.id,
        documentType: 'bill_of_sale',
        title: 'Bill of Sale',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/bill_of_sale2.pdf',
        pdfPublicId: 'test_bill_of_sale2',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: auction2.id,
        vendorId: testVendor.id,
        documentType: 'liability_waiver',
        title: 'Liability Waiver',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/liability_waiver2.pdf',
        pdfPublicId: 'test_liability_waiver2',
        documentData: {},
        generatedBy: testUser.id,
      },
      {
        auctionId: auction2.id,
        vendorId: testVendor.id,
        documentType: 'pickup_authorization',
        title: 'Pickup Authorization',
        status: 'signed',
        signedAt: new Date(),
        pdfUrl: 'https://example.com/pickup_authorization2.pdf',
        pdfPublicId: 'test_pickup_authorization2',
        documentData: {},
        generatedBy: testUser.id,
      },
    ]);

    const { getDocumentProgress } = await import('@/features/documents/services/document.service');

    // Verify first auction progress (1/3)
    const progress1 = await getDocumentProgress(testAuction.id, testVendor.id);
    expect(progress1.signedDocuments).toBe(1);
    expect(progress1.progress).toBe(33);
    expect(progress1.allSigned).toBe(false);

    // Verify second auction progress (3/3)
    const progress2 = await getDocumentProgress(auction2.id, testVendor.id);
    expect(progress2.signedDocuments).toBe(3);
    expect(progress2.progress).toBe(100);
    expect(progress2.allSigned).toBe(true);

    // Cleanup second auction
    await db.delete(releaseForms).where(eq(releaseForms.auctionId, auction2.id));
    await db.delete(auctions).where(eq(auctions.id, auction2.id));
  });

  it('should return empty documents array when no documents exist', async () => {
    // Don't create any documents
    const { getDocumentProgress } = await import('@/features/documents/services/document.service');
    const progress = await getDocumentProgress(testAuction.id, testVendor.id);

    expect(progress.totalDocuments).toBe(3);
    expect(progress.signedDocuments).toBe(0);
    expect(progress.progress).toBe(0);
    expect(progress.allSigned).toBe(false);
    expect(progress.documents).toHaveLength(0);
  });
});
