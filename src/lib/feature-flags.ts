/**
 * Feature Flag System for Gradual Rollout
 * 
 * Supports:
 * - Percentage-based rollout (10%, 50%, 100%)
 * - User-level opt-in/opt-out
 * - Persistent flag state in localStorage
 */

export type FeatureFlagName = 
  | 'modern-filters'
  | 'card-redesign'
  | 'icon-replacement';

export interface FeatureFlagConfig {
  name: FeatureFlagName;
  description: string;
  rolloutPercentage: number; // 0-100
  enabled: boolean;
}

const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlagConfig> = {
  'modern-filters': {
    name: 'modern-filters',
    description: 'Modern faceted filter UI with chips and dropdowns',
    rolloutPercentage: 100, // Already implemented, enable for all
    enabled: true,
  },
  'card-redesign': {
    name: 'card-redesign',
    description: 'Reduced verbosity card design with max 5 fields',
    rolloutPercentage: 100, // Already implemented, enable for all
    enabled: true,
  },
  'icon-replacement': {
    name: 'icon-replacement',
    description: 'Lucide React icons replacing emoji characters',
    rolloutPercentage: 100, // Already implemented, enable for all
    enabled: true,
  },
};

const STORAGE_KEY = 'feature-flags-overrides';

/**
 * Get user-specific overrides from localStorage
 */
function getUserOverrides(): Partial<Record<FeatureFlagName, boolean>> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save user-specific override to localStorage
 */
function saveUserOverride(flag: FeatureFlagName, enabled: boolean | null) {
  if (typeof window === 'undefined') return;
  
  try {
    const overrides = getUserOverrides();
    
    if (enabled === null) {
      delete overrides[flag];
    } else {
      overrides[flag] = enabled;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.error('Failed to save feature flag override:', error);
  }
}

/**
 * Generate a stable hash from a string (user ID)
 * Used for consistent percentage-based rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if user is in rollout percentage based on stable hash
 */
function isInRollout(userId: string, percentage: number): boolean {
  if (percentage === 0) return false;
  if (percentage === 100) return true;
  
  const hash = hashString(userId);
  const bucket = hash % 100;
  return bucket < percentage;
}

/**
 * Check if a feature flag is enabled for a user
 * 
 * Priority:
 * 1. User override (opt-in/opt-out)
 * 2. Global enabled flag
 * 3. Percentage-based rollout
 */
export function isFeatureEnabled(
  flag: FeatureFlagName,
  userId?: string
): boolean {
  const config = FEATURE_FLAGS[flag];
  if (!config) return false;
  
  // Check user override first
  const overrides = getUserOverrides();
  if (flag in overrides) {
    return overrides[flag]!;
  }
  
  // Check global enabled flag
  if (!config.enabled) return false;
  
  // Check percentage-based rollout
  if (!userId) return config.rolloutPercentage === 100;
  
  return isInRollout(userId, config.rolloutPercentage);
}

/**
 * Get all feature flags with their current state for a user
 */
export function getAllFeatureFlags(userId?: string): Record<FeatureFlagName, boolean> {
  const flags: Partial<Record<FeatureFlagName, boolean>> = {};
  
  for (const flagName of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    flags[flagName] = isFeatureEnabled(flagName, userId);
  }
  
  return flags as Record<FeatureFlagName, boolean>;
}

/**
 * Get feature flag configuration
 */
export function getFeatureFlagConfig(flag: FeatureFlagName): FeatureFlagConfig | undefined {
  return FEATURE_FLAGS[flag];
}

/**
 * Get all feature flag configurations
 */
export function getAllFeatureFlagConfigs(): FeatureFlagConfig[] {
  return Object.values(FEATURE_FLAGS);
}

/**
 * Opt-in to a feature flag (user override)
 */
export function optInToFeature(flag: FeatureFlagName): void {
  saveUserOverride(flag, true);
}

/**
 * Opt-out of a feature flag (user override)
 */
export function optOutOfFeature(flag: FeatureFlagName): void {
  saveUserOverride(flag, false);
}

/**
 * Clear user override for a feature flag (use default rollout)
 */
export function clearFeatureOverride(flag: FeatureFlagName): void {
  saveUserOverride(flag, null);
}

/**
 * Check if user has an override for a feature flag
 */
export function hasFeatureOverride(flag: FeatureFlagName): boolean {
  const overrides = getUserOverrides();
  return flag in overrides;
}

/**
 * Get user's override value for a feature flag
 */
export function getFeatureOverride(flag: FeatureFlagName): boolean | null {
  const overrides = getUserOverrides();
  return overrides[flag] ?? null;
}
