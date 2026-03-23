'use client';

import React from 'react';
import { CheckCircle, Award, Zap, Building2 } from 'lucide-react';

/**
 * Badge types that can be displayed
 */
export type BadgeType = 'verified_bvn' | 'verified_business' | 'top_rated' | 'fast_payer';

/**
 * Props for individual badge
 */
interface BadgeConfig {
  type: BadgeType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  tooltip: string;
}

/**
 * Props for TrustBadges component
 */
export interface TrustBadgesProps {
  /**
   * Vendor tier: 'tier1_bvn' or 'tier2_full'
   */
  tier: 'tier1_bvn' | 'tier2_full';
  
  /**
   * Vendor's average rating (0-5)
   */
  rating: number;
  
  /**
   * Average payment time in hours
   */
  avgPaymentTimeHours: number;
  
  /**
   * Display size: 'sm' (small), 'md' (medium), 'lg' (large)
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Layout direction: 'horizontal' or 'vertical'
   * @default 'horizontal'
   */
  layout?: 'horizontal' | 'vertical';
  
  /**
   * Show badge labels
   * @default true
   */
  showLabels?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Badge configuration map
 */
const BADGE_CONFIGS: Record<BadgeType, Omit<BadgeConfig, 'type'>> = {
  verified_bvn: {
    label: 'Verified BVN',
    icon: <CheckCircle className="w-full h-full" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    tooltip: "This vendor's identity has been verified via BVN (Bank Verification Number)",
  },
  verified_business: {
    label: 'Verified Business',
    icon: <Building2 className="w-full h-full" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    tooltip: 'This vendor has completed full business verification with CAC, NIN, and bank account verification',
  },
  top_rated: {
    label: 'Top Rated',
    icon: <Award className="w-full h-full" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    tooltip: 'This vendor has an average rating of 4.5 stars or higher',
  },
  fast_payer: {
    label: 'Fast Payer',
    icon: <Zap className="w-full h-full" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    tooltip: 'This vendor completes payments in less than 6 hours on average',
  },
};

/**
 * Size configuration for badges
 */
const SIZE_CONFIGS = {
  sm: {
    iconSize: 'w-4 h-4',
    padding: 'px-2 py-1',
    gap: 'gap-1',
    text: 'text-xs',
    badgeGap: 'gap-1',
  },
  md: {
    iconSize: 'w-5 h-5',
    padding: 'px-3 py-1.5',
    gap: 'gap-1.5',
    text: 'text-sm',
    badgeGap: 'gap-2',
  },
  lg: {
    iconSize: 'w-6 h-6',
    padding: 'px-4 py-2',
    gap: 'gap-2',
    text: 'text-base',
    badgeGap: 'gap-3',
  },
};

/**
 * Determine which badges to display based on vendor data
 */
function getEligibleBadges(
  tier: 'tier1_bvn' | 'tier2_full',
  rating: number,
  avgPaymentTimeHours: number
): BadgeType[] {
  const badges: BadgeType[] = [];

  // Tier 1: Verified BVN badge
  if (tier === 'tier1_bvn' || tier === 'tier2_full') {
    badges.push('verified_bvn');
  }

  // Tier 2: Verified Business badge
  if (tier === 'tier2_full') {
    badges.push('verified_business');
  }

  // Top Rated: ≥4.5 stars
  if (rating >= 4.5) {
    badges.push('top_rated');
  }

  // Fast Payer: <6 hours average payment time
  if (avgPaymentTimeHours > 0 && avgPaymentTimeHours < 6) {
    badges.push('fast_payer');
  }

  return badges;
}

/**
 * Individual Badge Component
 */
interface BadgeProps {
  config: BadgeConfig;
  size: 'sm' | 'md' | 'lg';
  showLabel: boolean;
}

function Badge({ config, size, showLabel }: BadgeProps) {
  const sizeConfig = SIZE_CONFIGS[size];
  
  return (
    <div
      className={`
        inline-flex items-center rounded-full
        ${sizeConfig.padding} ${sizeConfig.gap}
        ${config.bgColor} ${config.color}
        font-medium transition-all duration-200
        hover:scale-105 hover:shadow-md
        cursor-help
        group relative
      `}
      title={config.tooltip}
      role="img"
      aria-label={config.label}
    >
      <div className={sizeConfig.iconSize}>
        {config.icon}
      </div>
      {showLabel && (
        <span className={sizeConfig.text}>
          {config.label}
        </span>
      )}
      
      {/* Tooltip */}
      <div
        className="
          absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
          px-3 py-2 bg-gray-900 text-white text-xs rounded-lg
          opacity-0 group-hover:opacity-100
          pointer-events-none transition-opacity duration-200
          whitespace-nowrap z-50 shadow-lg
        "
      >
        {config.tooltip}
        <div
          className="
            absolute top-full left-1/2 transform -translate-x-1/2
            border-4 border-transparent border-t-gray-900
          "
        />
      </div>
    </div>
  );
}

/**
 * TrustBadges Component
 * 
 * Displays trust badges for vendors based on their verification status,
 * rating, and performance metrics.
 * 
 * Badges displayed:
 * - Verified BVN (Tier 1): Green checkmark - BVN verified
 * - Verified Business (Tier 2): Blue building - Full business verification
 * - Top Rated: Yellow award - Rating ≥4.5 stars
 * - Fast Payer: Purple lightning - Avg payment time <6 hours
 * 
 * @example
 * ```tsx
 * <TrustBadges
 *   tier="tier2_full"
 *   rating={4.8}
 *   avgPaymentTimeHours={4.5}
 *   size="md"
 *   layout="horizontal"
 * />
 * ```
 */
export function TrustBadges({
  tier,
  rating,
  avgPaymentTimeHours,
  size = 'md',
  layout = 'horizontal',
  showLabels = true,
  className = '',
}: TrustBadgesProps) {
  const eligibleBadges = getEligibleBadges(tier, rating, avgPaymentTimeHours);
  
  if (eligibleBadges.length === 0) {
    return null;
  }

  const sizeConfig = SIZE_CONFIGS[size];
  const layoutClass = layout === 'horizontal' ? 'flex-row' : 'flex-col';

  return (
    <div
      className={`
        flex ${layoutClass} ${sizeConfig.badgeGap}
        items-center flex-wrap
        ${className}
      `}
      role="list"
      aria-label="Trust badges"
    >
      {eligibleBadges.map((badgeType) => {
        const config = BADGE_CONFIGS[badgeType];
        return (
          <Badge
            key={badgeType}
            config={{ ...config, type: badgeType }}
            size={size}
            showLabel={showLabels}
          />
        );
      })}
    </div>
  );
}
