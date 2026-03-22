/**
 * Performance Monitoring Utilities for Internet Search System
 */

export interface SearchMetrics {
  searchId: string;
  query: string;
  itemType: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  resultsCount: number;
  pricesExtracted: number;
  confidence: number;
  error?: string;
  apiResponseTime?: number;
  cacheHit?: boolean;
  fromCache?: boolean;
}

export interface PerformanceStats {
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  averageResponseTime: number;
  averageConfidence: number;
  cacheHitRate: number;
  errorRate: number;
  searchesByType: Record<string, number>;
  recentSearches: SearchMetrics[];
}

class PerformanceMonitor {
  private metrics: SearchMetrics[] = [];
  private readonly maxStoredMetrics = 1000; // Keep last 1000 searches

  /**
   * Record a search operation
   */
  recordSearch(metrics: Omit<SearchMetrics, 'searchId' | 'duration'>): void {
    const searchMetrics: SearchMetrics = {
      ...metrics,
      searchId: this.generateSearchId(),
      duration: metrics.endTime - metrics.startTime
    };

    this.metrics.push(searchMetrics);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }

    // Log performance issues
    this.checkPerformanceThresholds(searchMetrics);
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindow?: number): PerformanceStats {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantMetrics = this.metrics.filter(m => m.startTime >= windowStart);

    if (relevantMetrics.length === 0) {
      return {
        totalSearches: 0,
        successfulSearches: 0,
        failedSearches: 0,
        averageResponseTime: 0,
        averageConfidence: 0,
        cacheHitRate: 0,
        errorRate: 0,
        searchesByType: {},
        recentSearches: []
      };
    }

    const successful = relevantMetrics.filter(m => m.success);
    const failed = relevantMetrics.filter(m => !m.success);
    const cacheHits = relevantMetrics.filter(m => m.cacheHit || m.fromCache);

    const searchesByType = relevantMetrics.reduce((acc, m) => {
      acc[m.itemType] = (acc[m.itemType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSearches: relevantMetrics.length,
      successfulSearches: successful.length,
      failedSearches: failed.length,
      averageResponseTime: this.calculateAverage(relevantMetrics.map(m => m.duration)),
      averageConfidence: this.calculateAverage(successful.map(m => m.confidence)),
      cacheHitRate: relevantMetrics.length > 0 ? (cacheHits.length / relevantMetrics.length) * 100 : 0,
      errorRate: relevantMetrics.length > 0 ? (failed.length / relevantMetrics.length) * 100 : 0,
      searchesByType,
      recentSearches: relevantMetrics.slice(-10) // Last 10 searches
    };
  }

  /**
   * Get metrics for a specific search
   */
  getSearchMetrics(searchId: string): SearchMetrics | undefined {
    return this.metrics.find(m => m.searchId === searchId);
  }

  /**
   * Clear all stored metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): SearchMetrics[] {
    return [...this.metrics];
  }

  /**
   * Check for performance issues and log warnings
   */
  private checkPerformanceThresholds(metrics: SearchMetrics): void {
    const thresholds = {
      slowResponse: 5000, // 5 seconds
      lowConfidence: 30,  // 30%
      highErrorRate: 20   // 20%
    };

    // Check slow response
    if (metrics.duration > thresholds.slowResponse) {
      console.warn(`Slow search detected: ${metrics.duration}ms for query "${metrics.query}"`);
    }

    // Check low confidence
    if (metrics.success && metrics.confidence < thresholds.lowConfidence) {
      console.warn(`Low confidence search: ${metrics.confidence}% for query "${metrics.query}"`);
    }

    // Check error rate (last 10 searches)
    const recentSearches = this.metrics.slice(-10);
    const recentErrors = recentSearches.filter(m => !m.success).length;
    const errorRate = recentSearches.length > 0 ? (recentErrors / recentSearches.length) * 100 : 0;

    if (errorRate > thresholds.highErrorRate) {
      console.warn(`High error rate detected: ${errorRate.toFixed(1)}% in recent searches`);
    }
  }

  /**
   * Generate unique search ID
   */
  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export utility functions
export function createSearchTimer() {
  const startTime = Date.now();
  
  return {
    end: () => Date.now() - startTime,
    getStartTime: () => startTime
  };
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}