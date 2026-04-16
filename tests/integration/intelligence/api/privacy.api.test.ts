/**
 * Privacy API Route Tests
 * Task 7.7.6: Add API route tests for privacy endpoints
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue([]),
  },
}));

describe('Privacy API Routes', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
    vi.clearAllMocks();
  });

  describe('GET /api/intelligence/privacy/export', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { GET } = await import('@/app/api/intelligence/privacy/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/export');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when vendor profile not found', async () => {
      const { auth } = await import('@/lib/auth');
      const { db } = await import('@/lib/db');

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      const { GET } = await import('@/app/api/intelligence/privacy/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/export');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Vendor profile not found');
    });
  });

  describe('POST /api/intelligence/privacy/opt-out', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { POST } = await import('@/app/api/intelligence/privacy/opt-out/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/opt-out', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174000',
          optOut: true,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for invalid input', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      const { POST } = await import('@/app/api/intelligence/privacy/opt-out/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/opt-out', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: 'invalid-uuid',
          optOut: true,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 404 when vendor not found', async () => {
      const { auth } = await import('@/lib/auth');
      const { db } = await import('@/lib/db');

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as any);

      const { POST } = await import('@/app/api/intelligence/privacy/opt-out/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/opt-out', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174000',
          optOut: true,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Vendor not found');
    });

    it('should return 403 when user does not own vendor', async () => {
      const { auth } = await import('@/lib/auth');
      const { db } = await import('@/lib/db');

      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ userId: 'different-user' }]),
      } as any);

      const { POST } = await import('@/app/api/intelligence/privacy/opt-out/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/privacy/opt-out', {
        method: 'POST',
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174000',
          optOut: true,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('GET /api/intelligence/export', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { GET } = await import('@/app/api/intelligence/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/export?dataType=predictions');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      const { GET } = await import('@/app/api/intelligence/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/export?dataType=predictions');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });

    it('should return 400 for invalid data type', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
        expires: '2024-12-31',
      });

      const { GET } = await import('@/app/api/intelligence/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/export?dataType=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('GET /api/intelligence/logs/export', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { GET } = await import('@/app/api/intelligence/logs/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/logs/export');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      const { GET } = await import('@/app/api/intelligence/logs/export/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/logs/export');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });
  });

  describe('POST /api/intelligence/logs/search', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { POST } = await import('@/app/api/intelligence/logs/search/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/logs/search', {
        method: 'POST',
        body: JSON.stringify({
          logType: 'prediction',
          filters: {},
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not admin', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
        expires: '2024-12-31',
      });

      const { POST } = await import('@/app/api/intelligence/logs/search/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/logs/search', {
        method: 'POST',
        body: JSON.stringify({
          logType: 'prediction',
          filters: {},
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });

    it('should return 400 for invalid log type', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
        expires: '2024-12-31',
      });

      const { POST } = await import('@/app/api/intelligence/logs/search/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/logs/search', {
        method: 'POST',
        body: JSON.stringify({
          logType: 'invalid',
          filters: {},
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });
});
