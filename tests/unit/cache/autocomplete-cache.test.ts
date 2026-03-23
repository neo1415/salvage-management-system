/**
 * Unit tests for AutocompleteCache service
 * Tests cache hit/miss, TTL, key generation, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutocompleteCache } from '@/lib/cache/autocomplete-cache';
import { redis } from '@/lib/redis/client';

// Mock Redis client
vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    keys: vi.fn(),
    del: vi.fn(),
  },
}));

describe('AutocompleteCache', () => {
  let cache: AutocompleteCache;

  beforeEach(() => {
    cache = new AutocompleteCache();
    vi.clearAllMocks();
  });

  describe('getMakes', () => {
    it('should return cached makes on cache hit', async () => {
      const mockMakes = ['Toyota', 'Honda', 'Nissan'];
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockMakes));

      const result = await cache.getMakes();

      expect(result).toEqual(mockMakes);
      expect(redis.get).toHaveBeenCalledWith('autocomplete:makes');
    });

    it('should return null on cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await cache.getMakes();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis connection failed'));

      const result = await cache.getMakes();

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(redis.get).mockResolvedValue('invalid json');

      const result = await cache.getMakes();

      expect(result).toBeNull();
    });
  });

  describe('setMakes', () => {
    it('should cache makes with correct TTL', async () => {
      const makes = ['Toyota', 'Honda', 'Nissan'];
      vi.mocked(redis.setex).mockResolvedValue('OK');

      await cache.setMakes(makes);

      expect(redis.setex).toHaveBeenCalledWith(
        'autocomplete:makes',
        3600,
        JSON.stringify(makes)
      );
    });

    it('should handle errors gracefully', async () => {
      const makes = ['Toyota', 'Honda'];
      vi.mocked(redis.setex).mockRejectedValue(new Error('Redis write failed'));

      await expect(cache.setMakes(makes)).resolves.not.toThrow();
    });

    it('should cache empty array', async () => {
      const makes: string[] = [];
      vi.mocked(redis.setex).mockResolvedValue('OK');

      await cache.setMakes(makes);

      expect(redis.setex).toHaveBeenCalledWith(
        'autocomplete:makes',
        3600,
        JSON.stringify(makes)
      );
    });
  });

  describe('getModels', () => {
    it('should return cached models on cache hit', async () => {
      const mockModels = ['Camry', 'Corolla', 'RAV4'];
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockModels));

      const result = await cache.getModels('Toyota');

      expect(result).toEqual(mockModels);
      expect(redis.get).toHaveBeenCalledWith('autocomplete:models:Toyota');
    });

    it('should return null on cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await cache.getModels('Toyota');

      expect(result).toBeNull();
    });

    it('should generate correct cache key for different makes', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getModels('Honda');
      expect(redis.get).toHaveBeenCalledWith('autocomplete:models:Honda');

      await cache.getModels('Nissan');
      expect(redis.get).toHaveBeenCalledWith('autocomplete:models:Nissan');
    });

    it('should return null on error', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis error'));

      const result = await cache.getModels('Toyota');

      expect(result).toBeNull();
    });
  });

  describe('setModels', () => {
    it('should cache models with correct key and TTL', async () => {
      const models = ['Camry', 'Corolla'];
      vi.mocked(redis.setex).mockResolvedValue('OK');

      await cache.setModels('Toyota', models);

      expect(redis.setex).toHaveBeenCalledWith(
        'autocomplete:models:Toyota',
        3600,
        JSON.stringify(models)
      );
    });

    it('should handle errors gracefully', async () => {
      const models = ['Camry'];
      vi.mocked(redis.setex).mockRejectedValue(new Error('Redis error'));

      await expect(cache.setModels('Toyota', models)).resolves.not.toThrow();
    });
  });

  describe('getYears', () => {
    it('should return cached years on cache hit', async () => {
      const mockYears = [2020, 2021, 2022, 2023];
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockYears));

      const result = await cache.getYears('Toyota', 'Camry');

      expect(result).toEqual(mockYears);
      expect(redis.get).toHaveBeenCalledWith('autocomplete:years:Toyota:Camry');
    });

    it('should return null on cache miss', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await cache.getYears('Toyota', 'Camry');

      expect(result).toBeNull();
    });

    it('should generate correct cache key for different make/model combinations', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getYears('Toyota', 'Camry');
      expect(redis.get).toHaveBeenCalledWith('autocomplete:years:Toyota:Camry');

      await cache.getYears('Honda', 'Accord');
      expect(redis.get).toHaveBeenCalledWith('autocomplete:years:Honda:Accord');
    });

    it('should return null on error', async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis error'));

      const result = await cache.getYears('Toyota', 'Camry');

      expect(result).toBeNull();
    });
  });

  describe('setYears', () => {
    it('should cache years with correct key and TTL', async () => {
      const years = [2020, 2021, 2022];
      vi.mocked(redis.setex).mockResolvedValue('OK');

      await cache.setYears('Toyota', 'Camry', years);

      expect(redis.setex).toHaveBeenCalledWith(
        'autocomplete:years:Toyota:Camry',
        3600,
        JSON.stringify(years)
      );
    });

    it('should handle errors gracefully', async () => {
      const years = [2020];
      vi.mocked(redis.setex).mockRejectedValue(new Error('Redis error'));

      await expect(cache.setYears('Toyota', 'Camry', years)).resolves.not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all autocomplete cache entries', async () => {
      const mockKeys = [
        'autocomplete:makes',
        'autocomplete:models:Toyota',
        'autocomplete:models:Honda',
        'autocomplete:years:Toyota:Camry',
      ];
      
      vi.mocked(redis.keys)
        .mockResolvedValueOnce(['autocomplete:makes'])
        .mockResolvedValueOnce(['autocomplete:models:Toyota', 'autocomplete:models:Honda'])
        .mockResolvedValueOnce(['autocomplete:years:Toyota:Camry']);
      
      vi.mocked(redis.del).mockResolvedValue(4);

      await cache.clearAll();

      expect(redis.keys).toHaveBeenCalledWith('autocomplete:makes');
      expect(redis.keys).toHaveBeenCalledWith('autocomplete:models:*');
      expect(redis.keys).toHaveBeenCalledWith('autocomplete:years:*');
      expect(redis.del).toHaveBeenCalledWith(...mockKeys);
    });

    it('should handle no keys to delete', async () => {
      vi.mocked(redis.keys)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await cache.clearAll();

      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(redis.keys).mockRejectedValue(new Error('Redis error'));

      await expect(cache.clearAll()).resolves.not.toThrow();
    });
  });

  describe('cache key generation', () => {
    it('should use consistent key format for makes', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getMakes();

      expect(redis.get).toHaveBeenCalledWith('autocomplete:makes');
    });

    it('should use consistent key format for models with make', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getModels('Mercedes-Benz');

      expect(redis.get).toHaveBeenCalledWith('autocomplete:models:Mercedes-Benz');
    });

    it('should use consistent key format for years with make and model', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getYears('Mercedes-Benz', 'GLE 350');

      expect(redis.get).toHaveBeenCalledWith('autocomplete:years:Mercedes-Benz:GLE 350');
    });

    it('should handle special characters in cache keys', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await cache.getModels('Audi');
      await cache.getYears('Audi', 'A4 Quattro');

      expect(redis.get).toHaveBeenCalledWith('autocomplete:models:Audi');
      expect(redis.get).toHaveBeenCalledWith('autocomplete:years:Audi:A4 Quattro');
    });
  });

  describe('TTL behavior', () => {
    it('should use 1 hour TTL for all cache operations', async () => {
      vi.mocked(redis.setex).mockResolvedValue('OK');

      await cache.setMakes(['Toyota']);
      await cache.setModels('Toyota', ['Camry']);
      await cache.setYears('Toyota', 'Camry', [2020]);

      expect(redis.setex).toHaveBeenCalledWith(expect.any(String), 3600, expect.any(String));
      expect(redis.setex).toHaveBeenCalledTimes(3);
    });
  });
});
