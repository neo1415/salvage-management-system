/**
 * Integration tests for audit log filtering
 * 
 * Tests the audit log API filtering capabilities for price overrides
 * Requirements: 7.5
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';
import { AuditActionType, AuditEntityType } from '@/lib/utils/audit-logger';

describe('Audit Log Filtering for Price Overrides', () => {
  let testManagerId: string;
  let testCaseId: string;
  let testAuditLogId: string;

  beforeAll(async () => {
    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: 'test-manager-audit@example.com',
        phone: '+2348012345678',
        passwordHash: 'test-hash',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1990-01-01'),
        role: 'salvage_manager',
        isVerified: true,
      })
      .returning();
    testManagerId = manager.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-AUDIT-001',
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
        marketValue: '5000000',
        estimatedSalvageValue: '3000000',
        reservePrice: '2100000',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['damaged-vehicle'],
          confidenceScore: 85,
          damagePercentage: 40,
          processedAt: new Date(),
        },
        gpsLocation: [6.5244, 3.3792] as [number, number],
        locationName: 'Lagos, Nigeria',
        photos: ['photo1.jpg'],
        status: 'pending_approval',
        createdBy: testManagerId,
      })
      .returning();
    testCaseId = testCase.id;

    // Create test audit log for price override
    const [auditLog] = await db
      .insert(auditLogs)
      .values({
        userId: testManagerId,
        actionType: AuditActionType.PRICE_OVERRIDE,
        entityType: AuditEntityType.CASE,
        entityId: testCaseId,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
        userAgent: 'test-agent',
        beforeState: {
          aiEstimates: {
            marketValue: 5000000,
            salvageValue: 3000000,
            reservePrice: 2100000,
          },
        },
        afterState: {
          managerOverrides: {
            marketValue: 5500000,
            salvageValue: 3200000,
            reservePrice: 2240000,
            reason: 'Market research shows higher value',
          },
        },
      })
      .returning();
    testAuditLogId = auditLog.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testAuditLogId) {
      await db.delete(auditLogs).where(eq(auditLogs.id, testAuditLogId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testManagerId) {
      await db.delete(users).where(eq(users.id, testManagerId));
    }
  });

  it('should filter audit logs by manager ID', async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, testManagerId));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.userId === testManagerId)).toBe(true);
  });

  it('should filter audit logs by case ID', async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, testCaseId));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.entityId === testCaseId)).toBe(true);
  });

  it('should filter audit logs by action type (PRICE_OVERRIDE)', async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actionType, AuditActionType.PRICE_OVERRIDE));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.actionType === AuditActionType.PRICE_OVERRIDE)).toBe(true);
  });

  it('should return audit log with price override details', async () => {
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, testAuditLogId));

    expect(log).toBeDefined();
    expect(log.actionType).toBe(AuditActionType.PRICE_OVERRIDE);
    expect(log.entityType).toBe(AuditEntityType.CASE);
    expect(log.beforeState).toBeDefined();
    expect(log.afterState).toBeDefined();
    
    // Verify before state contains AI estimates
    const beforeState = log.beforeState as any;
    expect(beforeState.aiEstimates).toBeDefined();
    expect(beforeState.aiEstimates.marketValue).toBe(5000000);
    
    // Verify after state contains manager overrides
    const afterState = log.afterState as any;
    expect(afterState.managerOverrides).toBeDefined();
    expect(afterState.managerOverrides.marketValue).toBe(5500000);
    expect(afterState.managerOverrides.reason).toBe('Market research shows higher value');
  });

  it('should return only matching entries when filtering by multiple criteria', async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, testManagerId))
      .where(eq(auditLogs.entityId, testCaseId))
      .where(eq(auditLogs.actionType, AuditActionType.PRICE_OVERRIDE));

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => 
      log.userId === testManagerId &&
      log.entityId === testCaseId &&
      log.actionType === AuditActionType.PRICE_OVERRIDE
    )).toBe(true);
  });
});
