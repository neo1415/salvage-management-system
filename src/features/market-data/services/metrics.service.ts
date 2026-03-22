/**
 * Metrics Service
 * 
 * Tracks and logs metrics for market data scraping system:
 * - Scraping success rate
 * - Cache hit rate
 * - Response time
 * - Source availability
 * 
 * Requirements: 11.5
 */

import { db } from '@/lib/db/drizzle';
import { scrapingLogs } from '@/lib/db/schema/market-data';
import { sql } from 'drizzle-orm';

export interface ScrapingMetrics {
  totalRequests: number;
  successfulScrapes: number;
  failedScrapes: number;
  successRate: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  averageResponseTime: number;
  sourceMetrics: SourceMetrics[];
}

export interface SourceMetrics {
  source: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
}

export interface MetricsTarget {
  metric: string;
  target: number;
  actual: number;
  met: boolean;
}

/**
 * Get scraping metrics for a time period
 */
export async function getScrapingMetrics(params: {
  startDate: Date;
  endDate: Date;
}): Promise<ScrapingMetrics> {
  const { startDate, endDate } = params;

  // Get overall metrics
  const overallMetrics = await db
    .select({
      totalRequests: sql<number>`COUNT(*)`,
      successfulScrapes: sql<number>`COUNT(*) FILTER (WHERE status = 'success')`,
      failedScrapes: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
      cacheHits: sql<number>`COUNT(*) FILTER (WHERE status = 'cache_hit')`,
      cacheMisses: sql<number>`COUNT(*) FILTER (WHERE status = 'cache_miss')`,
      averageResponseTime: sql<number>`AVG(duration_ms)`,
    })
    .from(scrapingLogs)
    .where(
      sql`${scrapingLogs.createdAt} >= ${startDate} AND ${scrapingLogs.createdAt} <= ${endDate}`
    );

  const overall = overallMetrics[0];

  // Get per-source metrics
  const sourceMetricsData = await db
    .select({
      source: scrapingLogs.sourceName,
      totalRequests: sql<number>`COUNT(*)`,
      successfulRequests: sql<number>`COUNT(*) FILTER (WHERE status = 'success')`,
      failedRequests: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
      averageResponseTime: sql<number>`AVG(duration_ms)`,
      lastSuccess: sql<Date | null>`MAX(created_at) FILTER (WHERE status = 'success')`,
      lastFailure: sql<Date | null>`MAX(created_at) FILTER (WHERE status = 'failed')`,
    })
    .from(scrapingLogs)
    .where(
      sql`${scrapingLogs.createdAt} >= ${startDate} AND ${scrapingLogs.createdAt} <= ${endDate}`
    )
    .groupBy(scrapingLogs.sourceName);

  const sourceMetrics: SourceMetrics[] = sourceMetricsData.map((source) => ({
    source: source.source,
    totalRequests: source.totalRequests,
    successfulRequests: source.successfulRequests,
    failedRequests: source.failedRequests,
    successRate:
      source.totalRequests > 0
        ? (source.successfulRequests / source.totalRequests) * 100
        : 0,
    averageResponseTime: source.averageResponseTime,
    lastSuccess: source.lastSuccess,
    lastFailure: source.lastFailure,
  }));

  return {
    totalRequests: overall.totalRequests,
    successfulScrapes: overall.successfulScrapes,
    failedScrapes: overall.failedScrapes,
    successRate:
      overall.totalRequests > 0
        ? (overall.successfulScrapes / overall.totalRequests) * 100
        : 0,
    cacheHits: overall.cacheHits,
    cacheMisses: overall.cacheMisses,
    cacheHitRate:
      overall.cacheHits + overall.cacheMisses > 0
        ? (overall.cacheHits / (overall.cacheHits + overall.cacheMisses)) * 100
        : 0,
    averageResponseTime: overall.averageResponseTime,
    sourceMetrics,
  };
}

/**
 * Check if metrics meet targets
 * 
 * Requirement 11.5: Log detailed metrics when targets are not met
 */
export async function checkMetricsTargets(params: {
  startDate: Date;
  endDate: Date;
}): Promise<MetricsTarget[]> {
  const metrics = await getScrapingMetrics(params);

  const targets: MetricsTarget[] = [
    {
      metric: 'Scraping Success Rate',
      target: 70,
      actual: metrics.successRate,
      met: metrics.successRate >= 70,
    },
    {
      metric: 'Cache Hit Rate (30 days)',
      target: 80,
      actual: metrics.cacheHitRate,
      met: metrics.cacheHitRate >= 80,
    },
    {
      metric: 'Market Price Availability',
      target: 70,
      actual: (metrics.successfulScrapes / metrics.totalRequests) * 100,
      met: (metrics.successfulScrapes / metrics.totalRequests) * 100 >= 70,
    },
  ];

  // Log unmet targets
  const unmetTargets = targets.filter((t) => !t.met);
  if (unmetTargets.length > 0) {
    console.warn('⚠️ Metrics targets not met:', unmetTargets);
    
    // Log detailed metrics for analysis
    await logMetricsForAnalysis({
      timestamp: new Date(),
      targets: unmetTargets,
      metrics,
    });
  }

  return targets;
}

/**
 * Log metrics for analysis when targets are not met
 */
async function logMetricsForAnalysis(params: {
  timestamp: Date;
  targets: MetricsTarget[];
  metrics: ScrapingMetrics;
}): Promise<void> {
  const { timestamp, targets, metrics } = params;

  console.log('📊 Detailed Metrics Analysis:', {
    timestamp,
    unmetTargets: targets,
    overallMetrics: {
      totalRequests: metrics.totalRequests,
      successRate: `${metrics.successRate.toFixed(2)}%`,
      cacheHitRate: `${metrics.cacheHitRate.toFixed(2)}%`,
      averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
    },
    sourceBreakdown: metrics.sourceMetrics.map((source) => ({
      source: source.source,
      successRate: `${source.successRate.toFixed(2)}%`,
      averageResponseTime: `${source.averageResponseTime.toFixed(0)}ms`,
      lastSuccess: source.lastSuccess,
      lastFailure: source.lastFailure,
    })),
  });

  // TODO: Send to monitoring service (e.g., Sentry, DataDog, CloudWatch)
  // This would be implemented based on the monitoring service used
}

/**
 * Get metrics summary for dashboard
 */
export async function getMetricsSummary(): Promise<{
  last24Hours: ScrapingMetrics;
  last7Days: ScrapingMetrics;
  last30Days: ScrapingMetrics;
  targets: MetricsTarget[];
}> {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    metrics24h,
    metrics7d,
    metrics30d,
    targets,
  ] = await Promise.all([
    getScrapingMetrics({ startDate: last24Hours, endDate: now }),
    getScrapingMetrics({ startDate: last7Days, endDate: now }),
    getScrapingMetrics({ startDate: last30Days, endDate: now }),
    checkMetricsTargets({ startDate: last30Days, endDate: now }),
  ]);

  return {
    last24Hours: metrics24h,
    last7Days: metrics7d,
    last30Days: metrics30d,
    targets,
  };
}

/**
 * Log a scraping operation metric
 */
export async function logScrapingOperation(params: {
  propertyHash: string;
  source: string;
  status: 'success' | 'failed' | 'cache_hit' | 'cache_miss';
  pricesFound?: number;
  durationMs: number;
  errorMessage?: string;
}): Promise<void> {
  const { propertyHash, source, status, pricesFound, durationMs, errorMessage } = params;

  await db.insert(scrapingLogs).values({
    propertyHash,
    sourceName: source,
    status,
    pricesFound: pricesFound || 0,
    durationMs,
    errorMessage,
  });
}

