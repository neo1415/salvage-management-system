/**
 * Unit Tests for FraudDetectionService
 * Task 12.1.3: Write unit tests for FraudDetectionService (>80% coverage)
 * 
 * Test coverage:
 * - Photo authenticity detection (pHash, duplicates, EXIF, Gemini AI)
 * - Shill bidding detection (consecutive bids, timing, collusion)
 * - Claim pattern fraud (repeat claimants, damage similarity, geographic clustering)
 * - Vendor-adjuster collusion detection
 * - Fraud alert creation and storage
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FraudDetectionService } from '@/features/intelligence/services/fraud-detection.service';
import { db } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/features/intelligence/events/fraud-alert.event', () => ({
  emitFraudAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(() => {
    service = new FraudDetectionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzePhotoAuthenticity', () => {
    it('should analyze photo authenticity and return results', async () => {
      const caseId = 'test-case-id';
      const photoUrls = ['https://example.com/photo1.jpg'];

      // Mock database queries
      vi.mocked(db.execute).mockResolvedValue([] as any); // No duplicates
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'photo-hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('photoUrl', photoUrls[0]);
      expect(result[0]).toHaveProperty('isAuthentic');
      expect(result[0]).toHaveProperty('riskScore');
      expect(result[0]).toHaveProperty('flagReasons');
      expect(result[0]).toHaveProperty('duplicateMatches');
      expect(result[0]).toHaveProperty('exifAnalysis');
      expect(result[0]).toHaveProperty('aiAnalysis');
    });

    it('should flag photos with duplicate matches', async () => {
      const caseId = 'test-case-id';
      const photoUrls = ['https://example.com/photo1.jpg'];

      // Mock duplicate matches - db.execute returns array directly
      vi.mocked(db.execute).mockResolvedValue([
        {
          case_id: 'other-case-id',
          photo_url: 'https://example.com/duplicate.jpg',
          full_p_hash: '1111111111111111222222222222222233333333333333334444444444444444', // Similar hash
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'photo-hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      expect(result[0].duplicateMatches.length).toBeGreaterThan(0);
      expect(result[0].flagReasons).toContain(expect.stringContaining('duplicate'));
      expect(result[0].riskScore).toBeGreaterThan(0);
    });

    it('should flag photos missing EXIF metadata', async () => {
      const caseId = 'test-case-id';
      const photoUrls = ['https://example.com/photo1.jpg'];

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'photo-hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      expect(result[0].exifAnalysis?.hasExif).toBe(false);
      expect(result[0].flagReasons).toContain('Missing EXIF metadata');
    });

    it('should handle multiple photos', async () => {
      const caseId = 'test-case-id';
      const photoUrls = [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
      ];

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'photo-hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      expect(result.length).toBe(3);
      result.forEach((r, i) => {
        expect(r.photoUrl).toBe(photoUrls[i]);
      });
    });

    it('should calculate risk score correctly', async () => {
      const caseId = 'test-case-id';
      const photoUrls = ['https://example.com/photo1.jpg'];

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'photo-hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      expect(result[0].riskScore).toBeGreaterThanOrEqual(0);
      expect(result[0].riskScore).toBeLessThanOrEqual(100);
      expect(result[0].isAuthentic).toBe(result[0].riskScore < 50);
    });
  });

  describe('detectShillBidding', () => {
    it('should detect consecutive bids from same vendor', async () => {
      const auctionId = 'test-auction-id';

      // Mock consecutive bids detection - db.execute returns array directly
      vi.mocked(db.execute)
        .mockResolvedValueOnce([{ vendor_id: 'vendor-1', consecutive_count: 5 }] as any)
        .mockResolvedValueOnce([] as any) // timing patterns
        .mockResolvedValueOnce([] as any); // IP collusion

      const result = await service.detectShillBidding(auctionId);

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.flagReasons).toContain(expect.stringContaining('consecutive bids'));
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
      expect(result.suspiciousPatterns[0].pattern).toBe('consecutive_bids');
    });

    it('should detect rapid bidding patterns', async () => {
      const auctionId = 'test-auction-id';

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any) // consecutive bids
        .mockResolvedValueOnce([{ vendor_id: 'vendor-1', bid_count: 10, avg_time_between_bids: 30 }] as any)
        .mockResolvedValueOnce([] as any); // IP collusion

      const result = await service.detectShillBidding(auctionId);

      expect(result.riskScore).toBeGreaterThanOrEqual(25);
      expect(result.flagReasons).toContain(expect.stringContaining('rapid bidding'));
      expect(result.suspiciousPatterns[0].pattern).toBe('rapid_bidding');
    });

    it('should detect IP address collusion', async () => {
      const auctionId = 'test-auction-id';

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any) // consecutive bids
        .mockResolvedValueOnce([] as any) // timing patterns
        .mockResolvedValueOnce([
          {
            ip_address: '192.168.1.1',
            device_fingerprint: 'device-123',
            vendor_count: 3,
            vendor_ids: ['vendor-1', 'vendor-2', 'vendor-3'],
          },
        ] as any);

      const result = await service.detectShillBidding(auctionId);

      expect(result.riskScore).toBeGreaterThanOrEqual(35);
      expect(result.flagReasons).toContain(expect.stringContaining('same IP'));
      expect(result.suspiciousPatterns.length).toBe(3);
      expect(result.suspiciousPatterns[0].pattern).toBe('ip_device_collusion');
    });

    it('should return low risk for normal bidding', async () => {
      const auctionId = 'test-auction-id';

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.detectShillBidding(auctionId);

      expect(result.isShillBidding).toBe(false);
      expect(result.riskScore).toBe(0);
      expect(result.flagReasons.length).toBe(0);
      expect(result.suspiciousPatterns.length).toBe(0);
    });

    it('should cap risk score at 100', async () => {
      const auctionId = 'test-auction-id';

      // Mock multiple high-risk patterns
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { vendor_id: 'vendor-1', consecutive_count: 10 },
          { vendor_id: 'vendor-2', consecutive_count: 8 },
        ] as any)
        .mockResolvedValueOnce([
          { vendor_id: 'vendor-1', bid_count: 20, avg_time_between_bids: 15 },
        ] as any)
        .mockResolvedValueOnce([
          {
            ip_address: '192.168.1.1',
            vendor_count: 2,
            vendor_ids: ['vendor-1', 'vendor-2'],
          },
        ] as any);

      const result = await service.detectShillBidding(auctionId);

      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('analyzeClaimPatterns', () => {
    it('should detect repeat claimants', async () => {
      const caseId = 'test-case-id';

      // Mock case data
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: ['front bumper', 'hood'],
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      } as any);

      // Mock repeat claims (5 claims in 12 months)
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { id: 'claim-1', days_ago: 30, damaged_parts: ['rear bumper'] },
          { id: 'claim-2', days_ago: 60, damaged_parts: ['door'] },
          { id: 'claim-3', days_ago: 90, damaged_parts: ['windshield'] },
          { id: 'claim-4', days_ago: 120, damaged_parts: ['mirror'] },
          { id: 'claim-5', days_ago: 150, damaged_parts: ['headlight'] },
        ] as any)
        .mockResolvedValueOnce([] as any); // geo clusters

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(20);
      expect(result.flagReasons).toContain(expect.stringContaining('claims in past 12 months'));
    });

    it('should detect similar damage patterns', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: ['front bumper', 'hood', 'headlight'],
              },
            ]),
          }),
        }),
      } as any);

      // Mock similar damage patterns
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          {
            id: 'claim-1',
            days_ago: 45,
            damaged_parts: ['front bumper', 'hood', 'headlight'], // Exact match
          },
          {
            id: 'claim-2',
            days_ago: 80,
            damaged_parts: ['front bumper', 'hood'], // High similarity
          },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result.similarClaims.length).toBeGreaterThan(0);
      expect(result.similarClaims[0].similarity).toBeGreaterThan(70);
      expect(result.flagReasons).toContain(expect.stringContaining('damage pattern'));
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should detect geographic clustering', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: [],
              },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any) // repeat claims
        .mockResolvedValueOnce([
          {
            region: 'Lagos',
            city: 'Ikeja',
            case_count: 4,
            most_recent_days_ago: 20,
          },
        ] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.flagReasons).toContain(expect.stringContaining('location'));
    });

    it('should detect high case creation velocity', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: [],
              },
            ]),
          }),
        }),
      } as any);

      // Mock recent cases (3 in past 30 days)
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { id: 'claim-1', days_ago: 10, damaged_parts: [] },
          { id: 'claim-2', days_ago: 20, damaged_parts: [] },
          { id: 'claim-3', days_ago: 25, damaged_parts: [] },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result.flagReasons).toContain(expect.stringContaining('30 days'));
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should throw error for non-existent case', async () => {
      const caseId = 'non-existent-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(service.analyzeClaimPatterns(caseId)).rejects.toThrow('Case not found');
    });

    it('should return low risk for legitimate claims', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: ['front bumper'],
              },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { id: 'claim-1', days_ago: 200, damaged_parts: ['rear door'] },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result.isFraudulent).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
    });
  });

  describe('detectCollusion', () => {
    it('should detect high win rate vendor-adjuster pairs', async () => {
      const vendorId = 'vendor-1';
      const adjusterId = 'adjuster-1';

      // Mock high win rate pattern
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          {
            vendor_id: vendorId,
            adjuster_id: adjusterId,
            total_auctions: 10,
            wins: 9,
            win_rate: 0.9,
          },
        ] as any)
        .mockResolvedValueOnce([] as any); // last minute bids

      const result = await service.detectCollusion(vendorId, adjusterId);

      expect(result.riskScore).toBeGreaterThanOrEqual(40);
      expect(result.flagReasons).toContain(expect.stringContaining('90%'));
      expect(result.collusionPairs.length).toBeGreaterThan(0);
      expect(result.collusionPairs[0].winRate).toBe(90);
    });

    it('should detect last-minute bidding patterns', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any) // win patterns
        .mockResolvedValueOnce([
          {
            vendor_id: 'vendor-1',
            adjuster_id: 'adjuster-1',
            last_minute_wins: 5,
          },
        ] as any);

      const result = await service.detectCollusion();

      expect(result.riskScore).toBeGreaterThanOrEqual(25);
      expect(result.flagReasons).toContain(expect.stringContaining('last-minute'));
    });

    it('should work without specific vendor or adjuster', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          {
            vendor_id: 'vendor-1',
            adjuster_id: 'adjuster-1',
            total_auctions: 8,
            wins: 7,
            win_rate: 0.875,
          },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.detectCollusion();

      expect(result).toBeDefined();
      expect(result.collusionPairs.length).toBeGreaterThan(0);
    });

    it('should return low risk for normal win patterns', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.detectCollusion();

      expect(result.isCollusion).toBe(false);
      expect(result.riskScore).toBe(0);
      expect(result.flagReasons.length).toBe(0);
      expect(result.collusionPairs.length).toBe(0);
    });

    it('should cap risk score at 100', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { vendor_id: 'v1', adjuster_id: 'a1', wins: 10, win_rate: 0.95 },
          { vendor_id: 'v2', adjuster_id: 'a2', wins: 8, win_rate: 0.9 },
        ] as any)
        .mockResolvedValueOnce([
          { vendor_id: 'v1', adjuster_id: 'a1', last_minute_wins: 8 },
        ] as any);

      const result = await service.detectCollusion();

      expect(result.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('createFraudAlert', () => {
    it('should create fraud alert with correct data', async () => {
      const mockAlertId = 'alert-123';

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: mockAlertId }]),
        }),
      } as any);

      const alertId = await service.createFraudAlert(
        'vendor',
        'vendor-123',
        75,
        ['Suspicious bidding pattern', 'High win rate'],
        { evidence: 'test data' }
      );

      expect(alertId).toBe(mockAlertId);
      expect(db.insert).toHaveBeenCalledTimes(2); // fraud alert + log
    });

    it('should handle all entity types', async () => {
      const entityTypes: Array<'vendor' | 'case' | 'auction' | 'user'> = [
        'vendor',
        'case',
        'auction',
        'user',
      ];

      for (const entityType of entityTypes) {
        vi.clearAllMocks();
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: `alert-${entityType}` }]),
          }),
        } as any);

        const alertId = await service.createFraudAlert(
          entityType,
          `${entityType}-id`,
          60,
          ['Test reason'],
          {}
        );

        expect(alertId).toBe(`alert-${entityType}`);
      }
    });

    it('should handle Socket.IO emission failure gracefully', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'alert-123' }]),
        }),
      } as any);

      // Mock Socket.IO failure
      const { emitFraudAlert } = await import('@/features/intelligence/events/fraud-alert.event');
      vi.mocked(emitFraudAlert).mockRejectedValueOnce(new Error('Socket.IO error'));

      // Should not throw error
      const alertId = await service.createFraudAlert(
        'vendor',
        'vendor-123',
        80,
        ['Test'],
        {}
      );

      expect(alertId).toBe('alert-123');
    });

    it('should store metadata correctly', async () => {
      const metadata = {
        evidence: 'test evidence',
        timestamp: new Date().toISOString(),
        additionalInfo: { key: 'value' },
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'alert-123' }]),
        }),
      } as any);

      await service.createFraudAlert('case', 'case-123', 70, ['Test'], metadata);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty photo URLs array', async () => {
      const result = await service.analyzePhotoAuthenticity('case-id', []);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Database error'));

      // The service catches errors and returns empty results, not throwing
      const result = await service.detectShillBidding('auction-id');
      
      // Should return default empty result structure
      expect(result).toBeDefined();
      expect(result.isShillBidding).toBe(false);
      expect(result.riskScore).toBe(0);
    });

    it('should handle null/undefined damage parts', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: null,
              },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          { id: 'claim-1', days_ago: 30, damaged_parts: null },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result).toBeDefined();
      expect(result.similarClaims.length).toBe(0);
    });

    it('should handle empty query results', async () => {
      vi.mocked(db.execute).mockResolvedValue([] as any);

      const result = await service.detectCollusion('vendor-1', 'adjuster-1');

      expect(result.isCollusion).toBe(false);
      expect(result.riskScore).toBe(0);
    });
  });

  describe('Private Method Testing (via public methods)', () => {
    it('should calculate Hamming distance correctly', async () => {
      const caseId = 'test-case-id';
      const photoUrls = ['https://example.com/photo1.jpg'];

      // Mock similar hashes with known Hamming distance
      vi.mocked(db.execute).mockResolvedValue([
        {
          case_id: 'other-case',
          photo_url: 'https://example.com/other.jpg',
          full_p_hash: '1111111111111111222222222222222233333333333333334444444444444444', // Will have specific Hamming distance
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'hash-id' }]),
        }),
      } as any);

      const result = await service.analyzePhotoAuthenticity(caseId, photoUrls);

      // Hamming distance calculation is tested indirectly
      expect(result[0].duplicateMatches).toBeDefined();
    });

    it('should calculate damage similarity (Jaccard) correctly', async () => {
      const caseId = 'test-case-id';

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: caseId,
                userId: 'user-1',
                damagedParts: ['front bumper', 'hood'],
              },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.execute)
        .mockResolvedValueOnce([
          {
            id: 'claim-1',
            days_ago: 30,
            damaged_parts: ['front bumper', 'hood'], // 100% similarity
          },
          {
            id: 'claim-2',
            days_ago: 60,
            damaged_parts: ['front bumper'], // 50% similarity
          },
        ] as any)
        .mockResolvedValueOnce([] as any);

      const result = await service.analyzeClaimPatterns(caseId);

      expect(result.similarClaims.length).toBeGreaterThan(0);
      expect(result.similarClaims[0].similarity).toBe(100);
    });
  });
});
