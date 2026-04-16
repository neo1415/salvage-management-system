/**
 * Recommendation API Route Tests
 * Task 7.2.5: Add API route tests for recommendation endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/vendors/[id]/recommendations/route';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock the RecommendationService
vi.mock('@/features/intelligence/services/recommendation.service', () => ({
  RecommendationService: vi.fn(function(this: any) {
    this.generateRecommendations = vi.fn();
  }),
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
  },
}));

// Mock vendors schema
vi.mock('@/lib/db/schema/vendors', () => ({
  vendors: {},
}));

// Mock audit logs schema
vi.mock('@/lib/db/schema/audit-logs', () => ({
  auditLogs: {},
}));

describe('API Route: /api/vendors/[id]/recommendations', () => {
  const mockVendorId = '123e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/vendors/${mockVendorId}/recommendations`
    );

    const response = await GET(request, { params: { id: mockVendorId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid vendor ID format', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com', 
        name: 'Test User',
        role: 'vendor',
        status: 'active'
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/vendors/invalid-id/recommendations'
    );

    const response = await GET(request, { params: { id: 'invalid-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid vendor ID format');
  });

  it('should return 404 when vendor not found', async () => {
    const { auth } = await import('@/lib/auth');
    const { db } = await import('@/lib/db');

    vi.mocked(auth).mockResolvedValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com', 
        name: 'Test User',
        role: 'vendor',
        status: 'active'
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    // Mock vendor lookup to return empty
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/vendors/${mockVendorId}/recommendations`
    );

    const response = await GET(request, { params: { id: mockVendorId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Vendor not found');
  });

  it('should return 200 with recommendations for valid request', async () => {
    const { auth } = await import('@/lib/auth');
    const { db } = await import('@/lib/db');
    const { RecommendationService } = await import('@/features/intelligence/services/recommendation.service');

    vi.mocked(auth).mockResolvedValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com', 
        name: 'Test User',
        role: 'vendor',
        status: 'active'
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    // Mock vendor lookup
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);

    // Mock RecommendationService
    const mockRecommendations = [
      {
        auctionId: 'auction-1',
        matchScore: 85,
        collaborativeScore: 70,
        contentScore: 80,
        popularityBoost: 5,
        winRateBoost: 10,
        reasonCodes: ['Matches your preferred categories'],
        auctionDetails: {},
      },
    ];

    const mockGenerateRecommendations = vi.fn().mockResolvedValue(mockRecommendations);
    vi.mocked(RecommendationService).mockImplementation(function(this: any) {
      this.generateRecommendations = mockGenerateRecommendations;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/vendors/${mockVendorId}/recommendations?limit=10`
    );

    const response = await GET(request, { params: { id: mockVendorId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('recommendations');
    expect(data.data.recommendations).toBeInstanceOf(Array);
  });

  it('should return 500 on server error', async () => {
    const { auth } = await import('@/lib/auth');
    const { db } = await import('@/lib/db');
    const { RecommendationService } = await import('@/features/intelligence/services/recommendation.service');

    vi.mocked(auth).mockResolvedValue({
      user: { 
        id: 'user-1', 
        email: 'test@example.com', 
        name: 'Test User',
        role: 'vendor',
        status: 'active'
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    // Mock vendor lookup
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]),
    } as any);

    // Mock RecommendationService to throw error
    const mockGenerateRecommendations = vi.fn().mockRejectedValue(new Error('Database error'));
    vi.mocked(RecommendationService).mockImplementation(function(this: any) {
      this.generateRecommendations = mockGenerateRecommendations;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/vendors/${mockVendorId}/recommendations?limit=10`
    );

    const response = await GET(request, { params: { id: mockVendorId } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate recommendations');
  });
});
