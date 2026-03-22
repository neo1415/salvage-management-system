/**
 * Gemini Damage Detection Metrics Tracking
 * 
 * Tracks key metrics for monitoring Gemini API usage and performance:
 * - Success rates by method (Gemini, Vision, Neutral)
 * - Average response times by method
 * - Daily API usage and quota consumption
 * - Error rates by type
 * - Fallback chain statistics
 * 
 * Requirements: 10.1, 10.4, 10.5
 */

export interface GeminiMetrics {
  // Success rates
  geminiSuccessCount: number;
  geminiFailureCount: number;
  visionFallbackCount: number;
  neutralFallbackCount: number;
  
  // Response times (in milliseconds)
  geminiResponseTimes: number[];
  visionResponseTimes: number[];
  
  // API usage
  dailyApiCalls: number;
  dailyQuotaLimit: number;
  
  // Error tracking
  errorsByType: Record<string, number>;
  
  // Timestamps
  periodStart: Date;
  periodEnd: Date;
}

export interface MetricsSummary {
  // Success rates (percentages)
  geminiSuccessRate: number;
  visionFallbackRate: number;
  neutralFallbackRate: number;
  
  // Average response times (milliseconds)
  avgGeminiResponseTime: number;
  avgVisionResponseTime: number;
  
  // Quota usage
  dailyQuotaUsagePercent: number;
  dailyQuotaRemaining: number;
  
  // Error rate
  overallErrorRate: number;
  topErrors: Array<{ type: string; count: number; percentage: number }>;
  
  // Period
  periodStart: Date;
  periodEnd: Date;
  totalAssessments: number;
}

/**
 * In-memory metrics collector
 * 
 * Note: In production, this should be replaced with a proper metrics backend
 * like Prometheus, Datadog, or CloudWatch. This implementation provides
 * basic metrics tracking for development and staging environments.
 */
class GeminiMetricsCollector {
  private metrics: GeminiMetrics;
  
  constructor() {
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Initialize empty metrics for a new period
   */
  private initializeMetrics(): GeminiMetrics {
    return {
      geminiSuccessCount: 0,
      geminiFailureCount: 0,
      visionFallbackCount: 0,
      neutralFallbackCount: 0,
      geminiResponseTimes: [],
      visionResponseTimes: [],
      dailyApiCalls: 0,
      dailyQuotaLimit: 1500,
      errorsByType: {},
      periodStart: new Date(),
      periodEnd: new Date(),
    };
  }
  
  /**
   * Record a successful Gemini assessment
   */
  recordGeminiSuccess(responseTimeMs: number): void {
    this.metrics.geminiSuccessCount++;
    this.metrics.geminiResponseTimes.push(responseTimeMs);
    this.metrics.dailyApiCalls++;
    this.metrics.periodEnd = new Date();
  }
  
  /**
   * Record a Gemini failure (triggers fallback)
   */
  recordGeminiFailure(errorType: string): void {
    this.metrics.geminiFailureCount++;
    this.incrementErrorCount(errorType);
    this.metrics.periodEnd = new Date();
  }
  
  /**
   * Record a Vision API fallback
   */
  recordVisionFallback(responseTimeMs: number): void {
    this.metrics.visionFallbackCount++;
    this.metrics.visionResponseTimes.push(responseTimeMs);
    this.metrics.periodEnd = new Date();
  }
  
  /**
   * Record a neutral response (all methods failed)
   */
  recordNeutralFallback(): void {
    this.metrics.neutralFallbackCount++;
    this.metrics.periodEnd = new Date();
  }
  
  /**
   * Increment error count for a specific error type
   */
  private incrementErrorCount(errorType: string): void {
    if (!this.metrics.errorsByType[errorType]) {
      this.metrics.errorsByType[errorType] = 0;
    }
    this.metrics.errorsByType[errorType]++;
  }
  
  /**
   * Get current raw metrics
   */
  getMetrics(): GeminiMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get metrics summary with calculated statistics
   */
  getSummary(): MetricsSummary {
    const totalAssessments = 
      this.metrics.geminiSuccessCount + 
      this.metrics.geminiFailureCount;
    
    const geminiSuccessRate = totalAssessments > 0
      ? (this.metrics.geminiSuccessCount / totalAssessments) * 100
      : 0;
    
    const visionFallbackRate = totalAssessments > 0
      ? (this.metrics.visionFallbackCount / totalAssessments) * 100
      : 0;
    
    const neutralFallbackRate = totalAssessments > 0
      ? (this.metrics.neutralFallbackCount / totalAssessments) * 100
      : 0;
    
    const avgGeminiResponseTime = this.calculateAverage(this.metrics.geminiResponseTimes);
    const avgVisionResponseTime = this.calculateAverage(this.metrics.visionResponseTimes);
    
    const dailyQuotaUsagePercent = 
      (this.metrics.dailyApiCalls / this.metrics.dailyQuotaLimit) * 100;
    
    const dailyQuotaRemaining = 
      this.metrics.dailyQuotaLimit - this.metrics.dailyApiCalls;
    
    const totalErrors = Object.values(this.metrics.errorsByType).reduce((sum, count) => sum + count, 0);
    const overallErrorRate = totalAssessments > 0
      ? (totalErrors / totalAssessments) * 100
      : 0;
    
    const topErrors = Object.entries(this.metrics.errorsByType)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalAssessments > 0 ? (count / totalAssessments) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      geminiSuccessRate,
      visionFallbackRate,
      neutralFallbackRate,
      avgGeminiResponseTime,
      avgVisionResponseTime,
      dailyQuotaUsagePercent,
      dailyQuotaRemaining,
      overallErrorRate,
      topErrors,
      periodStart: this.metrics.periodStart,
      periodEnd: this.metrics.periodEnd,
      totalAssessments,
    };
  }
  
  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return sum / numbers.length;
  }
  
  /**
   * Reset metrics (for new period or testing)
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Check if any alerting thresholds are exceeded
   * 
   * Alerting thresholds:
   * - Gemini failure rate >20%
   * - Daily quota >1,200 requests (80%)
   * - Average response time >15 seconds
   * - Error rate >5%
   */
  checkAlerts(): Array<{ severity: 'warning' | 'critical'; message: string }> {
    const alerts: Array<{ severity: 'warning' | 'critical'; message: string }> = [];
    const summary = this.getSummary();
    
    // Check Gemini failure rate
    const geminiFailureRate = 100 - summary.geminiSuccessRate;
    if (geminiFailureRate > 20) {
      alerts.push({
        severity: 'critical',
        message: `Gemini failure rate is ${geminiFailureRate.toFixed(1)}% (threshold: 20%)`,
      });
    }
    
    // Check daily quota
    if (this.metrics.dailyApiCalls > 1200) {
      const severity = this.metrics.dailyApiCalls > 1350 ? 'critical' : 'warning';
      alerts.push({
        severity,
        message: `Daily quota usage is ${this.metrics.dailyApiCalls}/${this.metrics.dailyQuotaLimit} (${summary.dailyQuotaUsagePercent.toFixed(1)}%)`,
      });
    }
    
    // Check average response time
    if (summary.avgGeminiResponseTime > 15000) {
      alerts.push({
        severity: 'warning',
        message: `Average Gemini response time is ${(summary.avgGeminiResponseTime / 1000).toFixed(1)}s (threshold: 15s)`,
      });
    }
    
    // Check error rate
    if (summary.overallErrorRate > 5) {
      alerts.push({
        severity: 'warning',
        message: `Overall error rate is ${summary.overallErrorRate.toFixed(1)}% (threshold: 5%)`,
      });
    }
    
    return alerts;
  }
}

// Singleton instance
let metricsCollectorInstance: GeminiMetricsCollector | null = null;

/**
 * Get the singleton metrics collector instance
 */
export function getGeminiMetricsCollector(): GeminiMetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new GeminiMetricsCollector();
  }
  return metricsCollectorInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetGeminiMetricsCollector(): void {
  metricsCollectorInstance = null;
}
