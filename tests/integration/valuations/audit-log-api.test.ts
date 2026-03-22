/**
 * Integration Test: Audit Log API Endpoints
 * 
 * Tests the audit log API endpoints for valuations
 * Requirements: 12.2, 12.5
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GET } from '@/app/api/admin/valuations/audit-logs/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { valuationAuditLogs } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

// Mock auth
vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: vi.fn(),
}));

describe('Audit Log API Integration Tests', () => {
  const testAdminId = '00000000-0000-0000-0000-000000000001';
  const testUserId = '00000000-0000-0000-0000-000000000002';
  const createdLogIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    // Create test users first
    const testUsers = [
      {
        id: testAdminId,
        email: 'test-admin-audit@example.com',
        phone: '+2341234567890',
        passwordHash: 'test-hash',
        fullName: 'Test Admin',
        dateOfBirth: new Date('1990-01-01'),
        role: 'system_admin' as const,
        status: 'verified_tier_1' as const,
      },
      {
        id: testUserId,
        email: 'test-user-audit@example.com',
        phone: '+2341234567891',
        passwordHash: 'test-hash',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor' as const,
        status: 'verified_tier_1' as const,
      },
    ];

    for (const user of testUsers) {
      try {
        await db.insert(users).values(user);
        createdUserIds.push(user.id);
      } catch (error) {
        // User might already exist, ignore
      }
    }

    // Create test audit logs
    const testEntityId1 = '00000000-0000-0000-0000-000000000011';
    const testEntityId2 = '00000000-0000-0000-0000-000000000012';
    
    const testLogs = [
      {
        userId: testUserId,
        action: 'create' as const,
        entityType: 'valuation' as const,
        entityId: testEntityId1,
        changedFields: null,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      },
      {
        userId: testUserId,
        action: 'update' as const,
        entityType: 'valuation' as const,
        entityId: testEntityId1,
        changedFields: { averagePrice: { old: '8000000', new: '8500000' } },
        createdAt: new Date('2024-01-15T11:00:00Z'),
      },
      {
        userId: testUserId,
        action: 'delete' as const,
        entityType: 'deduction' as const,
        entityId: testEntityId2,
        changedFields: null,
        createdAt: new Date('2024-01-15T12:00:00Z'),
      },
    ];

    for (const log of testLogs) {
      const [inserted] = await db.insert(valuationAuditLogs).values(log).returning();
      createdLogIds.push(inserted.id);
    }
  });

  afterAll(async () => {
    // Clean up test data
    for (const id of createdLogIds) {
      await db.delete(valuationAuditLogs).where(eq(valuationAuditLogs.id, id)).catch(() => {});
    }
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  describe('GET /api/admin/valuations/audit-logs', () => {
    it('should return audit logs in reverse chronological order', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/valuations/audit-logs');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      // Verify reverse chronological order (most recent first)
      if (result.data.length > 1) {
        const timestamps = result.data.map((log: any) => new Date(log.createdAt).getTime());
        for (let i = 0; i < timestamps.length - 1; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
        }
      }
    });

    it('should filter by userId', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/admin/valuations/audit-logs?userId=${testUserId}`
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      
      // All logs should be from the specified user
      result.data.forEach((log: any) => {
        expect(log.userId).toBe(testUserId);
      });
    });

    it('should filter by entityType', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/valuations/audit-logs?entityType=valuation'
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      
      // All logs should be for valuations
      result.data.forEach((log: any) => {
        expect(log.entityType).toBe('valuation');
      });
    });

    it('should filter by action', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/valuations/audit-logs?action=update'
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      
      // All logs should be update actions
      result.data.forEach((log: any) => {
        expect(log.action).toBe('update');
      });
    });

    it('should filter by date range', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const startDate = '2024-01-15T10:30:00Z';
      const endDate = '2024-01-15T12:00:00Z';

      const request = new NextRequest(
        `http://localhost:3000/api/admin/valuations/audit-logs?startDate=${startDate}&endDate=${endDate}`
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      
      // All logs should be within the date range
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      result.data.forEach((log: any) => {
        const logTime = new Date(log.createdAt).getTime();
        expect(logTime).toBeGreaterThanOrEqual(start);
        expect(logTime).toBeLessThanOrEqual(end);
      });
    });

    it('should support pagination', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/valuations/audit-logs?page=1&limit=2'
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it('should require authentication', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue(null as any);

      const request = new NextRequest('http://localhost:3000/api/admin/valuations/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should require admin role', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testUserId, role: 'vendor' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/valuations/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Admin role required');
    });

    it('should combine multiple filters', async () => {
      const { auth } = await import('@/lib/auth/next-auth.config');
      vi.mocked(auth).mockResolvedValue({
        user: { id: testAdminId, role: 'system_admin' },
      } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/admin/valuations/audit-logs?userId=${testUserId}&entityType=valuation&action=update`
      );
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      
      // All logs should match all filters
      result.data.forEach((log: any) => {
        expect(log.userId).toBe(testUserId);
        expect(log.entityType).toBe('valuation');
        expect(log.action).toBe('update');
      });
    });
  });
});
