/**
 * Socket.IO Integration Tests
 * Task 8.1.8: Add Socket.IO integration tests
 * 
 * Tests all intelligence event emissions with mock Socket.IO server.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  emitPredictionUpdated,
  emitRecommendationNew,
  emitRecommendationClosingSoon,
  emitFraudAlert,
  emitSchemaNewAssetType,
  RoomManager,
} from '@/features/intelligence/events';

// Mock Socket.IO server
const mockEmit = vi.fn();
const mockTo = vi.fn(() => ({ emit: mockEmit }));
const mockSocketJoin = vi.fn();
const mockSocketLeave = vi.fn();
const mockSocket = {
  join: mockSocketJoin,
  leave: mockSocketLeave,
  rooms: new Set(['socket-id']),
};
const mockSockets = new Map([['test-socket-id', mockSocket]]);
const mockRooms = new Map();
const mockAdapter = {
  rooms: mockRooms,
};

const mockIo = {
  to: mockTo,
  sockets: {
    sockets: mockSockets,
    adapter: mockAdapter,
  },
};

// Mock getSocketServer
vi.mock('@/lib/socket/server', () => ({
  getSocketServer: () => mockIo,
}));

describe('Socket.IO Intelligence Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRooms.clear();
  });

  describe('emitPredictionUpdated', () => {
    it('should emit prediction:updated to auction room', async () => {
      const auctionId = 'auction-123';
      const prediction = {
        predictedPrice: 500000,
        confidence: 0.85,
        priceRange: { min: 450000, max: 550000 },
        factors: [
          { factor: 'Similar auctions', impact: 0.3 },
          { factor: 'Market conditions', impact: 0.2 },
        ],
      };

      await emitPredictionUpdated(auctionId, prediction);

      expect(mockTo).toHaveBeenCalledWith(`auction:${auctionId}`);
      expect(mockEmit).toHaveBeenCalledWith('prediction:updated', expect.objectContaining({
        auctionId,
        prediction: expect.objectContaining({
          predictedPrice: 500000,
          confidence: 0.85,
        }),
        timestamp: expect.any(Date),
      }));
    });

    it('should emit prediction:updated to specific vendors', async () => {
      const auctionId = 'auction-123';
      const vendorIds = ['vendor-1', 'vendor-2'];
      const prediction = {
        predictedPrice: 500000,
        confidence: 0.85,
        priceRange: { min: 450000, max: 550000 },
      };

      await emitPredictionUpdated(auctionId, prediction, vendorIds);

      expect(mockTo).toHaveBeenCalledTimes(2);
      expect(mockTo).toHaveBeenCalledWith('vendor:vendor-1');
      expect(mockTo).toHaveBeenCalledWith('vendor:vendor-2');
    });
  });

  describe('emitRecommendationNew', () => {
    it('should emit recommendation:new to vendor room', async () => {
      const vendorId = 'vendor-123';
      const recommendation = {
        auctionId: 'auction-456',
        matchScore: 85,
        reasonCodes: ['Similar to your previous bids', 'High win rate in this category'],
        auction: {
          title: 'Toyota Camry 2020',
          currentBid: 300000,
          endTime: new Date('2024-12-31'),
        },
      };

      await emitRecommendationNew(vendorId, recommendation);

      expect(mockTo).toHaveBeenCalledWith(`vendor:${vendorId}`);
      expect(mockEmit).toHaveBeenCalledWith('recommendation:new', expect.objectContaining({
        vendorId,
        recommendation: expect.objectContaining({
          auctionId: 'auction-456',
          matchScore: 85,
        }),
        timestamp: expect.any(Date),
      }));
    });
  });

  describe('emitRecommendationClosingSoon', () => {
    it('should emit recommendation:closing_soon to vendor room', async () => {
      const vendorId = 'vendor-123';
      const auctionId = 'auction-789';
      const timeRemaining = 45; // minutes
      const currentBid = 400000;
      const matchScore = 90;

      await emitRecommendationClosingSoon(vendorId, auctionId, timeRemaining, currentBid, matchScore);

      expect(mockTo).toHaveBeenCalledWith(`vendor:${vendorId}`);
      expect(mockEmit).toHaveBeenCalledWith('recommendation:closing_soon', expect.objectContaining({
        vendorId,
        auctionId,
        timeRemaining: 45,
        currentBid: 400000,
        matchScore: 90,
        timestamp: expect.any(Date),
      }));
    });
  });

  describe('emitFraudAlert', () => {
    it('should emit fraud:alert to admin room', async () => {
      const alertId = 'alert-123';
      const entityType = 'vendor';
      const entityId = 'vendor-456';
      const riskScore = 85;
      const flagReasons = ['Duplicate photos detected', 'Suspicious bidding pattern'];

      await emitFraudAlert(alertId, entityType, entityId, riskScore, flagReasons);

      expect(mockTo).toHaveBeenCalledWith('admin');
      expect(mockEmit).toHaveBeenCalledWith('fraud:alert', expect.objectContaining({
        alertId,
        entityType: 'vendor',
        entityId,
        riskScore: 85,
        flagReasons: expect.arrayContaining(['Duplicate photos detected']),
        timestamp: expect.any(Date),
      }));
    });
  });

  describe('emitSchemaNewAssetType', () => {
    it('should emit schema:new_asset_type to admin room', async () => {
      const assetType = 'furniture';
      const firstSeenAt = new Date('2024-01-01');
      const sampleAuctionId = 'auction-999';
      const requiresReview = true;

      await emitSchemaNewAssetType(assetType, firstSeenAt, sampleAuctionId, requiresReview);

      expect(mockTo).toHaveBeenCalledWith('admin');
      expect(mockEmit).toHaveBeenCalledWith('schema:new_asset_type', expect.objectContaining({
        assetType: 'furniture',
        firstSeenAt,
        sampleAuctionId,
        requiresReview: true,
      }));
    });
  });

  describe('RoomManager', () => {
    it('should join vendor room', () => {
      RoomManager.joinVendorRoom('test-socket-id', 'vendor-123');
      expect(mockSocketJoin).toHaveBeenCalledWith('vendor:vendor-123');
    });

    it('should leave vendor room', () => {
      RoomManager.leaveVendorRoom('test-socket-id', 'vendor-123');
      expect(mockSocketLeave).toHaveBeenCalledWith('vendor:vendor-123');
    });

    it('should join auction room', () => {
      RoomManager.joinAuctionRoom('test-socket-id', 'auction-456');
      expect(mockSocketJoin).toHaveBeenCalledWith('auction:auction-456');
    });

    it('should leave auction room', () => {
      RoomManager.leaveAuctionRoom('test-socket-id', 'auction-456');
      expect(mockSocketLeave).toHaveBeenCalledWith('auction:auction-456');
    });

    it('should join admin room', () => {
      RoomManager.joinAdminRoom('test-socket-id');
      expect(mockSocketJoin).toHaveBeenCalledWith('admin');
    });

    it('should leave admin room', () => {
      RoomManager.leaveAdminRoom('test-socket-id');
      expect(mockSocketLeave).toHaveBeenCalledWith('admin');
    });

    it('should get room member count', () => {
      mockRooms.set('vendor:vendor-123', new Set(['socket-1', 'socket-2']));
      const count = RoomManager.getRoomMemberCount('vendor:vendor-123');
      expect(count).toBe(2);
    });

    it('should return 0 for empty room', () => {
      const count = RoomManager.getRoomMemberCount('vendor:nonexistent');
      expect(count).toBe(0);
    });

    it('should get socket rooms', () => {
      const rooms = RoomManager.getSocketRooms('test-socket-id');
      expect(rooms).toContain('socket-id');
    });
  });
});
