/**
 * Admin API Route Tests
 * Task 7.6.7: Add API route tests for admin endpoints
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
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue([]),
  },
}));

describe('Admin API Routes', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
    vi.clearAllMocks();
  });

  describe('POST /api/intelligence/admin/config', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { POST } = await import('@/app/api/intelligence/admin/config/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          configKey: 'test.key',
          configValue: 100,
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

      const { POST } = await import('@/app/api/intelligence/admin/config/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          configKey: 'test.key',
          configValue: 100,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });

    it('should return 400 for invalid input', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
        expires: '2024-12-31',
      });

      const { POST } = await import('@/app/api/intelligence/admin/config/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          configKey: '',
          configValue: 100,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });

  describe('GET /api/intelligence/admin/inspect/[predictionId]', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { GET } = await import('@/app/api/intelligence/admin/inspect/[predictionId]/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/inspect/test-id');
      const response = await GET(request, { params: { predictionId: 'test-id' } });

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

      const { GET } = await import('@/app/api/intelligence/admin/inspect/[predictionId]/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/inspect/test-id');
      const response = await GET(request, { params: { predictionId: 'test-id' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });
  });

  describe('POST /api/intelligence/admin/schema/validate', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { POST } = await import('@/app/api/intelligence/admin/schema/validate/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/schema/validate', {
        method: 'POST',
        body: JSON.stringify({
          changeId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'approve',
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

      const { POST } = await import('@/app/api/intelligence/admin/schema/validate/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/schema/validate', {
        method: 'POST',
        body: JSON.stringify({
          changeId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'approve',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });
  });

  describe('GET /api/intelligence/admin/schema/pending', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { GET } = await import('@/app/api/intelligence/admin/schema/pending/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/schema/pending');
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

      const { GET } = await import('@/app/api/intelligence/admin/schema/pending/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/admin/schema/pending');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });
  });

  describe('POST /api/intelligence/fraud/analyze', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const { POST } = await import('@/app/api/intelligence/fraud/analyze/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/fraud/analyze', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'vendor',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
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

      const { POST } = await import('@/app/api/intelligence/fraud/analyze/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/fraud/analyze', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'vendor',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Admin access required');
    });

    it('should return 400 for invalid entity type', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-1', email: 'test@example.com', role: 'admin' },
        expires: '2024-12-31',
      });

      const { POST } = await import('@/app/api/intelligence/fraud/analyze/route');
      const request = new NextRequest('http://localhost:3000/api/intelligence/fraud/analyze', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'invalid',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });
});
