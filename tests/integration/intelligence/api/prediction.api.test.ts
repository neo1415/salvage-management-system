/**
 * Prediction API Route Tests
 * Task 7.1.5: Add API route tests for prediction endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auctions/[id]/prediction/route';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock the PredictionService
vi.mock('@/features/intelligence/services/prediction.service', () => ({
  PredictionService: vi.fn(function(this: any) {
    this.generatePrediction = vi.fn();
  }),
}));

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the audit logs schema
vi.mock('@/lib/db/schema/audit-logs', () => ({
  auditLogs: {},
}));

describe('API Route: /api/auctions/[id]/prediction', () => {
  const mockAuctionId = '123e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/auctions/${mockAuctionId}/prediction`
    );

    const response = await GET(request, { params: { id: mockAuctionId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid auction ID format', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/auctions/invalid-id/prediction'
    );

    const response = await GET(request, { params: { id: 'invalid-id' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid auction ID format');
  });

  it('should return 404 when auction not found', async () => {
    const { auth } = await import('@/lib/auth');
    const { PredictionService } = await import('@/features/intelligence/services/prediction.service');
    
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const mockGeneratePrediction = vi.fn().mockRejectedValue(new Error('Auction not found'));
    vi.mocked(PredictionService).mockImplementation(function(this: any) {
      this.generatePrediction = mockGeneratePrediction;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/auctions/${mockAuctionId}/prediction`
    );

    const response = await GET(request, { params: { id: mockAuctionId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Auction not found');
  });

  it('should return 200 with prediction data for valid request', async () => {
    const { auth } = await import('@/lib/auth');
    const { PredictionService } = await import('@/features/intelligence/services/prediction.service');
    
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const mockPrediction = {
      auctionId: mockAuctionId,
      predictedPrice: 50000,
      lowerBound: 45000,
      upperBound: 55000,
      confidenceScore: 0.85,
      confidenceLevel: 'high' as const,
      method: 'ensemble',
      sampleSize: 100,
      metadata: {},
      algorithmVersion: '1.0.0',
      createdAt: new Date(),
    };

    const mockGeneratePrediction = vi.fn().mockResolvedValue(mockPrediction);
    vi.mocked(PredictionService).mockImplementation(function(this: any) {
      this.generatePrediction = mockGeneratePrediction;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/auctions/${mockAuctionId}/prediction`
    );

    const response = await GET(request, { params: { id: mockAuctionId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.auctionId).toBe(mockAuctionId);
    expect(data.data.predictedPrice).toBe(50000);
    expect(data.data.confidenceLevel).toBe('high');
    expect(mockGeneratePrediction).toHaveBeenCalledWith(mockAuctionId);
  });

  it('should handle insufficient data gracefully', async () => {
    const { auth } = await import('@/lib/auth');
    const { PredictionService } = await import('@/features/intelligence/services/prediction.service');
    
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const mockGeneratePrediction = vi.fn().mockRejectedValue(
      new Error('Insufficient data for price prediction')
    );
    vi.mocked(PredictionService).mockImplementation(function(this: any) {
      this.generatePrediction = mockGeneratePrediction;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/auctions/${mockAuctionId}/prediction`
    );

    const response = await GET(request, { params: { id: mockAuctionId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.error).toBe('Insufficient data for price prediction');
    expect(data.message).toContain('Not enough historical data');
  });

  it('should return 500 on server error', async () => {
    const { auth } = await import('@/lib/auth');
    const { PredictionService } = await import('@/features/intelligence/services/prediction.service');
    
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'vendor' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const mockGeneratePrediction = vi.fn().mockRejectedValue(new Error('Database connection failed'));
    vi.mocked(PredictionService).mockImplementation(function(this: any) {
      this.generatePrediction = mockGeneratePrediction;
    } as any);

    const request = new NextRequest(
      `http://localhost:3000/api/auctions/${mockAuctionId}/prediction`
    );

    const response = await GET(request, { params: { id: mockAuctionId } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
