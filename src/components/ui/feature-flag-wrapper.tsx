/**
 * Feature Flag Wrapper Component
 * 
 * Conditionally renders children based on feature flag state
 * Supports fallback content when feature is disabled
 */

'use client';

import { useFeatureFlag } from '@/hooks/use-feature-flag';
import type { FeatureFlagName } from '@/lib/feature-flags';

interface FeatureFlagWrapperProps {
  flag: FeatureFlagName;
  userId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component that conditionally renders children based on feature flag
 * 
 * @param flag - The feature flag to check
 * @param userId - Optional user ID for percentage-based rollout
 * @param children - Content to render when feature is enabled
 * @param fallback - Optional content to render when feature is disabled
 */
export function FeatureFlagWrapper({
  flag,
  userId,
  children,
  fallback = null,
}: FeatureFlagWrapperProps) {
  const { enabled } = useFeatureFlag(flag, userId);

  return enabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook-based alternative for conditional rendering in components
 * Use this when you need more control over the rendering logic
 */
export { useFeatureFlag } from '@/hooks/use-feature-flag';
