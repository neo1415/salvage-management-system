/**
 * Mobile Touch Utilities
 * 
 * Utilities for ensuring mobile touch targets meet accessibility standards
 * Follows WCAG 2.1 Level AA guidelines (44x44px minimum)
 */

/**
 * Touch target size constants based on platform guidelines
 * - iOS Human Interface Guidelines: 44x44pt minimum
 * - Android Material Design: 48x48dp minimum
 * - WCAG 2.1 Level AA: 44x44px minimum
 */
export const TOUCH_TARGET = {
  MIN_SIZE: 44, // Minimum touch target size in pixels
  COMFORTABLE_SIZE: 48, // Comfortable touch target size
  LARGE_SIZE: 52, // Large touch target size for primary actions
  MIN_SPACING: 8, // Minimum spacing between touch targets
} as const;

/**
 * Thumb zone constants for one-handed mobile use
 * Based on research showing most users hold phones in lower third
 */
export const THUMB_ZONE = {
  EASY_REACH: 'bottom-third', // Lower 33% of screen - easiest to reach
  MODERATE_REACH: 'middle-third', // Middle 33% of screen - moderate difficulty
  HARD_REACH: 'top-third', // Upper 33% of screen - hardest to reach
} as const;

/**
 * Check if an element meets minimum touch target size
 */
export function isTouchTargetAccessible(width: number, height: number): boolean {
  return width >= TOUCH_TARGET.MIN_SIZE && height >= TOUCH_TARGET.MIN_SIZE;
}

/**
 * Get recommended padding to meet minimum touch target size
 */
export function getRecommendedPadding(
  contentWidth: number,
  contentHeight: number
): { paddingX: number; paddingY: number } {
  const paddingX = Math.max(0, Math.ceil((TOUCH_TARGET.MIN_SIZE - contentWidth) / 2));
  const paddingY = Math.max(0, Math.ceil((TOUCH_TARGET.MIN_SIZE - contentHeight) / 2));
  
  return { paddingX, paddingY };
}

/**
 * Tailwind CSS classes for touch-friendly buttons
 */
export const TOUCH_BUTTON_CLASSES = {
  // Small button (44px minimum)
  sm: 'px-4 py-2.5 text-sm min-h-[44px] min-w-[44px]',
  
  // Medium button (48px comfortable)
  md: 'px-6 py-3 text-base min-h-[48px] min-w-[48px]',
  
  // Large button (52px for primary actions)
  lg: 'px-8 py-4 text-lg min-h-[52px] min-w-[52px]',
  
  // Icon-only button (44x44px square)
  icon: 'p-2.5 min-h-[44px] min-w-[44px]',
  
  // Spacing between touch targets
  spacing: 'gap-2', // 8px minimum spacing
} as const;

/**
 * Check if element is in thumb zone (lower third of viewport)
 */
export function isInThumbZone(elementTop: number, viewportHeight: number): boolean {
  const thumbZoneStart = viewportHeight * 0.67; // Lower third starts at 67%
  return elementTop >= thumbZoneStart;
}

/**
 * Get thumb zone recommendation for element position
 */
export function getThumbZoneRecommendation(
  elementTop: number,
  viewportHeight: number
): 'easy' | 'moderate' | 'hard' {
  const position = elementTop / viewportHeight;
  
  if (position >= 0.67) return 'easy'; // Lower third
  if (position >= 0.33) return 'moderate'; // Middle third
  return 'hard'; // Upper third
}
