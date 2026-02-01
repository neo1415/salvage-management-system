import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  redis, 
  cache, 
  sessionCache, 
  otpCache, 
  rateLimiter,
  auctionCache,
  userCache,
  vendorCache,
  caseCache,
  CACHE_TTL 
} from '@/lib/redis/client';

// Mock the Vercel KV client
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    expire: vi.fn(),
  },
}));

describe('Redis Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.SESSION_MOBILE).toBe(2 * 60 * 60); // 2 hours
      expect(CACHE_TTL.SESSION_DESKTOP).toBe(24 * 60 * 60); // 24 hours
      expect(CACHE_TTL.AUCTION_DATA).toBe(5 * 60); // 5 minutes
      expect(CACHE_TTL.OTP).toBe(5 * 60); // 5 minutes
      expect(CACHE_TTL.USER_PROFILE).toBe(15 * 60); // 15 minutes
      expect(CACHE_TTL.VENDOR_DATA).toBe(10 * 60); // 10 minutes
      expect(CACHE_TTL.CASE_DATA).toBe(10 * 60); // 10 minutes
    });
  });

  describe('cache utilities', () => {
    it('should set cache with TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      
      await cache.set('test-key', { data: 'value' }, 300);
      
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'value' }),
        { ex: 300 }
      );
    });

    it('should get cache value', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify({ data: 'value' }));
      
      const result = await cache.get('test-key');
      
      expect(mockGet).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('should return null for non-existent key', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      
      const result = await cache.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should delete cache key', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await cache.del('test-key');
      
      expect(mockDel).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue('value');
      
      const exists = await cache.exists('test-key');
      
      expect(exists).toBe(true);
    });

    it('should increment counter', async () => {
      const mockIncr = vi.spyOn(redis, 'incr').mockResolvedValue(5);
      
      const result = await cache.incr('counter');
      
      expect(mockIncr).toHaveBeenCalledWith('counter');
      expect(result).toBe(5);
    });
  });

  describe('sessionCache', () => {
    it('should store session with mobile TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const sessionData = { userId: '123', token: 'abc' };
      
      await sessionCache.set('user-123', sessionData, 'mobile');
      
      expect(mockSet).toHaveBeenCalledWith(
        'session:user-123',
        JSON.stringify(sessionData),
        { ex: CACHE_TTL.SESSION_MOBILE }
      );
    });

    it('should store session with desktop TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const sessionData = { userId: '123', token: 'abc' };
      
      await sessionCache.set('user-123', sessionData, 'desktop');
      
      expect(mockSet).toHaveBeenCalledWith(
        'session:user-123',
        JSON.stringify(sessionData),
        { ex: CACHE_TTL.SESSION_DESKTOP }
      );
    });

    it('should get session data', async () => {
      const sessionData = { userId: '123', token: 'abc' };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(sessionData));
      
      const result = await sessionCache.get('user-123');
      
      expect(mockGet).toHaveBeenCalledWith('session:user-123');
      expect(result).toEqual(sessionData);
    });

    it('should delete session', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await sessionCache.del('user-123');
      
      expect(mockDel).toHaveBeenCalledWith('session:user-123');
    });

    it('should refresh session TTL', async () => {
      const mockExpire = vi.spyOn(redis, 'expire').mockResolvedValue(1);
      
      await sessionCache.refresh('user-123', 'mobile');
      
      expect(mockExpire).toHaveBeenCalledWith('session:user-123', CACHE_TTL.SESSION_MOBILE);
    });
  });

  describe('otpCache', () => {
    it('should store OTP with 5-minute TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      
      await otpCache.set('+2348012345678', '123456');
      
      expect(mockSet).toHaveBeenCalledWith(
        'otp:+2348012345678',
        JSON.stringify({ otp: '123456', attempts: 0 }),
        { ex: CACHE_TTL.OTP }
      );
    });

    it('should get OTP data', async () => {
      const otpData = { otp: '123456', attempts: 0 };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(otpData));
      
      const result = await otpCache.get('+2348012345678');
      
      expect(result).toEqual(otpData);
    });

    it('should increment OTP attempts', async () => {
      const otpData = { otp: '123456', attempts: 1 };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(otpData));
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      
      const attempts = await otpCache.incrementAttempts('+2348012345678');
      
      expect(attempts).toBe(2);
      expect(mockSet).toHaveBeenCalledWith(
        'otp:+2348012345678',
        JSON.stringify({ otp: '123456', attempts: 2 }),
        { ex: CACHE_TTL.OTP }
      );
    });
  });

  describe('rateLimiter', () => {
    it('should not limit on first attempt', async () => {
      const mockIncr = vi.spyOn(redis, 'incr').mockResolvedValue(1);
      const mockExpire = vi.spyOn(redis, 'expire').mockResolvedValue(1);
      
      const isLimited = await rateLimiter.isLimited('login:user-123', 5, 300);
      
      expect(isLimited).toBe(false);
      expect(mockIncr).toHaveBeenCalledWith('login:user-123');
      expect(mockExpire).toHaveBeenCalledWith('login:user-123', 300);
    });

    it('should limit after max attempts', async () => {
      const mockIncr = vi.spyOn(redis, 'incr').mockResolvedValue(6);
      
      const isLimited = await rateLimiter.isLimited('login:user-123', 5, 300);
      
      expect(isLimited).toBe(true);
    });
  });

  describe('auctionCache', () => {
    it('should cache auction data with 5-minute TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const auctionData = { id: 'auction-1', currentBid: 50000 };
      
      await auctionCache.set('auction-1', auctionData);
      
      expect(mockSet).toHaveBeenCalledWith(
        'auction:auction-1',
        JSON.stringify(auctionData),
        { ex: CACHE_TTL.AUCTION_DATA }
      );
    });

    it('should get cached auction data', async () => {
      const auctionData = { id: 'auction-1', currentBid: 50000 };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(auctionData));
      
      const result = await auctionCache.get('auction-1');
      
      expect(result).toEqual(auctionData);
    });

    it('should cache active auctions list', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const auctions = [{ id: 'auction-1' }, { id: 'auction-2' }];
      
      await auctionCache.setActiveList(auctions);
      
      expect(mockSet).toHaveBeenCalledWith(
        'auctions:active',
        JSON.stringify(auctions),
        { ex: CACHE_TTL.AUCTION_DATA }
      );
    });
  });

  describe('userCache', () => {
    it('should cache user profile', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const userData = { id: 'user-1', name: 'John Doe' };
      
      await userCache.set('user-1', userData);
      
      expect(mockSet).toHaveBeenCalledWith(
        'user:user-1',
        JSON.stringify(userData),
        { ex: CACHE_TTL.USER_PROFILE }
      );
    });
  });

  describe('vendorCache', () => {
    it('should cache vendor data', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const vendorData = { id: 'vendor-1', tier: 'tier1_bvn' };
      
      await vendorCache.set('vendor-1', vendorData);
      
      expect(mockSet).toHaveBeenCalledWith(
        'vendor:vendor-1',
        JSON.stringify(vendorData),
        { ex: CACHE_TTL.VENDOR_DATA }
      );
    });

    it('should cache vendor tier', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      
      await vendorCache.setTier('vendor-1', 'tier2_full');
      
      expect(mockSet).toHaveBeenCalledWith(
        'vendor:vendor-1:tier',
        JSON.stringify('tier2_full'),
        { ex: CACHE_TTL.VENDOR_DATA }
      );
    });
  });

  describe('caseCache', () => {
    it('should cache case data', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const caseData = { id: 'case-1', status: 'active' };
      
      await caseCache.set('case-1', caseData);
      
      expect(mockSet).toHaveBeenCalledWith(
        'case:case-1',
        JSON.stringify(caseData),
        { ex: CACHE_TTL.CASE_DATA }
      );
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors on get', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockRejectedValue(new Error('Connection failed'));
      
      await expect(cache.get('test-key')).rejects.toThrow('Connection failed');
    });

    it('should handle Redis connection errors on set', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockRejectedValue(new Error('Connection failed'));
      
      await expect(cache.set('test-key', 'value', 300)).rejects.toThrow('Connection failed');
    });

    it('should handle Redis connection errors on del', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockRejectedValue(new Error('Connection failed'));
      
      await expect(cache.del('test-key')).rejects.toThrow('Connection failed');
    });

    it('should handle invalid JSON in cache.get', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue('invalid-json{');
      
      const result = await cache.get('test-key');
      
      // Should return the raw value if JSON parsing fails
      expect(result).toBe('invalid-json{');
    });

    it('should handle null values in cache.get', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      
      const result = await cache.get('test-key');
      
      expect(result).toBeNull();
    });

    it('should handle undefined values in cache.get', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(undefined as any);
      
      const result = await cache.get('test-key');
      
      expect(result).toBeNull();
    });
  });

  describe('cache.getOrSet', () => {
    it('should return cached value if exists', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue({ data: 'cached' } as any);
      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
      
      const result = await cache.getOrSet('test-key', fetcher, 300);
      
      expect(result).toEqual({ data: 'cached' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
      
      const result = await cache.getOrSet('test-key', fetcher, 300);
      
      expect(result).toEqual({ data: 'fresh' });
      expect(fetcher).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'fresh' }),
        { ex: 300 }
      );
    });

    it('should use default TTL if not specified', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' });
      
      await cache.getOrSet('test-key', fetcher);
      
      expect(mockSet).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'fresh' }),
        { ex: 300 }
      );
    });
  });

  describe('rateLimiter edge cases', () => {
    it('should handle concurrent rate limit checks', async () => {
      let counter = 0;
      const mockIncr = vi.spyOn(redis, 'incr').mockImplementation(async () => {
        counter++;
        return counter;
      });
      const mockExpire = vi.spyOn(redis, 'expire').mockResolvedValue(1);
      
      const results = await Promise.all([
        rateLimiter.isLimited('test-key', 5, 300),
        rateLimiter.isLimited('test-key', 5, 300),
        rateLimiter.isLimited('test-key', 5, 300),
      ]);
      
      expect(mockIncr).toHaveBeenCalledTimes(3);
      expect(results).toEqual([false, false, false]);
    });

    it('should reset rate limit counter', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await rateLimiter.reset('test-key');
      
      expect(mockDel).toHaveBeenCalledWith('test-key');
    });
  });

  describe('otpCache edge cases', () => {
    it('should return 0 attempts when OTP not found', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      
      const attempts = await otpCache.incrementAttempts('+2348012345678');
      
      expect(attempts).toBe(0);
    });

    it('should handle max OTP attempts', async () => {
      const otpData = { otp: '123456', attempts: 4 };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(otpData));
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      
      const attempts = await otpCache.incrementAttempts('+2348012345678');
      
      expect(attempts).toBe(5);
    });
  });

  describe('sessionCache edge cases', () => {
    it('should handle tablet device type with desktop TTL', async () => {
      const mockSet = vi.spyOn(redis, 'set').mockResolvedValue('OK');
      const sessionData = { userId: '123', token: 'abc' };
      
      await sessionCache.set('user-123', sessionData, 'tablet');
      
      expect(mockSet).toHaveBeenCalledWith(
        'session:user-123',
        JSON.stringify(sessionData),
        { ex: CACHE_TTL.SESSION_DESKTOP }
      );
    });

    it('should check if session exists', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue('session-data');
      
      const exists = await sessionCache.exists('user-123');
      
      expect(exists).toBe(true);
    });

    it('should return false when session does not exist', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(null);
      
      const exists = await sessionCache.exists('user-123');
      
      expect(exists).toBe(false);
    });
  });

  describe('auctionCache edge cases', () => {
    it('should delete auction cache', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await auctionCache.del('auction-1');
      
      expect(mockDel).toHaveBeenCalledWith('auction:auction-1');
    });

    it('should get active auctions list', async () => {
      const auctions = [{ id: 'auction-1' }, { id: 'auction-2' }];
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(auctions));
      
      const result = await auctionCache.getActiveList();
      
      expect(result).toEqual(auctions);
    });

    it('should invalidate all auction caches', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await auctionCache.invalidateAll();
      
      expect(mockDel).toHaveBeenCalledWith('auctions:active');
    });
  });

  describe('userCache edge cases', () => {
    it('should get cached user profile', async () => {
      const userData = { id: 'user-1', name: 'John Doe' };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(userData));
      
      const result = await userCache.get('user-1');
      
      expect(result).toEqual(userData);
    });

    it('should delete user cache', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await userCache.del('user-1');
      
      expect(mockDel).toHaveBeenCalledWith('user:user-1');
    });
  });

  describe('vendorCache edge cases', () => {
    it('should get cached vendor data', async () => {
      const vendorData = { id: 'vendor-1', tier: 'tier1_bvn' };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(vendorData));
      
      const result = await vendorCache.get('vendor-1');
      
      expect(result).toEqual(vendorData);
    });

    it('should delete vendor cache', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await vendorCache.del('vendor-1');
      
      expect(mockDel).toHaveBeenCalledWith('vendor:vendor-1');
    });

    it('should get cached vendor tier', async () => {
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify('tier2_full'));
      
      const result = await vendorCache.getTier('vendor-1');
      
      expect(result).toBe('tier2_full');
    });
  });

  describe('caseCache edge cases', () => {
    it('should get cached case data', async () => {
      const caseData = { id: 'case-1', status: 'active' };
      const mockGet = vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(caseData));
      
      const result = await caseCache.get('case-1');
      
      expect(result).toEqual(caseData);
    });

    it('should delete case cache', async () => {
      const mockDel = vi.spyOn(redis, 'del').mockResolvedValue(1);
      
      await caseCache.del('case-1');
      
      expect(mockDel).toHaveBeenCalledWith('case:case-1');
    });
  });
});
