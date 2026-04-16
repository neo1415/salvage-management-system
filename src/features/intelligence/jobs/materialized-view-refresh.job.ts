/**
 * Materialized View Refresh Jobs
 * Tasks 9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5
 * 
 * Refreshes materialized views every 5 minutes with job locking
 * Uses node-cron for scheduling and Redis for distributed locking
 */

import cron from 'node-cron';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getCached, setCached } from '@/lib/cache/redis';

const LOCK_TTL = 300; // 5 minutes in seconds
const LOCK_KEY_BIDDING_PATTERNS = 'job:lock:refresh_bidding_patterns';
const LOCK_KEY_MARKET_CONDITIONS = 'job:lock:refresh_market_conditions';

let biddingPatternsJob: cron.ScheduledTask | null = null;
let marketConditionsJob: cron.ScheduledTask | null = null;

/**
 * Task 9.1.1: Refresh vendor_bidding_patterns_mv every 5 minutes
 */
export function startVendorBiddingPatternsRefreshJob() {
  // Run every 5 minutes
  biddingPatternsJob = cron.schedule('*/5 * * * *', async () => {
    await refreshVendorBiddingPatterns();
  });

  console.log('✅ Vendor bidding patterns refresh job started (every 5 minutes)');
}

/**
 * Task 9.1.2: Refresh market_conditions_mv every 5 minutes
 */
export function startMarketConditionsRefreshJob() {
  // Run every 5 minutes
  marketConditionsJob = cron.schedule('*/5 * * * *', async () => {
    await refreshMarketConditions();
  });

  console.log('✅ Market conditions refresh job started (every 5 minutes)');
}

/**
 * Task 9.1.3: Start all materialized view refresh jobs
 */
export function startMaterializedViewRefreshJobs() {
  startVendorBiddingPatternsRefreshJob();
  startMarketConditionsRefreshJob();
  console.log('✅ All materialized view refresh jobs started');
}

/**
 * Stop all materialized view refresh jobs
 */
export function stopMaterializedViewRefreshJobs() {
  if (biddingPatternsJob) {
    biddingPatternsJob.stop();
    biddingPatternsJob = null;
  }
  if (marketConditionsJob) {
    marketConditionsJob.stop();
    marketConditionsJob = null;
  }
  console.log('✅ All materialized view refresh jobs stopped');
}

/**
 * Task 9.1.4: Refresh vendor bidding patterns with job locking
 */
async function refreshVendorBiddingPatterns() {
  const startTime = Date.now();
  
  try {
    // Task 9.1.4: Acquire distributed lock
    const lockAcquired = await acquireLock(LOCK_KEY_BIDDING_PATTERNS);
    
    if (!lockAcquired) {
      console.log('⏭️  Vendor bidding patterns refresh skipped (already running)');
      return;
    }

    console.log('🔄 Refreshing vendor_bidding_patterns_mv...');

    // Refresh materialized view
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns_mv`);

    const duration = Date.now() - startTime;
    console.log(`✅ Vendor bidding patterns refreshed successfully (${duration}ms)`);

    // Task 9.1.5: Log success
    await logJobExecution('vendor_bidding_patterns_refresh', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Vendor bidding patterns refresh failed:', error);

    // Task 9.1.5: Log error and send alert
    await logJobExecution('vendor_bidding_patterns_refresh', 'error', duration, error);
    await sendJobFailureAlert('vendor_bidding_patterns_refresh', error);

  } finally {
    // Release lock
    await releaseLock(LOCK_KEY_BIDDING_PATTERNS);
  }
}

/**
 * Task 9.1.4: Refresh market conditions with job locking
 */
async function refreshMarketConditions() {
  const startTime = Date.now();
  
  try {
    // Task 9.1.4: Acquire distributed lock
    const lockAcquired = await acquireLock(LOCK_KEY_MARKET_CONDITIONS);
    
    if (!lockAcquired) {
      console.log('⏭️  Market conditions refresh skipped (already running)');
      return;
    }

    console.log('🔄 Refreshing market_conditions_mv...');

    // Refresh materialized view
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY market_conditions_mv`);

    const duration = Date.now() - startTime;
    console.log(`✅ Market conditions refreshed successfully (${duration}ms)`);

    // Task 9.1.5: Log success
    await logJobExecution('market_conditions_refresh', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Market conditions refresh failed:', error);

    // Task 9.1.5: Log error and send alert
    await logJobExecution('market_conditions_refresh', 'error', duration, error);
    await sendJobFailureAlert('market_conditions_refresh', error);

  } finally {
    // Release lock
    await releaseLock(LOCK_KEY_MARKET_CONDITIONS);
  }
}

/**
 * Task 9.1.4: Acquire distributed lock using Redis
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
    // Delete lock key from Redis
    await setCached(lockKey, '', 0);
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
}

/**
 * Task 9.1.5: Log job execution
 */
async function logJobExecution(
  jobName: string,
  status: 'success' | 'error',
  duration: number,
  error?: any
): Promise<void> {
  try {
    const logEntry = {
      jobName,
      status,
      duration,
      error: error ? String(error) : null,
      timestamp: new Date().toISOString(),
    };

    console.log('📝 Job execution log:', logEntry);
    
    // Store in database or monitoring system
    // TODO: Implement job execution logging table
  } catch (err) {
    console.error('Error logging job execution:', err);
  }
}

/**
 * Task 9.1.5: Send job failure alert
 */
async function sendJobFailureAlert(jobName: string, error: any): Promise<void> {
  try {
    console.error(`🚨 JOB FAILURE ALERT: ${jobName}`, error);
    
    // TODO: Send alert via Socket.IO to admins
    // TODO: Send email notification
    // TODO: Log to monitoring system
  } catch (err) {
    console.error('Error sending job failure alert:', err);
  }
}

/**
 * Manual refresh for testing
 */
export async function refreshMaterializedViewsNow() {
  console.log('🔄 Running materialized view refresh manually...');
  
  try {
    await refreshVendorBiddingPatterns();
    await refreshMarketConditions();
    console.log('✅ Materialized views refreshed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Materialized view refresh failed:', error);
    return { success: false, error };
  }
}
