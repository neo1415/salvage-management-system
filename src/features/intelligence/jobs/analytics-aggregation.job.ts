/**
 * Analytics Aggregation Jobs
 * Tasks 9.2.1, 9.2.2, 9.2.3, 9.2.4, 9.2.5
 * 
 * Runs hourly, daily, weekly, and monthly rollup jobs
 * Implements retry logic with exponential backoff
 */

import cron from 'node-cron';
import { AnalyticsAggregationService } from '../services/analytics-aggregation.service';
import { getCached, setCached } from '@/lib/cache/redis';

const aggregationService = new AnalyticsAggregationService();

const LOCK_TTL = 3600; // 1 hour in seconds
const LOCK_KEY_HOURLY = 'job:lock:hourly_rollup';
const LOCK_KEY_DAILY = 'job:lock:daily_rollup';
const LOCK_KEY_WEEKLY = 'job:lock:weekly_rollup';
const LOCK_KEY_MONTHLY = 'job:lock:monthly_rollup';

let hourlyJob: cron.ScheduledTask | null = null;
let dailyJob: cron.ScheduledTask | null = null;
let weeklyJob: cron.ScheduledTask | null = null;
let monthlyJob: cron.ScheduledTask | null = null;

/**
 * Task 9.2.1: Create hourly rollup job
 */
export function startHourlyRollupJob() {
  // Run at the start of every hour
  hourlyJob = cron.schedule('0 * * * *', async () => {
    await runWithRetry('hourly_rollup', LOCK_KEY_HOURLY, async () => {
      await aggregationService.runHourlyRollup();
    });
  });

  console.log('✅ Hourly rollup job started (runs at :00 every hour)');
}

/**
 * Task 9.2.2: Create daily rollup job (runs at 1 AM)
 */
export function startDailyRollupJob() {
  // Run at 1:00 AM every day
  dailyJob = cron.schedule('0 1 * * *', async () => {
    await runWithRetry('daily_rollup', LOCK_KEY_DAILY, async () => {
      await aggregationService.runDailyRollup();
    });
  });

  console.log('✅ Daily rollup job started (runs at 1:00 AM)');
}

/**
 * Task 9.2.3: Create weekly rollup job (runs Mondays at 2 AM)
 */
export function startWeeklyRollupJob() {
  // Run at 2:00 AM every Monday (day 1)
  weeklyJob = cron.schedule('0 2 * * 1', async () => {
    await runWithRetry('weekly_rollup', LOCK_KEY_WEEKLY, async () => {
      await aggregationService.runWeeklyRollup();
    });
  });

  console.log('✅ Weekly rollup job started (runs Mondays at 2:00 AM)');
}

/**
 * Task 9.2.4: Create monthly rollup job (runs 1st of month at 3 AM)
 */
export function startMonthlyRollupJob() {
  // Run at 3:00 AM on the 1st of every month
  monthlyJob = cron.schedule('0 3 1 * *', async () => {
    await runWithRetry('monthly_rollup', LOCK_KEY_MONTHLY, async () => {
      await aggregationService.runMonthlyRollup();
    });
  });

  console.log('✅ Monthly rollup job started (runs 1st of month at 3:00 AM)');
}

/**
 * Start all analytics aggregation jobs
 */
export function startAnalyticsAggregationJobs() {
  startHourlyRollupJob();
  startDailyRollupJob();
  startWeeklyRollupJob();
  startMonthlyRollupJob();
  console.log('✅ All analytics aggregation jobs started');
}

/**
 * Stop all analytics aggregation jobs
 */
export function stopAnalyticsAggregationJobs() {
  if (hourlyJob) {
    hourlyJob.stop();
    hourlyJob = null;
  }
  if (dailyJob) {
    dailyJob.stop();
    dailyJob = null;
  }
  if (weeklyJob) {
    weeklyJob.stop();
    weeklyJob = null;
  }
  if (monthlyJob) {
    monthlyJob.stop();
    monthlyJob = null;
  }
  console.log('✅ All analytics aggregation jobs stopped');
}

/**
 * Task 9.2.5: Run job with retry logic and exponential backoff
 */
async function runWithRetry(
  jobName: string,
  lockKey: string,
  jobFunction: () => Promise<void>,
  maxRetries: number = 3
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Acquire distributed lock
    const lockAcquired = await acquireLock(lockKey);
    
    if (!lockAcquired) {
      console.log(`⏭️  ${jobName} skipped (already running)`);
      return;
    }

    console.log(`🔄 Running ${jobName}...`);

    // Task 9.2.5: Retry with exponential backoff
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await jobFunction();
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${jobName} completed successfully (${duration}ms)`);
        
        await logJobExecution(jobName, 'success', duration, attempt);
        return;

      } catch (error) {
        lastError = error;
        console.error(`❌ ${jobName} attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
        }
      }
    }

    // All retries failed
    const duration = Date.now() - startTime;
    console.error(`❌ ${jobName} failed after ${maxRetries} attempts`);
    
    await logJobExecution(jobName, 'error', duration, maxRetries, lastError);
    await sendJobFailureAlert(jobName, lastError, maxRetries);
    
    // Throw error so caller knows the job failed
    throw lastError;

  } finally {
    // Release lock
    await releaseLock(lockKey);
  }
}

/**
 * Acquire distributed lock using Redis
 */
async function acquireLock(lockKey: string): Promise<boolean> {
  try {
    const lockValue = Date.now().toString();
    const existing = await getCached<string>(lockKey);
    
    if (existing) {
      return false; // Lock already held
    }

    await setCached(lockKey, lockValue, LOCK_TTL);
    return true;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
}

/**
 * Release distributed lock
 */
async function releaseLock(lockKey: string): Promise<void> {
  try {
    await setCached(lockKey, '', 0);
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
}

/**
 * Log job execution
 */
async function logJobExecution(
  jobName: string,
  status: 'success' | 'error',
  duration: number,
  attempts: number,
  error?: any
): Promise<void> {
  try {
    const logEntry = {
      jobName,
      status,
      duration,
      attempts,
      error: error ? String(error) : null,
      timestamp: new Date().toISOString(),
    };

    console.log('📝 Job execution log:', logEntry);
  } catch (err) {
    console.error('Error logging job execution:', err);
  }
}

/**
 * Send job failure alert
 */
async function sendJobFailureAlert(
  jobName: string,
  error: any,
  attempts: number
): Promise<void> {
  try {
    console.error(`🚨 JOB FAILURE ALERT: ${jobName} (${attempts} attempts)`, error);
  } catch (err) {
    console.error('Error sending job failure alert:', err);
  }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Manual run for testing
 */
export async function runAnalyticsAggregationNow(type: 'hourly' | 'daily' | 'weekly' | 'monthly') {
  console.log(`🔄 Running ${type} rollup manually...`);
  
  const lockKey = `job:lock:${type}_rollup`;
  
  try {
    const jobFunction = async () => {
      switch (type) {
        case 'hourly':
          await aggregationService.runHourlyRollup();
          break;
        case 'daily':
          await aggregationService.runDailyRollup();
          break;
        case 'weekly':
          await aggregationService.runWeeklyRollup();
          break;
        case 'monthly':
          await aggregationService.runMonthlyRollup();
          break;
      }
    };
    
    await runWithRetry(`${type}_rollup`, lockKey, jobFunction);
    
    console.log(`✅ ${type} rollup completed successfully`);
    return { success: true };
  } catch (error) {
    console.error(`❌ ${type} rollup failed:`, error);
    return { success: false, error };
  }
}
