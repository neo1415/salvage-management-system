import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/admin/audit-logs/route';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

// Mock next-auth config
vi.mock('@/lib/auth/next-auth.config', () => ({
  auth: vi.fn(),
  authOptions: {
    providers: [],
    callbacks: {},
  },
}));

// Mock database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('GET /api/admin/audit-logs', () => {
  const mockAdminSession = {
    user: {
      id: 'admin-123',
      email: 'admin@nem-insurance.com',
      role: 'system_admin',
    },
  } as any;

  const mockVendorSession = {
    user: {
      id: 'vendor-123',
      email: 'vendor@example.com',
      role: 'vendor',
    },
  } as any;

  const mockAuditLogs = [
    {
      id: 'log-1',
      userId: 'user-1',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userRole: 'vendor',
      actionType: 'login',
      entityType: 'user',
      entityId: 'user-1',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile',
      userAgent: 'Mozilla/5.0 (iPhone)',
      beforeState: null,
      afterState: null,
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: 'log-2',
      userId: 'user-2',
      userName: 'Jane Smith',
      userEmail: 'jane@example.com',
      userRole: 'claims_adjuster',
      actionType: 'case_created',
      entityType: 'case',
      entityId: 'case-1',
      ipAddress: '192.168.1.2',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0 (Windows)',
      beforeState: null,
      afterState: { status: 'pending_approval' },
      createdAt: new Date('2024-01-15T11:00:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user is not admin', async () => {
      vi.mocked(auth).mockResolvedValue(mockVendorSession);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden - Admin access required');
    });
  });

  describe('Pagination', () => {
    it('should return paginated audit logs with default pagination', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue(mockAuditLogs);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 2 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        totalCount: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should handle custom page and limit parameters', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[0]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 100 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?page=2&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toEqual({
        page: 2,
        limit: 10,
        totalCount: 100,
        totalPages: 10,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should enforce maximum limit of 100', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?limit=200');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(100); // Should be capped at 100
    });
  });

  describe('Filtering', () => {
    it('should filter by userId', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[0]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?userId=user-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].userId).toBe('user-1');
    });

    it('should filter by actionType', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[1]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?actionType=case_created');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].actionType).toBe('case_created');
    });

    it('should filter by entityType', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[1]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?entityType=case');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].entityType).toBe('case');
    });

    it('should filter by date range', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[1]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/audit-logs?startDate=2024-01-15T10:30:00Z&endDate=2024-01-15T12:00:00Z'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([mockAuditLogs[1]]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      } as any);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/audit-logs?userId=user-2&actionType=case_created&entityType=case'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].userId).toBe('user-2');
      expect(data.logs[0].actionType).toBe('case_created');
      expect(data.logs[0].entityType).toBe('case');
    });
  });

  describe('Export Functionality', () => {
    it('should export audit logs as CSV', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockAuditLogs);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?export=csv');
      const response = await GET(request);
      const csvText = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.csv');
      expect(csvText).toContain('Timestamp,User ID,User Name');
      expect(csvText).toContain('john@example.com');
      expect(csvText).toContain('login');
    });

    it('should export audit logs as Excel', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(mockAuditLogs);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?export=excel');
      const response = await GET(request);
      const excelText = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/vnd.ms-excel');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.xls');
      expect(excelText).toContain('Timestamp');
      expect(excelText).toContain('john@example.com');
    });

    it('should handle CSV export with special characters in user agent', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const logsWithSpecialChars = [
        {
          ...mockAuditLogs[0],
          userAgent: 'Mozilla/5.0 "Special" Agent',
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(logsWithSpecialChars);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?export=csv');
      const response = await GET(request);
      const csvText = await response.text();

      expect(response.status).toBe(200);
      // Quotes should be escaped
      expect(csvText).toContain('""Special""');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch audit logs');
    });

    it('should handle invalid date formats gracefully', async () => {
      vi.mocked(auth).mockResolvedValue(mockAdminSession);

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockLeftJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockOrderBy = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockReturnThis();
      const mockOffset = vi.fn().mockResolvedValue([]);

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      mockFrom.mockReturnValue({
        leftJoin: mockLeftJoin,
      } as any);

      mockLeftJoin.mockReturnValue({
        where: mockWhere,
      } as any);

      mockWhere.mockReturnValue({
        orderBy: mockOrderBy,
      } as any);

      mockOrderBy.mockReturnValue({
        limit: mockLimit,
      } as any);

      mockLimit.mockReturnValue({
        offset: mockOffset,
      } as any);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/audit-logs?startDate=invalid-date');
      const response = await GET(request);

      // Should not crash, just ignore invalid date
      expect(response.status).toBe(200);
    });
  });
});
