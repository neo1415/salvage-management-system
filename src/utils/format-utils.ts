/**
 * Utility functions for formatting values in a compact, scannable format.
 */

/**
 * Format monetary values with K/M suffixes for values > 1000.
 */
export function formatCompactCurrency(
  value: number | string | null | undefined,
  currency: string = '\u20A6',
): string {
  if (value === null || value === undefined || value === '') return 'Not set';

  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;

  if (!Number.isFinite(numValue)) return 'Not set';

  if (numValue >= 1000000) {
    return `${currency}${(numValue / 1000000).toFixed(1)}M`;
  }

  if (numValue >= 1000) {
    return `${currency}${(numValue / 1000).toFixed(1)}K`;
  }

  return `${currency}${numValue.toLocaleString('en-NG')}`;
}

/**
 * Format dates in relative format for recent items, compact format for older items.
 */
export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return 'Not available';

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) return 'Not available';

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

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

  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}
