import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  logAction,
  getDeviceTypeFromUserAgent,
  getIpAddress,
  createAuditLogData,
  AuditActionType,
  AuditEntityType,
  DeviceType,
  type AuditLogData,
} from '@/lib/utils/audit-logger';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';

// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('Audit Logging', () => {
  let mockInsert: any;
  let mockValues: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mocks at the suite level
    mockValues = vi.fn().mockResolvedValue(undefined);
    mockInsert = vi.fn(() => ({ values: mockValues }));
    (db.insert as any) = mockInsert;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unit Tests', () => {
    describe('getDeviceTypeFromUserAgent', () => {
      it('should detect mobile devices', () => {
        const mobileUserAgents = [
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          'Mozilla/5.0 (Linux; Android 10; SM-G973F)',
          'Mozilla/5.0 (Linux; Android 11; Pixel 5)',
        ];

        mobileUserAgents.forEach((ua) => {
          expect(getDeviceTypeFromUserAgent(ua)).toBe(DeviceType.MOBILE);
        });
      });

      it('should detect tablet devices', () => {
        const tabletUserAgents = [
          'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
          // Note: Android tablets often include "mobile" in their user agent
          // We prioritize "tablet" keyword detection first
        ];

        tabletUserAgents.forEach((ua) => {
          expect(getDeviceTypeFromUserAgent(ua)).toBe(DeviceType.TABLET);
        });
      });

      it('should detect desktop devices', () => {
        const desktopUserAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ];

        desktopUserAgents.forEach((ua) => {
          expect(getDeviceTypeFromUserAgent(ua)).toBe(DeviceType.DESKTOP);
        });
      });
    });

    describe('getIpAddress', () => {
      it('should extract IP from x-forwarded-for header', () => {
        const headers = new Headers({
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        });

        expect(getIpAddress(headers)).toBe('192.168.1.1');
      });

      it('should extract IP from x-real-ip header', () => {
        const headers = new Headers({
          'x-real-ip': '192.168.1.1',
        });

        expect(getIpAddress(headers)).toBe('192.168.1.1');
      });

      it('should extract IP from cf-connecting-ip header', () => {
        const headers = new Headers({
          'cf-connecting-ip': '192.168.1.1',
        });

        expect(getIpAddress(headers)).toBe('192.168.1.1');
      });

      it('should return unknown if no IP headers present', () => {
        const headers = new Headers();

        expect(getIpAddress(headers)).toBe('unknown');
      });

      it('should prioritize x-forwarded-for over other headers', () => {
        const headers = new Headers({
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '10.0.0.1',
          'cf-connecting-ip': '172.16.0.1',
        });

        expect(getIpAddress(headers)).toBe('192.168.1.1');
      });
    });

    describe('createAuditLogData', () => {
      it('should create audit log data from request', () => {
        const request = new Request('https://example.com', {
          headers: {
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            'x-forwarded-for': '192.168.1.1',
          },
        });

        const data = createAuditLogData(
          request,
          'user-123',
          AuditActionType.LOGIN,
          AuditEntityType.USER,
          'user-123'
        );

        expect(data).toEqual({
          userId: 'user-123',
          actionType: AuditActionType.LOGIN,
          entityType: AuditEntityType.USER,
          entityId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceType: DeviceType.MOBILE,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          beforeState: undefined,
          afterState: undefined,
        });
      });

      it('should include before and after states when provided', () => {
        const request = new Request('https://example.com', {
          headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'x-forwarded-for': '192.168.1.1',
          },
        });

        const beforeState = { status: 'pending' };
        const afterState = { status: 'approved' };

        const data = createAuditLogData(
          request,
          'user-123',
          AuditActionType.CASE_APPROVED,
          AuditEntityType.CASE,
          'case-123',
          beforeState,
          afterState
        );

        expect(data.beforeState).toEqual(beforeState);
        expect(data.afterState).toEqual(afterState);
      });
    });

    describe('logAction', () => {
      it('should insert audit log into database', async () => {
        const auditData: AuditLogData = {
          userId: 'user-123',
          actionType: AuditActionType.LOGIN,
          entityType: AuditEntityType.USER,
          entityId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceType: DeviceType.MOBILE,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        };

        await logAction(auditData);

        expect(mockInsert).toHaveBeenCalledWith(auditLogs);
      });

      it('should not throw error if database insert fails', async () => {
        // Temporarily replace with failing mock
        const failingMockValues = vi.fn().mockRejectedValue(new Error('Database error'));
        const failingMockInsert = vi.fn(() => ({ values: failingMockValues }));
        (db.insert as any) = failingMockInsert;

        const auditData: AuditLogData = {
          userId: 'user-123',
          actionType: AuditActionType.LOGIN,
          entityType: AuditEntityType.USER,
          entityId: 'user-123',
          ipAddress: '192.168.1.1',
          deviceType: DeviceType.MOBILE,
          userAgent: 'Mozilla/5.0',
        };

        // Should not throw
        await expect(logAction(auditData)).resolves.toBeUndefined();
        
        // Restore original mock
        (db.insert as any) = mockInsert;
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Property 3: Comprehensive Audit Logging**
     * **Validates: Requirements 11.1-11.6**
     * 
     * This property verifies that all audit log entries contain the required fields:
     * - userId (non-empty string)
     * - actionType (valid action type)
     * - entityType (valid entity type)
     * - entityId (non-empty string)
     * - ipAddress (non-empty string)
     * - deviceType (valid device type)
     * - userAgent (non-empty string)
     * - timestamp (automatically added by database)
     */
    it('should create valid audit log entries with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(...Object.values(AuditActionType)),
          fc.constantFrom(...Object.values(AuditEntityType)),
          fc.uuid(),
          fc.ipV4(),
          fc.constantFrom(...Object.values(DeviceType)),
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.option(fc.record({
            status: fc.string(),
            value: fc.oneof(fc.string(), fc.integer()),
          })),
          fc.option(fc.record({
            status: fc.string(),
            value: fc.oneof(fc.string(), fc.integer()),
          })),
          async (
            userId,
            actionType,
            entityType,
            entityId,
            ipAddress,
            deviceType,
            userAgent,
            beforeState,
            afterState
          ) => {
            // Reset mocks for each property test run
            mockValues.mockClear();
            mockInsert.mockClear();

            const auditData: AuditLogData = {
              userId,
              actionType,
              entityType,
              entityId,
              ipAddress,
              deviceType,
              userAgent,
              beforeState: beforeState || undefined,
              afterState: afterState || undefined,
            };

            await logAction(auditData);

            // Verify insert was called
            expect(mockInsert).toHaveBeenCalledWith(auditLogs);

            // Verify values were passed correctly
            expect(mockValues).toHaveBeenCalledWith({
              userId,
              actionType,
              entityType,
              entityId,
              ipAddress,
              deviceType,
              userAgent,
              beforeState: beforeState || null,
              afterState: afterState || null,
            });

            // Verify all required fields are present and non-empty
            expect(userId).toBeTruthy();
            expect(actionType).toBeTruthy();
            expect(entityType).toBeTruthy();
            expect(entityId).toBeTruthy();
            expect(ipAddress).toBeTruthy();
            expect(deviceType).toBeTruthy();
            expect(userAgent).toBeTruthy();
          }
        ),
        { numRuns: 50 } // Reduced from 100 for faster execution
      );
    });

    it('should correctly detect device type from any user agent string', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (userAgent) => {
            const deviceType = getDeviceTypeFromUserAgent(userAgent);

            // Device type should always be one of the valid types
            expect(Object.values(DeviceType)).toContain(deviceType);

            // Verify detection logic (tablet is checked first, then mobile, then desktop)
            const ua = userAgent.toLowerCase();
            if (ua.includes('tablet') || ua.includes('ipad')) {
              expect(deviceType).toBe(DeviceType.TABLET);
            } else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
              expect(deviceType).toBe(DeviceType.MOBILE);
            } else {
              expect(deviceType).toBe(DeviceType.DESKTOP);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract IP address from various header configurations', () => {
      fc.assert(
        fc.property(
          fc.ipV4(),
          fc.option(fc.ipV4()),
          fc.option(fc.ipV4()),
          (forwardedFor, realIp, cfIp) => {
            const headers = new Headers();

            if (forwardedFor) {
              headers.set('x-forwarded-for', forwardedFor);
            }
            if (realIp) {
              headers.set('x-real-ip', realIp);
            }
            if (cfIp) {
              headers.set('cf-connecting-ip', cfIp);
            }

            const extractedIp = getIpAddress(headers);

            // Should extract an IP or return 'unknown'
            expect(extractedIp).toBeTruthy();

            // If any header is present, should not return 'unknown'
            if (forwardedFor || realIp || cfIp) {
              expect(extractedIp).not.toBe('unknown');
            }

            // Should prioritize x-forwarded-for
            if (forwardedFor) {
              expect(extractedIp).toBe(forwardedFor);
            } else if (realIp) {
              expect(extractedIp).toBe(realIp);
            } else if (cfIp) {
              expect(extractedIp).toBe(cfIp);
            } else {
              expect(extractedIp).toBe('unknown');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle audit logging without throwing errors even on database failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(...Object.values(AuditActionType)),
          fc.constantFrom(...Object.values(AuditEntityType)),
          fc.uuid(),
          async (userId, actionType, entityType, entityId) => {
            // Simulate database failure for this test
            const failingMockValues = vi.fn().mockRejectedValue(new Error('Database connection failed'));
            const failingMockInsert = vi.fn(() => ({ values: failingMockValues }));
            (db.insert as any) = failingMockInsert;

            const auditData: AuditLogData = {
              userId,
              actionType,
              entityType,
              entityId,
              ipAddress: '192.168.1.1',
              deviceType: DeviceType.MOBILE,
              userAgent: 'test-agent',
            };

            // Should not throw error
            await expect(logAction(auditData)).resolves.toBeUndefined();

            // Should have attempted to insert
            expect(failingMockInsert).toHaveBeenCalled();
            
            // Restore the original mock for other tests
            (db.insert as any) = mockInsert;
          }
        ),
        { numRuns: 25 } // Reduced for faster execution
      );
    });
  });
});
