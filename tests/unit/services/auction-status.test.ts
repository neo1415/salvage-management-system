/**
 * Unit tests for AuctionStatusService
 * 
 * Tests real-time auction status determination logic
 */

import { describe, it, expect } from 'vitest';
import { AuctionStatusService } from '@/features/auctions/services/status.service';

describe('AuctionStatusService', () => {
  describe('getAuctionStatus', () => {
    it('should return closed for already closed auctions', () => {
      const auction = {
        status: 'closed',
        endTime: new Date('2024-01-01'),
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('closed');
    });
    
    it('should return cancelled for cancelled auctions', () => {
      const auction = {
        status: 'cancelled',
        endTime: new Date('2024-01-01'),
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('cancelled');
    });
    
    it('should return forfeited for forfeited auctions', () => {
      const auction = {
        status: 'forfeited',
        endTime: new Date('2024-01-01'),
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('forfeited');
    });
    
    it('should return closed for active auctions with past endTime', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const auction = {
        status: 'active',
        endTime: pastDate,
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('closed');
    });
    
    it('should return closed for extended auctions with past endTime', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const auction = {
        status: 'extended',
        endTime: pastDate,
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('closed');
    });
    
    it('should return active for active auctions with future endTime', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const auction = {
        status: 'active',
        endTime: futureDate,
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('active');
    });
    
    it('should return extended for extended auctions with future endTime', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const auction = {
        status: 'extended',
        endTime: futureDate,
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('extended');
    });
    
    it('should handle string endTime dates', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      const auction = {
        status: 'active',
        endTime: pastDate,
      };
      
      expect(AuctionStatusService.getAuctionStatus(auction)).toBe('closed');
    });
  });
  
  describe('isAuctionActive', () => {
    it('should return true for active auctions with future endTime', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      const auction = {
        status: 'active',
        endTime: futureDate,
      };
      
      expect(AuctionStatusService.isAuctionActive(auction)).toBe(true);
    });
    
    it('should return true for extended auctions with future endTime', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      const auction = {
        status: 'extended',
        endTime: futureDate,
      };
      
      expect(AuctionStatusService.isAuctionActive(auction)).toBe(true);
    });
    
    it('should return false for active auctions with past endTime', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60);
      const auction = {
        status: 'active',
        endTime: pastDate,
      };
      
      expect(AuctionStatusService.isAuctionActive(auction)).toBe(false);
    });
    
    it('should return false for closed auctions', () => {
      const auction = {
        status: 'closed',
        endTime: new Date('2024-01-01'),
      };
      
      expect(AuctionStatusService.isAuctionActive(auction)).toBe(false);
    });
    
    it('should return false for cancelled auctions', () => {
      const auction = {
        status: 'cancelled',
        endTime: new Date('2024-01-01'),
      };
      
      expect(AuctionStatusService.isAuctionActive(auction)).toBe(false);
    });
  });
});
