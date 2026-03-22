/**
 * Utility functions for formatting values in a compact, scannable format
 * Used for card displays to reduce verbosity
 */

/**
 * Format monetary values with K/M suffixes for values > 1000
 * @param value - The numeric value to format
 * @param currency - Currency symbol (default: ₦)
 * @returns Formatted string with K/M suffix
 */
export function formatCompactCurrency(value: number | string, currency: string = '₦'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return `${currency}0`;
  
  if (numValue >= 1000000) {
    return `${currency}${(numValue / 1000000).toFixed(1)}M`;
  }
  
  if (numValue >= 1000) {
    return `${currency}${(numValue / 1000).toFixed(1)}K`;
  }
  
  return `${currency}${numValue.toLocaleString()}`;
}

/**
 * Format dates in relative format for recent items, compact format for older items
 * @param date - Date string or Date object
 * @returns Formatted date string
 */
export function formatRelativeDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  // Recent items (< 7 days) - use relative format
  if (diffMinutes < 1) {
    return 'Just now';
  }
  
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  
  // Older items - use compact format
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}
