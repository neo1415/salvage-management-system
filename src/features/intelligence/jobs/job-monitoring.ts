/**
 * Job Monitoring System
 * Phase 16: Tasks 16.2.1, 16.2.2, 16.2.3
 * 
 * Monitors job execution, handles failures, and tracks performance metrics
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getCached, setCached } from '@/lib/cache/redis';

/**
 * Job execution log entry
 */
export interface JobExecutionLog {
  jobName: string;
  status: 'success' | 'error' | 'skipped' | 'running';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Job performance metrics
 */
export interface JobPerformanceMetrics {
  jobName: string;
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecution?: Date;
  lastStatus?: string;
  successRate: number;
}

/**
 * In-memory job execution logs (last 1000 entries)
 */
const jobExecutionLogs: JobExecutionLog[] = [];
const MAX_LOG_ENTRIES = 1000;

/**
 * Job performance metrics cache
 */
const jobMetrics = new Map<string, JobPerformanceMetrics>();

/**
 * Task 16.2.1: Implement job execution logging
 */
export async function logJobExecution(
  jobName: string,
  status: 'success' | 'error' | 'skipped',
  duration: number,
  error?: any,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const now = new Date();
    const startTime = new Date(now.getTime() - duration);

    const logEntry: JobExecutionLog = {
      jobName,
      status,
      startTime,
      endTime: now,
      duration,
      error: error ? String(error) : undefined,
      metadata
    };

    // Add to in-memory log
    jobExecutionLogs.push(logEntry);
    
    // Keep only last 1000 entries
    if (jobExecutionLogs.length > MAX_LOG_ENTRIES) {
      jobExecutionLogs.shift();
    }

    // Update metrics
    updateJobMetrics(jobName, logEntry);

    // Cache recent logs in Redis (last 100 per job)
    await cacheJobLog(jobName, logEntry);

    // Task 16.2.2: Implement job failure alerting
    if (status === 'error') {
      await handleJobFailure(jobName, error, metadata);
    }

    console.log(`📝 Job logged: ${jobName} - ${status} (${duration}ms)`);
  } catch (err) {
    console.error('Error logging job execution:', err);
  }
}

/**
 * Log job start
 */
export async function logJobStart(jobName: string): Promise<void> {
  try {
    const logEntry: JobExecutionLog = {
      jobName,
      status: 'running',
      startTime: new Date()
    };

    jobExecutionLogs.push(logEntry);
    
    if (jobExecutionLogs.length > MAX_LOG_ENTRIES) {
      jobExecutionLogs.shift();
    }

    console.log(`▶️  Job started: ${jobName}`);
  } catch (err) {
    console.error('Error logging job start:', err);
  }
}

/**
 * Task 16.2.3: Update job performance metrics
 */
function updateJobMetrics(jobName: string, logEntry: JobExecutionLog): void {
  let metrics = jobMetrics.get(jobName);

  if (!metrics) {
    metrics = {
      jobName,
      totalExecutions: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      successRate: 0
    };
  }

  // Update counts
  metrics.totalExecutions++;
  if (logEntry.status === 'success') metrics.successCount++;
  if (logEntry.status === 'error') metrics.errorCount++;
  if (logEntry.status === 'skipped') metrics.skippedCount++;

  // Update duration stats
  if (logEntry.duration) {
    metrics.minDuration = Math.min(metrics.minDuration, logEntry.duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, logEntry.duration);
    
    // Calculate running average
    const totalDuration = metrics.avgDuration * (metrics.totalExecutions - 1) + logEntry.duration;
    metrics.avgDuration = totalDuration / metrics.totalExecutions;
  }

  // Update last execution
  metrics.lastExecution = logEntry.endTime || logEntry.startTime;
  metrics.lastStatus = logEntry.status;

  // Calculate success rate
  metrics.successRate = metrics.successCount / metrics.totalExecutions;

  jobMetrics.set(jobName, metrics);
}

/**
 * Task 16.2.2: Handle job failure and send alerts
 */
async function handleJobFailure(
  jobName: string,
  error: any,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const metrics = jobMetrics.get(jobName);
    const consecutiveFailures = await getConsecutiveFailures(jobName);

    console.error(`🚨 JOB FAILURE: ${jobName}`, {
      error: String(error),
      consecutiveFailures,
      metadata
    });

    // Alert on consecutive failures
    if (consecutiveFailures >= 3) {
      await sendJobFailureAlert(jobName, error, consecutiveFailures, metadata);
    }

    // Store failure in Redis for tracking
    await trackJobFailure(jobName, error);
  } catch (err) {
    console.error('Error handling job failure:', err);
  }
}

/**
 * Send job failure alert
 */
async function sendJobFailureAlert(
  jobName: string,
  error: any,
  consecutiveFailures: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const alertData = {
      jobName,
      error: String(error),
      consecutiveFailures,
      metadata,
      timestamp: new Date().toISOString()
    };

    console.error(`🚨🚨🚨 CRITICAL: Job ${jobName} has failed ${consecutiveFailures} times consecutively!`, alertData);

    // TODO: Send Socket.IO notification to admins
    // TODO: Send email alert
    // TODO: Send Slack/Discord webhook notification
  } catch (err) {
    console.error('Error sending job failure alert:', err);
  }
}

/**
 * Get consecutive failure count for a job
 */
async function getConsecutiveFailures(jobName: string): Promise<number> {
  try {
    const recentLogs = jobExecutionLogs
      .filter(log => log.jobName === jobName && log.status !== 'running')
      .slice(-10)
      .reverse();

    let count = 0;
    for (const log of recentLogs) {
      if (log.status === 'error') {
        count++;
      } else {
        break;
      }
    }

    return count;
  } catch (error) {
    console.error('Error getting consecutive failures:', error);
    return 0;
  }
}

/**
 * Track job failure in Redis
 */
async function trackJobFailure(jobName: string, error: any): Promise<void> {
  try {
    const key = `job:failures:${jobName}`;
    const failures = await getCached<any[]>(key) || [];
    
    failures.push({
      error: String(error),
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 failures
    if (failures.length > 20) {
      failures.shift();
    }

    await setCached(key, failures, 86400); // 24 hours TTL
  } catch (err) {
    console.error('Error tracking job failure:', err);
  }
}

/**
 * Cache job log in Redis
 */
async function cacheJobLog(jobName: string, logEntry: JobExecutionLog): Promise<void> {
  try {
    const key = `job:logs:${jobName}`;
    const logs = await getCached<JobExecutionLog[]>(key) || [];
    
    logs.push(logEntry);

    // Keep only last 100 logs per job
    if (logs.length > 100) {
      logs.shift();
    }

    await setCached(key, logs, 86400); // 24 hours TTL
  } catch (err) {
    console.error('Error caching job log:', err);
  }
}

/**
 * Task 16.2.3: Get job performance metrics
 */
export function getJobPerformanceMetrics(jobName?: string): JobPerformanceMetrics | JobPerformanceMetrics[] {
  if (jobName) {
    return jobMetrics.get(jobName) || {
      jobName,
      totalExecutions: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      successRate: 0
    };
  }

  return Array.from(jobMetrics.values());
}

/**
 * Get recent job execution logs
 */
export function getRecentJobLogs(jobName?: string, limit: number = 50): JobExecutionLog[] {
  let logs = jobExecutionLogs;

  if (jobName) {
    logs = logs.filter(log => log.jobName === jobName);
  }

  return logs.slice(-limit).reverse();
}

/**
 * Get job execution logs from Redis
 */
export async function getJobLogsFromCache(jobName: string): Promise<JobExecutionLog[]> {
  try {
    const key = `job:logs:${jobName}`;
    return await getCached<JobExecutionLog[]>(key) || [];
  } catch (error) {
    console.error('Error getting job logs from cache:', error);
    return [];
  }
}

/**
 * Get job failure history from Redis
 */
export async function getJobFailureHistory(jobName: string): Promise<any[]> {
  try {
    const key = `job:failures:${jobName}`;
    return await getCached<any[]>(key) || [];
  } catch (error) {
    console.error('Error getting job failure history:', error);
    return [];
  }
}

/**
 * Get overall job health status
 */
export function getJobHealthStatus(): {
  healthy: boolean;
  totalJobs: number;
  healthyJobs: number;
  unhealthyJobs: number;
  jobs: Array<{
    jobName: string;
    status: 'healthy' | 'warning' | 'critical';
    successRate: number;
    lastExecution?: Date;
    lastStatus?: string;
  }>;
} {
  const allMetrics = Array.from(jobMetrics.values());
  const jobs = allMetrics.map(metrics => {
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (metrics.successRate < 0.5) {
      status = 'critical';
    } else if (metrics.successRate < 0.8) {
      status = 'warning';
    }

    // Check if job hasn't run recently (more than 2 hours for hourly jobs)
    if (metrics.lastExecution) {
      const hoursSinceLastRun = (Date.now() - metrics.lastExecution.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun > 2 && status === 'healthy') {
        status = 'warning';
      }
    }

    return {
      jobName: metrics.jobName,
      status,
      successRate: metrics.successRate,
      lastExecution: metrics.lastExecution,
      lastStatus: metrics.lastStatus
    };
  });

  const healthyJobs = jobs.filter(j => j.status === 'healthy').length;
  const unhealthyJobs = jobs.filter(j => j.status !== 'healthy').length;

  return {
    healthy: unhealthyJobs === 0,
    totalJobs: jobs.length,
    healthyJobs,
    unhealthyJobs,
    jobs
  };
}

/**
 * Clear job metrics (for testing)
 */
export function clearJobMetrics(): void {
  jobMetrics.clear();
  jobExecutionLogs.length = 0;
  console.log('✅ Job metrics cleared');
}
