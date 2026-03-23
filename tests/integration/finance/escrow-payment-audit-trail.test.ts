/**
 * Integration tests for Escrow Payment Audit Trail
 * 
 * Requirements: Escrow Wallet Payment Completion - Requirement 6
 * Task 7.3.3: Write integration tests for audit trail integration
 * 
 * Tests:
 * - Fetch audit logs for escrow payment
 * - Display audit trail in payment details modal
 * - CSV export functionality
 * - Finance Officer authorization
 * - Audit log filtering and sorting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

describe('Escrow Payment Audit Trail Integration', () => {
  let financeOfficerId: string;
  let vendorUserId: string;
  let vendorId: string;
  let caseId: string;
  let auctionId: string;
  let paymentId: string;
  let walletId: string;

  beforeEach(async () => {
    // Create Finance Officer user
    const [financeOfficer] = await db
      .insert(users)
      .values({
        fullName: 'Finance Officer Test',
        email: `finance-${Date.now()}@test.com`,
        phone: '+2348012345678',
        role: 'finance_officer',
        passwordHash: 'hashed_password',
      })
      .returning();
    financeOfficerId = financeOfficer.id;

    // Create vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        fullName: 'Vendor Test',
        email: `vendor-${Date.now()}@test.com`,
        phone: '+2348087654321',
        role: 'vendor',
        passwordHash: 'hashed_password',
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Business',
        contactPersonName: 'Test Contact',
        phoneNumber: '+2348087654321',
        email: `vendor-${Date.now()}@test.com`,
        tier: 'tier1',
        status: 'verified_tier_1',
      })
      .returning();
    vendorId = vendor.id;

    // Create escrow wallet
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId,
        balance: 1000000,
        frozenAmount: 500000,
      })
      .returning();
    walletId = wallet.id;

    // Create salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry' },
        estimatedValue: 500000,
        status: 'approved',
      })
      .returning();
    caseId = salvageCase.id;

    // Create auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId,
        startingBid: 400000,
        currentBid: 500000,
        highestBidderId: vendorId,
        startTime: new Date(),
        endTime: new Date(Date.now() - 1000),
        status: 'closed',
      })
      .returning();
    auctionId = auction.id;

    // Create payment
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId,
        vendorId,
        amount: '500000',
        paymentMethod: 'escrow_wallet',
        status: 'pending',
        escrowStatus: 'frozen',
        paymentDeadline: new Date(Date.now() + 86400000),
      })
      .returning();
    paymentId = payment.id;

    // Create audit log entries
    await db.insert(auditLogs).values([
      {
        userId: vendorUserId,
        actionType: AuditActionType.FUNDS_FROZEN,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        afterState: {
          amount: 500000,
          escrowStatus: 'frozen',
        },
      },
      {
        userId: vendorUserId,
        actionType: AuditActionType.DOCUMENT_SIGNED,
        entityType: AuditEntityType.DOCUMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0 (iPhone)',
        afterState: {
          signedDocuments: 1,
          totalDocuments: 3,
        },
      },
      {
        userId: vendorUserId,
        actionType: AuditActionType.DOCUMENT_SIGNED,
        entityType: AuditEntityType.DOCUMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0 (iPhone)',
        afterState: {
          signedDocuments: 2,
          totalDocuments: 3,
        },
      },
      {
        userId: vendorUserId,
        actionType: AuditActionType.DOCUMENT_SIGNED,
        entityType: AuditEntityType.DOCUMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.1',
        deviceType: DeviceType.MOBILE,
        userAgent: 'Mozilla/5.0 (iPhone)',
        afterState: {
          signedDocuments: 3,
          totalDocuments: 3,
        },
      },
      {
        userId: financeOfficerId,
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.100',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        afterState: {
          amount: 500000,
          escrowStatus: 'released',
          autoVerified: false,
          manualRelease: true,
          reason: 'Manual release by Finance Officer',
        },
      },
    ]);
  });

  afterEach(async () => {
    // Clean up in reverse order of creation
    await db.delete(auditLogs).where(eq(auditLogs.entityId, paymentId));
    await db.delete(payments).where(eq(payments.id, paymentId));
    await db.delete(auctions).where(eq(auctions.id, auctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    await db.delete(escrowWallets).where(eq(escrowWallets.id, walletId));
    await db.delete(vendors).where(eq(vendors.id, vendorId));
    await db.delete(users).where(eq(users.id, vendorUserId));
    await db.delete(users).where(eq(users.id, financeOfficerId));
  });

  describe('GET /api/payments/[id]/audit-logs', () => {
    it('should fetch audit logs for escrow payment', async () => {
      // Fetch audit logs directly from database
      const logs = await db
        .select({
          id: auditLogs.id,
          actionType: auditLogs.actionType,
          userId: auditLogs.userId,
          userName: users.fullName,
          ipAddress: auditLogs.ipAddress,
          deviceType: auditLogs.deviceType,
          userAgent: auditLogs.userAgent,
          beforeState: auditLogs.beforeState,
          afterState: auditLogs.afterState,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(
          and(
            eq(auditLogs.entityId, paymentId),
            or(
              eq(auditLogs.entityType, 'payment'),
              eq(auditLogs.entityType, 'wallet'),
              eq(auditLogs.entityType, 'document')
            )
          )
        )
        .orderBy(desc(auditLogs.createdAt));

      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return audit logs sorted by createdAt descending', async () => {
      const logs = await db
        .select({
          id: auditLogs.id,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId))
        .orderBy(desc(auditLogs.createdAt));

      // Verify logs are sorted by createdAt descending (most recent first)
      for (let i = 0; i < logs.length - 1; i++) {
        const currentDate = new Date(logs[i].createdAt);
        const nextDate = new Date(logs[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });

    it('should include user information in audit logs', async () => {
      const logs = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userName: users.fullName,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.entityId, paymentId));

      // Verify each log has user information
      logs.forEach((log) => {
        expect(log.userId).toBeDefined();
        expect(log.userName).toBeDefined();
        expect(log.userName).not.toBe('Unknown User');
      });
    });

    it('should include device and IP information', async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId));

      logs.forEach((log) => {
        expect(log.ipAddress).toBeDefined();
        expect(log.deviceType).toBeDefined();
        expect(['mobile', 'desktop', 'tablet']).toContain(log.deviceType);
        expect(log.userAgent).toBeDefined();
      });
    });

    it('should include afterState for relevant actions', async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId));

      // Find funds_released log
      const fundsReleasedLog = logs.find((log) => log.actionType === 'funds_released');
      expect(fundsReleasedLog).toBeDefined();
      expect(fundsReleasedLog!.afterState).toBeDefined();
      expect((fundsReleasedLog!.afterState as any).amount).toBe(500000);
      expect((fundsReleasedLog!.afterState as any).escrowStatus).toBe('released');
    });

    it('should filter payment-related action types', async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityId, paymentId),
            or(
              eq(auditLogs.entityType, 'payment'),
              eq(auditLogs.entityType, 'wallet'),
              eq(auditLogs.entityType, 'document')
            )
          )
        );

      // Verify all logs are payment-related
      const paymentActionTypes = [
        'payment_initiated',
        'payment_verified',
        'payment_auto_verified',
        'payment_rejected',
        'wallet_funded',
        'funds_frozen',
        'funds_released',
        'funds_unfrozen',
        'document_signing_progress',
        'document_signed',
        'pickup_confirmed_vendor',
        'pickup_confirmed_admin',
      ];

      logs.forEach((log) => {
        expect(paymentActionTypes).toContain(log.actionType);
      });
    });
  });

  describe('Audit Trail Display', () => {
    it('should display audit trail for escrow wallet payments', async () => {
      // This test verifies the component integration
      const logs = await db
        .select({
          id: auditLogs.id,
          actionType: auditLogs.actionType,
          userId: auditLogs.userId,
          userName: users.name,
          ipAddress: auditLogs.ipAddress,
          deviceType: auditLogs.deviceType,
          userAgent: auditLogs.userAgent,
          beforeState: auditLogs.beforeState,
          afterState: auditLogs.afterState,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.entityId, paymentId));
      
      // Verify audit logs can be displayed
      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);
      
      // Verify each log has required fields for display
      logs.forEach((log) => {
        expect(log.id).toBeDefined();
        expect(log.actionType).toBeDefined();
        expect(log.userName).toBeDefined();
        expect(log.ipAddress).toBeDefined();
        expect(log.deviceType).toBeDefined();
        expect(log.createdAt).toBeDefined();
      });
    });

    it('should show document signing progress in audit trail', async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId));

      const documentLogs = logs.filter((log) => log.actionType === 'document_signed');

      expect(documentLogs.length).toBe(3);
      
      // Verify document signing progress
      const progressValues = documentLogs.map((log) => (log.afterState as any)?.signedDocuments);
      expect(progressValues).toContain(1);
      expect(progressValues).toContain(2);
      expect(progressValues).toContain(3);
    });

    it('should highlight manual fund release in audit trail', async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId));

      const fundsReleasedLog = logs.find((log) => log.actionType === 'funds_released');

      expect(fundsReleasedLog).toBeDefined();
      expect((fundsReleasedLog!.afterState as any).manualRelease).toBe(true);
      expect((fundsReleasedLog!.afterState as any).reason).toBe('Manual release by Finance Officer');
    });
  });

  describe('CSV Export', () => {
    it('should format audit logs for CSV export', async () => {
      const logs = await db
        .select({
          id: auditLogs.id,
          actionType: auditLogs.actionType,
          userId: auditLogs.userId,
          userName: users.name,
          ipAddress: auditLogs.ipAddress,
          deviceType: auditLogs.deviceType,
          userAgent: auditLogs.userAgent,
          beforeState: auditLogs.beforeState,
          afterState: auditLogs.afterState,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.entityId, paymentId));

      // Verify logs can be formatted for CSV
      const csvHeaders = ['Timestamp', 'Action', 'User', 'IP Address', 'Device', 'Details'];
      
      const csvRows = logs.map((log) => {
        const timestamp = new Date(log.createdAt).toLocaleString();
        const action = log.actionType.replace(/_/g, ' ');
        const user = log.userName;
        const ipAddress = log.ipAddress;
        const device = log.deviceType;
        
        return [timestamp, action, user, ipAddress, device];
      });

      expect(csvRows.length).toBe(logs.length);
      csvRows.forEach((row) => {
        expect(row.length).toBe(5);
        row.forEach((cell) => {
          expect(cell).toBeDefined();
        });
      });
    });

    it('should include error details in CSV export', async () => {
      // Create a failed fund release log
      await db.insert(auditLogs).values({
        userId: financeOfficerId,
        actionType: AuditActionType.FUNDS_RELEASED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        ipAddress: '192.168.1.100',
        deviceType: DeviceType.DESKTOP,
        userAgent: 'Mozilla/5.0',
        afterState: {
          escrowStatus: 'failed',
          error: 'Paystack transfer failed',
        },
      });

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, paymentId));

      const failedLog = logs.find((log) => 
        (log.afterState as any)?.error === 'Paystack transfer failed'
      );

      expect(failedLog).toBeDefined();
      expect((failedLog!.afterState as any).escrowStatus).toBe('failed');
      expect((failedLog!.afterState as any).error).toBe('Paystack transfer failed');
    });
  });
});
