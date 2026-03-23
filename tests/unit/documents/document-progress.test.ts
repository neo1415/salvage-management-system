/**
 * Unit Tests for Document Progress Functions
 * 
 * Tests checkAllDocumentsSigned() and getDocumentProgress() functions
 * to ensure they correctly track document signing status.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkAllDocumentsSigned, getDocumentProgress } from '@/features/documents/services/document.service';
import { db } from '@/lib/db/drizzle';
import type { DocumentType } from '@/lib/db/schema/release-forms';

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Document Progress Functions', () => {
  const mockAuctionId = 'auction-123';
  const mockVendorId = 'vendor-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAllDocumentsSigned', () => {
    it('should return true when all 3 required documents are signed', async () => {
      // Mock database response with all documents signed
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDocuments),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(true);
    });

    it('should return false when only 2 documents are signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDocuments),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });

    it('should return false when only 1 document is signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDocuments),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });

    it('should return false when no documents are signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDocuments),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });

    it('should return false when one document is voided', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'voided',
          signedAt: null,
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'signed',
          signedAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockDocuments),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });

    it('should return false when documents array is empty', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      } as any);

      const result = await checkAllDocumentsSigned(mockAuctionId, mockVendorId);

      expect(result).toBe(false);
    });
  });

  describe('getDocumentProgress', () => {
    it('should return 100% progress when all documents are signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-02'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-03'),
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(3);
      expect(result.progress).toBe(100);
      expect(result.allSigned).toBe(true);
      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].status).toBe('signed');
    });

    it('should return 67% progress when 2 out of 3 documents are signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-02'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(2);
      expect(result.progress).toBe(67); // Math.round((2/3) * 100)
      expect(result.allSigned).toBe(false);
      expect(result.documents).toHaveLength(3);
    });

    it('should return 33% progress when 1 out of 3 documents is signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(1);
      expect(result.progress).toBe(33); // Math.round((1/3) * 100)
      expect(result.allSigned).toBe(false);
    });

    it('should return 0% progress when no documents are signed', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(0);
      expect(result.progress).toBe(0);
      expect(result.allSigned).toBe(false);
      expect(result.documents).toHaveLength(3);
    });

    it('should correctly handle voided documents in progress calculation', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'voided',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(1);
      expect(result.progress).toBe(33);
      expect(result.allSigned).toBe(false);
      expect(result.documents[1].status).toBe('voided');
    });

    it('should return correct document details including signedAt timestamps', async () => {
      const signedDate1 = new Date('2024-01-01T10:00:00Z');
      const signedDate2 = new Date('2024-01-02T11:00:00Z');

      const mockDocuments = [
        {
          id: 'doc-1',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'bill_of_sale' as DocumentType,
          status: 'signed',
          signedAt: signedDate1,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-2',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'liability_waiver' as DocumentType,
          status: 'signed',
          signedAt: signedDate2,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'doc-3',
          auctionId: mockAuctionId,
          vendorId: mockVendorId,
          documentType: 'pickup_authorization' as DocumentType,
          status: 'pending',
          signedAt: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockDocuments),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.documents[0].id).toBe('doc-1');
      expect(result.documents[0].type).toBe('bill_of_sale');
      expect(result.documents[0].signedAt).toEqual(signedDate1);
      expect(result.documents[1].signedAt).toEqual(signedDate2);
      expect(result.documents[2].signedAt).toBeNull();
    });

    it('should throw error when database query fails', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          }),
        }),
      } as any);

      await expect(getDocumentProgress(mockAuctionId, mockVendorId)).rejects.toThrow(
        'Failed to get document progress'
      );
    });

    it('should handle empty documents array', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await getDocumentProgress(mockAuctionId, mockVendorId);

      expect(result.totalDocuments).toBe(3);
      expect(result.signedDocuments).toBe(0);
      expect(result.progress).toBe(0);
      expect(result.allSigned).toBe(false);
      expect(result.documents).toHaveLength(0);
    });
  });
});
