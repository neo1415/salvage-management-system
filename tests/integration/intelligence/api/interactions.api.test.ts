/**
 * Interaction Tracking API Route Tests
 * Task 7.3.4: Add API route tests for interaction tracking
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/intelligence/interactions/route';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('API Route: /api/intelligence/interactions', () => {
  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/intelligence/interactions', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: '123e4567-e89b-12d3-a456-426614174000',
        auctionId: '123e4567-e89b-12d3-a456-426614174001',
        eventType: 'view',
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

    const request = new NextRequest('http://localhost:3000/api/intelligence/interactions', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: 'invalid-uuid',
        auctionId: '123e4567-e89b-12d3-a456-426614174001',
        eventType: 'view',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request data');
  });

  it('should return 201 with valid interaction data', async () => {
    const { auth } = await import('@/lib/auth');
    const { db } = await import('@/lib/db');

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: '2024-12-31',
    });

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/intelligence/interactions', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: '123e4567-e89b-12d3-a456-426614174000',
        auctionId: '123e4567-e89b-12d3-a456-426614174001',
        eventType: 'view',
        metadata: {
          deviceType: 'mobile',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('sessionId');
    expect(data.data).toHaveProperty('eventType');
  });

  it('should return 500 on server error', async () => {
    const { auth } = await import('@/lib/auth');
    const { db } = await import('@/lib/db');

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: '2024-12-31',
    });

    vi.mocked(db.insert).mockImplementation(() => {
      throw new Error('Database error');
    });

    const request = new NextRequest('http://localhost:3000/api/intelligence/interactions', {
      method: 'POST',
      body: JSON.stringify({
        vendorId: '123e4567-e89b-12d3-a456-426614174000',
        auctionId: '123e4567-e89b-12d3-a456-426614174001',
        eventType: 'view',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
