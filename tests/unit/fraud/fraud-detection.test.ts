/**
 * Property-Based Tests for Fraud Detection Service
 * 
 * Property 18: Fraud Detection Pattern Matching
 * Validates: Requirements 34.2-34.4
 * 
 * Tests fraud detection patterns:
 * - Pattern 1: Same IP address bidding against itself in same auction
 * - Pattern 2: Bid >3x previous bid from vendor account <7 days old
 * - Pattern 3: Multiple vendor accounts from same phone/BVN
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fc } from '@fast-check/vitest';
import { fraudDetectionService, FraudPattern } from '@/features/fraud/services/fraud-detection.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

// Mock dependencies
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    query: {
      bids: {
        findMany: vi.fn(),
      },
      vendors: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock('@/lib/utils/audit-logger', () => ({
  logAction: vi.fn(),
  AuditActionType: {
    FRAUD_FLAG_RAISED: 'fraud_flag_raised',
  },
  AuditEntityType: {
    FRAUD_FLAG: 'fraud_flag',
  },
  DeviceType: {
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
    TABLET: 'tablet',
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(),
  },
}));

vi.mock('@/features/notifications/services/push.service', () => ({
  pushService: {
    sendPushNotification: vi.fn(),
  },
}));

describe('Fraud Detection Service - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 18.1: Same IP Address Pattern Detection', () => {
    it('should detect when same IP address bids against itself in same auction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 100000, max: 1000000 }),
          async (ipAddress, auctionId, vendorIds, bidAmount) => {
            // Setup: Multiple vendors bidding from same IP in same auction
            const mockBids = vendorIds.map((vendorId, index) => ({
              id: `bid-${index}`,
              auctionId,
              vendorId,
              amount: (bidAmount + index * 10000).toString(),
              ipAddress,
              deviceType: 'mobile' as const,
              otpVerified: true,
              createdAt: new Date(),
            }));

            vi.mocked(db.query.bids.findMany).mockResolvedValue(mockBids);

            // Test: Check for fraud pattern
            const result = await fraudDetectionService.detectFraud({
              auctionId,
              vendorId: vendorIds[0],
              bidAmount,
              ipAddress,
              userAgent: 'Mozilla/5.0',
            });

            // Verify: Should detect same IP pattern if multiple vendors from same IP
            if (vendorIds.length > 1) {
              expect(result.isSuspicious).toBe(true);
              expect(result.patterns).toContain(FraudPattern.SAME_IP_BIDDING);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18.2: Unusual Bid Pattern Detection', () => {
    it('should detect when new vendor bids >3x previous bid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 100000, max: 500000 }),
          fc.float({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 30 }),
          async (auctionId, vendorId, previousBid, multiplier, accountAgeDays) => {
            // Setup: Vendor account age and bid amounts
            const bidAmount = previousBid * multiplier;
            const accountCreatedAt = new Date();
            accountCreatedAt.setDate(accountCreatedAt.getDate() - accountAgeDays);

            const mockVendor = {
              id: vendorId,
              userId: 'user-123',
              businessName: 'Test Business',
              tier: 'tier1_bvn' as const,
              bvnEncrypted: null,
              bvnVerifiedAt: null,
              cacNumber: null,
              tin: null,
              bankAccountNumber: null,
              bankName: null,
              bankAccountName: null,
              categories: null,
              status: 'approved' as const,
              performanceStats: {
                totalBids: 0,
                totalWins: 0,
                winRate: 0,
                avgPaymentTimeHours: 0,
                onTimePickupRate: 0,
                fraudFlags: 0,
              },
              rating: '0.00',
              cacCertificateUrl: null,
              bankStatementUrl: null,
              ninCardUrl: null,
              ninVerified: null,
              bankAccountVerified: null,
              approvedBy: null,
              approvedAt: null,
              createdAt: accountCreatedAt,
              updatedAt: new Date(),
            };

            vi.mocked(db.query.vendors.findFirst).mockResolvedValue(mockVendor);

            // Test: Check for fraud pattern
            const result = await fraudDetectionService.detectFraud({
              auctionId,
              vendorId,
              bidAmount,
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
              previousBid,
            });

            // Verify: Should detect unusual bid pattern if:
            // - Account is <7 days old AND
            // - Bid is >3x previous bid
            const shouldDetect = accountAgeDays < 7 && multiplier > 3;
            
            if (shouldDetect) {
              expect(result.isSuspicious).toBe(true);
              expect(result.patterns).toContain(FraudPattern.UNUSUAL_BID_PATTERN);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18.3: Duplicate Identity Pattern Detection', () => {
    it('should detect multiple vendor accounts from same phone/BVN', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 11, maxLength: 14 }), // Phone number
          fc.string({ minLength: 11, maxLength: 11 }), // BVN
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          async (vendorId, phone, bvn, duplicateVendorIds) => {
            // Setup: Multiple vendors with same phone or BVN
            const mockVendors = duplicateVendorIds.map((id) => ({
              id,
              userId: `user-${id}`,
              businessName: 'Test Business',
              tier: 'tier1_bvn' as const,
              bvnEncrypted: bvn,
              bvnVerifiedAt: null,
              cacNumber: null,
              tin: null,
              bankAccountNumber: null,
              bankName: null,
              bankAccountName: null,
              categories: null,
              status: 'approved' as const,
              performanceStats: {
                totalBids: 0,
                totalWins: 0,
                winRate: 0,
                avgPaymentTimeHours: 0,
                onTimePickupRate: 0,
                fraudFlags: 0,
              },
              rating: '0.00',
              cacCertificateUrl: null,
              bankStatementUrl: null,
              ninCardUrl: null,
              ninVerified: null,
              bankAccountVerified: null,
              approvedBy: null,
              approvedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            const mockUser = {
              id: 'user-123',
              email: 'test@example.com',
              phone,
              passwordHash: 'hash',
              role: 'vendor' as const,
              status: 'verified_tier_1' as const,
              dateOfBirth: new Date('1990-01-01'),
              fullName: 'Test User',
              isEmailVerified: true,
              isPhoneVerified: true,
              requirePasswordChange: 'false',
              notificationPreferences: {
                pushEnabled: true,
                smsEnabled: true,
                emailEnabled: true,
                bidAlerts: true,
                auctionEnding: true,
                paymentReminders: true,
                leaderboardUpdates: true,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLoginAt: null,
              loginIpAddress: null,
              loginDeviceType: null,
            };

            vi.mocked(db.query.vendors.findMany).mockResolvedValue(mockVendors);
            vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

            // Test: Check for fraud pattern
            const result = await fraudDetectionService.detectFraud({
              auctionId: 'auction-123',
              vendorId,
              bidAmount: 100000,
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
            });

            // Verify: Should detect duplicate identity if multiple vendors found
            if (duplicateVendorIds.length > 1) {
              expect(result.isSuspicious).toBe(true);
              expect(result.patterns).toContain(FraudPattern.DUPLICATE_IDENTITY);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 18.4: Fraud Detection Completeness', () => {
    it('should always return a detection result with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 10000, max: 10000000 }),
          fc.ipV4(),
          fc.string(),
          async (auctionId, vendorId, bidAmount, ipAddress, userAgent) => {
            // Setup: Mock minimal data
            vi.mocked(db.query.bids.findMany).mockResolvedValue([]);
            vi.mocked(db.query.vendors.findFirst).mockResolvedValue({
              id: vendorId,
              userId: 'user-123',
              businessName: 'Test Business',
              tier: 'tier1_bvn' as const,
              bvnEncrypted: null,
              bvnVerifiedAt: null,
              cacNumber: null,
              tin: null,
              bankAccountNumber: null,
              bankName: null,
              bankAccountName: null,
              categories: null,
              status: 'approved' as const,
              performanceStats: {
                totalBids: 0,
                totalWins: 0,
                winRate: 0,
                avgPaymentTimeHours: 0,
                onTimePickupRate: 0,
                fraudFlags: 0,
              },
              rating: '0.00',
              cacCertificateUrl: null,
              bankStatementUrl: null,
              ninCardUrl: null,
              ninVerified: null,
              bankAccountVerified: null,
              approvedBy: null,
              approvedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            vi.mocked(db.query.vendors.findMany).mockResolvedValue([]);

            // Test: Check for fraud pattern
            const result = await fraudDetectionService.detectFraud({
              auctionId,
              vendorId,
              bidAmount,
              ipAddress,
              userAgent,
            });

            // Verify: Result always has required fields
            expect(result).toHaveProperty('isSuspicious');
            expect(result).toHaveProperty('patterns');
            expect(Array.isArray(result.patterns)).toBe(true);
            expect(typeof result.isSuspicious).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18.5: No False Positives for Legitimate Bids', () => {
    it('should not flag legitimate bids as suspicious', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 100000, max: 500000 }),
          fc.ipV4(),
          fc.integer({ min: 30, max: 365 }),
          async (auctionId, vendorId, bidAmount, ipAddress, accountAgeDays) => {
            // Setup: Legitimate bid scenario
            // - Unique IP address
            // - Account >7 days old
            // - Bid <3x previous bid
            const previousBid = bidAmount * 0.9; // Only 10% increase
            const accountCreatedAt = new Date();
            accountCreatedAt.setDate(accountCreatedAt.getDate() - accountAgeDays);

            vi.mocked(db.query.bids.findMany).mockResolvedValue([
              {
                id: 'bid-1',
                auctionId,
                vendorId: 'other-vendor',
                amount: previousBid.toString(),
                ipAddress: '10.0.0.1', // Different IP
                deviceType: 'mobile' as const,
                otpVerified: true,
                createdAt: new Date(),
              },
            ]);

            vi.mocked(db.query.vendors.findFirst).mockResolvedValue({
              id: vendorId,
              userId: 'user-123',
              businessName: 'Test Business',
              tier: 'tier2_full' as const,
              bvnEncrypted: null,
              bvnVerifiedAt: null,
              cacNumber: null,
              tin: null,
              bankAccountNumber: null,
              bankName: null,
              bankAccountName: null,
              categories: null,
              status: 'approved' as const,
              performanceStats: {
                totalBids: 10,
                totalWins: 5,
                winRate: 50,
                avgPaymentTimeHours: 4,
                onTimePickupRate: 100,
                fraudFlags: 0,
              },
              rating: '0.00',
              cacCertificateUrl: null,
              bankStatementUrl: null,
              ninCardUrl: null,
              ninVerified: null,
              bankAccountVerified: null,
              approvedBy: null,
              approvedAt: null,
              createdAt: accountCreatedAt,
              updatedAt: new Date(),
            });

            vi.mocked(db.query.vendors.findMany).mockResolvedValue([]);

            // Test: Check for fraud pattern
            const result = await fraudDetectionService.detectFraud({
              auctionId,
              vendorId,
              bidAmount,
              ipAddress,
              userAgent: 'Mozilla/5.0',
              previousBid,
            });

            // Verify: Should not flag legitimate bids
            // Account is old, bid is reasonable, unique IP
            expect(result.isSuspicious).toBe(false);
            expect(result.patterns).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
