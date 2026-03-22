/**
 * React hook for using feature flags in components
 */

import { useState, useEffect } from 'react';
import { 
  isFeatureEnabled, 
  optInToFeature, 
  optOutOfFeature, 
  clearFeatureOverride,
  hasFeatureOverride,
  getFeatureOverride,
  type FeatureFlagName 
} from '@/lib/feature-flags';

export interface UseFeatureFlagResult {
  enabled: boolean;
  hasOverride: boolean;
  overrideValue: boolean | null;
  optIn: () => void;
  optOut: () => void;
  clearOverride: () => void;
}

/**
 * Hook to check if a feature flag is enabled for the current user
 * 
 * @param flag - The feature flag name
 * @param userId - Optional user ID for percentage-based rollout
 * @returns Feature flag state and control functions
 */
export function useFeatureFlag(
  flag: FeatureFlagName,
  userId?: string
): UseFeatureFlagResult {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(flag, userId));
  const [hasOverride, setHasOverride] = useState(() => hasFeatureOverride(flag));
  const [overrideValue, setOverrideValue] = useState(() => getFeatureOverride(flag));

  // Re-check flag when userId changes
  useEffect(() => {
    setEnabled(isFeatureEnabled(flag, userId));
    setHasOverride(hasFeatureOverride(flag));
    setOverrideValue(getFeatureOverride(flag));
  }, [flag, userId]);

  // Listen for storage changes (cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feature-flags-overrides') {
        setEnabled(isFeatureEnabled(flag, userId));
        setHasOverride(hasFeatureOverride(flag));
        setOverrideValue(getFeatureOverride(flag));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [flag, userId]);

  const optIn = () => {
    optInToFeature(flag);
    setEnabled(true);
    setHasOverride(true);
    setOverrideValue(true);
  };

  const optOut = () => {
    optOutOfFeature(flag);
    setEnabled(false);
    setHasOverride(true);
    setOverrideValue(false);
  };

  const clearOverride = () => {
    clearFeatureOverride(flag);
    const newEnabled = isFeatureEnabled(flag, userId);
    setEnabled(newEnabled);
    setHasOverride(false);
    setOverrideValue(null);
  };

  return {
    enabled,
    hasOverride,
    overrideValue,
    optIn,
    optOut,
    clearOverride,
  };
}
