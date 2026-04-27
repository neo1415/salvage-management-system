/**
 * System Configuration Hook
 * 
 * Provides client-side access to system configuration values.
 * Caches configuration to minimize API calls.
 * 
 * Usage:
 * ```tsx
 * const { config, loading, error } = useSystemConfig();
 * 
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error loading config</div>;
 * 
 * const minimumBid = currentBid + config.minimumBidIncrement;
 * ```
 */

import { useState, useEffect } from 'react';

export interface SystemConfig {
  minimumBidIncrement: number;
  depositRate: number;
  documentValidityPeriod: number;
  paymentDeadlineAfterSigning: number;
  graceExtensionDuration: number;
  fallbackBufferPeriod: number;
  maxGraceExtensions: number;
  forfeiturePercentage: number;
}

// Module-level cache to share across all hook instances
let cachedConfig: SystemConfig | null = null;
let configPromise: Promise<SystemConfig> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to access system configuration
 * 
 * @returns {object} Configuration state
 * @returns {SystemConfig | null} config - System configuration values
 * @returns {boolean} loading - Loading state
 * @returns {Error | null} error - Error state
 */
export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if cache is still valid
    const now = Date.now();
    const cacheValid = cachedConfig && (now - cacheTimestamp) < CACHE_DURATION;

    if (cacheValid) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    // If there's already a fetch in progress, wait for it
    if (!configPromise) {
      configPromise = fetch('/api/config/system')
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch config: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (!data.success || !data.config) {
            throw new Error('Invalid config response');
          }
          cachedConfig = data.config;
          cacheTimestamp = Date.now();
          return cachedConfig!;
        })
        .catch(err => {
          configPromise = null;
          throw err;
        });
    }

    configPromise
      .then(cfg => {
        setConfig(cfg);
        setLoading(false);
        setError(null);
      })
      .catch(err => {
        console.error('Failed to load system config:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setLoading(false);
        
        // Use default fallback values if fetch fails
        const fallbackConfig: SystemConfig = {
          minimumBidIncrement: 20000,
          depositRate: 10,
          documentValidityPeriod: 48,
          paymentDeadlineAfterSigning: 72,
          graceExtensionDuration: 24,
          fallbackBufferPeriod: 24,
          maxGraceExtensions: 2,
          forfeiturePercentage: 100,
        };
        setConfig(fallbackConfig);
        cachedConfig = fallbackConfig;
      });
  }, []);

  return { config, loading, error };
}

/**
 * Clear the configuration cache
 * Useful when configuration is updated and needs to be refreshed
 */
export function clearConfigCache() {
  cachedConfig = null;
  configPromise = null;
  cacheTimestamp = 0;
}
