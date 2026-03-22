/**
 * Currency Formatting Utilities
 * 
 * Provides consistent currency formatting across the application
 */

/**
 * Format a number as Nigerian Naira with thousand separators
 * @param amount - The amount to format
 * @param includeSymbol - Whether to include the ₦ symbol (default: true)
 * @returns Formatted currency string (e.g., "₦166,253.40")
 */
export function formatNaira(amount: number | string | null | undefined, includeSymbol: boolean = true): string {
  if (amount === null || amount === undefined) {
    return includeSymbol ? '₦0.00' : '0.00';
  }

  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return includeSymbol ? '₦0.00' : '0.00';
  }

  const formatted = numericAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return includeSymbol ? `₦${formatted}` : formatted;
}

/**
 * Format analysis method for display
 * @param method - The analysis method from AI assessment
 * @param priceSource - Optional price source (internet_search, database, etc.)
 * @returns User-friendly display name
 */
export function formatAnalysisMethod(method: string | undefined, priceSource?: string): string {
  if (!method || method === 'mock') {
    return 'AI Analysis';
  }

  const methodMap: Record<string, string> = {
    gemini: 'Gemini AI',
    vision: 'Google Vision AI',
    'google-vision': 'Google Vision AI',
    internet_search: 'Internet Search',
    database: 'Database Lookup',
    serper: 'Web Search',
    neutral: 'Standard Analysis',
  };

  const baseMethod = methodMap[method.toLowerCase()] || method.toUpperCase();
  
  // If price source is provided, combine them
  if (priceSource && priceSource !== method) {
    const priceSourceMap: Record<string, string> = {
      internet_search: 'Internet Search',
      database: 'Database',
      serper: 'Web Search',
      scraping: 'Web Scraping',
    };
    
    const priceSourceLabel = priceSourceMap[priceSource] || priceSource;
    return `${baseMethod} + ${priceSourceLabel}`;
  }
  
  return baseMethod;
}
