/**
 * Unit tests for Auction Creation Service
 * Tests the createAuction method and vendor notification logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuctionService } from '@/features/auctions/services/auction.service';
import { db } from '@/lib/db/drizzle';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import * as auditLogger from '@/lib/utils/audit-logger';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    query: {
      salvageCases: {
        findFirst: vi.fn(),
      },
      auctions: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    AUCTION_CREATED: 'auction_created',
  },
  AuditEntityType: {
    AUCTION: 'auction',
  },
  DeviceType: {
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
    TABLET: 'tablet',
  },
}));

describe('AuctionService', () => {
  let auctionService: AuctionService;

  beforeEach(() => {
    auctionService = new AuctionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAuction', () => {
    it('should create auction with correct parameters', async () => {
      // Mock salvage case
      const mockCase = {
        id: 'case-123',
        claimReference: 'CLM-001',
        assetType: 'vehicle' as const,
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
        marketValue: '5000000',
        estimatedSalvageValue: '2000000',
        reservePrice: '1400000',
        damageSeverity: 'moderate' as const,
        aiAssessment: {
          labels: ['Front damage'],
          confidenceScore: 85,
          damagePercentage: 40,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792] as [number, number],
        locationName: 'Lagos, Nigeria',
        photos: ['photo1.jpg'],
        voiceNotes: [],
        status: 'approved' as const,
        createdBy: 'user-123',
        approvedBy: 'manager-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: new Date(),
      };

      // Mock no existing auction
      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);
      vi.mocked(db.query.auctions.findFirst).mockResolvedValue(undefined);

      // Mock auction creation
      const mockAuction = {
        id: 'auction-123',
        caseId: 'case-123',
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        extensionCount: 0,
        currentBid: null,
        currentBidder: null,
        minimumIncrement: '10000.00',
        status: 'active',
        watchingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAuction]),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Mock vendor selection
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      // Execute
      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.auction).toBeDefined();
      expect(result.auction?.id).toBe('auction-123');
      expect(result.auction?.caseId).toBe('case-123');
      expect(result.auction?.minimumIncrement).toBe('10000.00');
      expect(result.auction?.status).toBe('active');

      // Verify audit log was created
      expect(auditLogger.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'manager-123',
          actionType: 'auction_created',
          entityType: 'auction',
          entityId: 'auction-123',
        })
      );
    });

    it('should reject if case ID is missing', async () => {
      const result = await auctionService.createAuction({
        caseId: '',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Case ID and creator ID are required');
    });

    it('should reject if case not found', async () => {
      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(undefined);

      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Salvage case not found');
    });

    it('should reject if case is not approved', async () => {
      const mockCase = {
        id: 'case-123',
        status: 'pending_approval' as const,
      } as any;

      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);

      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Case must be approved before creating auction');
    });

    it('should reject if auction already exists for case', async () => {
      const mockCase = {
        id: 'case-123',
        status: 'approved' as const,
      } as any;

      const mockExistingAuction = {
        id: 'auction-existing',
        caseId: 'case-123',
      };

      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);
      vi.mocked(db.query.auctions.findFirst).mockResolvedValue(mockExistingAuction as any);

      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Auction already exists for this case');
    });

    it('should set auction end time to 5 days from now', async () => {
      const mockCase = {
        id: 'case-123',
        status: 'approved' as const,
        assetType: 'vehicle' as const,
        assetDetails: {},
        reservePrice: '1000000',
        locationName: 'Lagos',
        damageSeverity: 'moderate' as const,
      } as any;

      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);
      vi.mocked(db.query.auctions.findFirst).mockResolvedValue(undefined);

      const now = new Date();
      const expectedEndTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const mockAuction = {
        id: 'auction-123',
        caseId: 'case-123',
        startTime: now,
        endTime: expectedEndTime,
        originalEndTime: expectedEndTime,
        minimumIncrement: '10000.00',
        status: 'active',
      } as any;

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAuction]),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(true);
      
      // Verify end time is approximately 5 days from start time
      const startTime = result.auction!.startTime;
      const endTime = result.auction!.endTime;
      const diffInDays = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(diffInDays).toBeCloseTo(5, 0);
    });

    it('should set minimum increment to ₦10,000', async () => {
      const mockCase = {
        id: 'case-123',
        status: 'approved' as const,
        assetType: 'vehicle' as const,
        assetDetails: {},
        reservePrice: '1000000',
        locationName: 'Lagos',
        damageSeverity: 'moderate' as const,
      } as any;

      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);
      vi.mocked(db.query.auctions.findFirst).mockResolvedValue(undefined);

      const mockAuction = {
        id: 'auction-123',
        caseId: 'case-123',
        startTime: new Date(),
        endTime: new Date(),
        originalEndTime: new Date(),
        minimumIncrement: '10000.00',
        status: 'active',
      } as any;

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAuction]),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      expect(result.success).toBe(true);
      expect(result.auction?.minimumIncrement).toBe('10000.00');
    });

    it('should update case status to active_auction', async () => {
      const mockCase = {
        id: 'case-123',
        status: 'approved' as const,
        assetType: 'vehicle' as const,
        assetDetails: {},
        reservePrice: '1000000',
        locationName: 'Lagos',
        damageSeverity: 'moderate' as const,
      } as any;

      vi.mocked(db.query.salvageCases.findFirst).mockResolvedValue(mockCase);
      vi.mocked(db.query.auctions.findFirst).mockResolvedValue(undefined);

      const mockAuction = {
        id: 'auction-123',
        caseId: 'case-123',
        startTime: new Date(),
        endTime: new Date(),
        originalEndTime: new Date(),
        minimumIncrement: '10000.00',
        status: 'active',
      } as any;

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAuction]),
        }),
      } as any);

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate,
        }),
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await auctionService.createAuction({
        caseId: 'case-123',
        createdBy: 'manager-123',
      });

      // Verify update was called
      expect(db.update).toHaveBeenCalled();
    });
  });
});
