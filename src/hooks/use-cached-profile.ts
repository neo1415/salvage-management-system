/**
 * useCachedProfile Hook
 * 
 * Provides cached profile data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

interface ProfileData {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    createdAt: string;
    status: string;
  };
  vendor?: {
    businessName: string | null;
    bankAccountNumber: string | null;
    bankName: string | null;
    tier: string;
    status: string;
  };
}

export interface UseCachedProfileReturn {
  profile: ProfileData | null;
  isLoading: boolean;
  isOffline: boolean;
  lastCached: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
}

export function useCachedProfile(): UseCachedProfileReturn {
  const isOffline = useOffline();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCached, setLastCached] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await CacheService.get('profile');
      if (cached) {
        setProfile(cached.data as ProfileData);
        setLastCached(cached.cachedAt);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load profile from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAndCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/vendor/settings/profile');
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const data: ProfileData = await response.json();
      setProfile(data);
      setLastCached(new Date());

      // Cache the data
      await CacheService.set('profile', data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(err as Error);
      
      // Fall back to cache on error
      await loadFromCache();
    } finally {
      setIsLoading(false);
    }
  }, [loadFromCache]);

  const refresh = useCallback(async () => {
    if (isOffline) {
      await loadFromCache();
    } else {
      await fetchAndCache();
    }
  }, [isOffline, loadFromCache, fetchAndCache]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      if (isOffline) {
        await loadFromCache();
      } else {
        await fetchAndCache();
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]); // FIXED: Only re-run when online status changes, not when callbacks change

  return {
    profile,
    isLoading,
    isOffline,
    lastCached,
    refresh,
    error,
  };
}
