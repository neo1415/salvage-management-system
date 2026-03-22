/**
 * Property-based tests for audit log creation
 * 
 * Feature: case-creation-and-approval-enhancements
 * Property 13: Audit Log Creation
 * 
 * For any price override action, the system should create an audit log entry
 * containing the original value, new value, change reason, manager ID, and timestamp.
 * 
 * Validates: Requirements 7.1, 7.2, 7.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';

describe('Feature: case-creation-and-approval-enhancements', () => {
  it('Property 13: Audit Log Creation', () => {
    // Feature: case-creation-and-approval-enhancements, Property 13: Audit Log Creation
    
    fc.assert(
      fc.property(
        fc.uuid(), // userId (manager ID)
        fc.uuid(), // entityId (case ID)
        fc.integer({ min: 1000000, max: 10000000 }), // original market value
        fc.integer({ min: 1000000, max: 10000000 }), // new market value
        fc.integer({ min: 500000, max: 5000000 }), // original salvage value
        fc.integer({ min: 500000, max: 5000000 }), // new salvage value
        fc.string({ minLength: 10, maxLength: 200 }), // change reason
        (userId, entityId, origMarket, newMarket, origSalvage, newSalvage, reason) => {
          // Create mock request
          const mockRequest = new Request('http://localhost/api/test', {
            headers: {
              'user-agent': 'test-agent',
              'x-forwarded-for': '127.0.0.1',
            },
          });

          // Create audit log data for price override
          const auditData = createAuditLogData(
            mockRequest,
            userId,
            AuditActionType.PRICE_OVERRIDE,
            AuditEntityType.CASE,
            entityId,
            {
              aiEstimates: {
                marketValue: origMarket,
                salvageValue: origSalvage,
              },
            },
            {
              managerOverrides: {
                marketValue: newMarket,
                salvageValue: newSalvage,
                reason: reason,
              },
            }
          );

          // Property: Must contain manager user ID (Requirement 7.3)
          expect(auditData.userId).toBe(userId);

          // Property: Must contain action type PRICE_OVERRIDE
          expect(auditData.actionType).toBe(AuditActionType.PRICE_OVERRIDE);

          // Property: Must contain entity type CASE
          expect(auditData.entityType).toBe(AuditEntityType.CASE);

          // Property: Must contain case ID
          expect(auditData.entityId).toBe(entityId);

          // Property: Must contain IP address
          expect(auditData.ipAddress).toBe('127.0.0.1');

          // Property: Must contain device type
          expect(auditData.deviceType).toBeDefined();

          // Property: Must contain user agent
          expect(auditData.userAgent).toBe('test-agent');

          // Property: Must contain original AI values (Requirement 7.1)
          expect(auditData.beforeState).toBeDefined();
          const beforeState = auditData.beforeState as any;
          expect(beforeState.aiEstimates).toBeDefined();
          expect(beforeState.aiEstimates.marketValue).toBe(origMarket);
          expect(beforeState.aiEstimates.salvageValue).toBe(origSalvage);

          // Property: Must contain new manager values (Requirement 7.2)
          expect(auditData.afterState).toBeDefined();
          const afterState = auditData.afterState as any;
          expect(afterState.managerOverrides).toBeDefined();
          expect(afterState.managerOverrides.marketValue).toBe(newMarket);
          expect(afterState.managerOverrides.salvageValue).toBe(newSalvage);

          // Property: Must contain change reason (Requirement 7.2)
          expect(afterState.managerOverrides.reason).toBe(reason);
        }
      ),
      { numRuns: 100 } // Standard 100 runs for property tests
    );
  });
});
