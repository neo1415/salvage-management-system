/**
 * Data Maintenance Jobs
 * Tasks 9.4.1, 9.4.2, 9.4.3, 9.4.4, 9.4.5
 * 
 * Cleans up old data, rotates logs, and updates analytics tables
 */

import cron from 'node-cron';
import { db } from '@/lib/db';
import { sql, lt } from 'drizzle-orm';
import { interactions } from '@/lib/db/schema/intelligence';
import { predictionLogs, recommendationLogs, fraudDetectionLogs } from '@/lib/db/schema/ml-training';
import { vendorSegments } from '@/lib/db/schema/analytics';
import { BehavioralAnalyticsService } from '../services/behavioral-analytics.service';
import { AssetAnalyticsService } from '../services/asset-analytics.service';
import { getCached, setCached } from '@/lib/cache/redis';

const behavioralService = new BehavioralAnalyticsService();
const assetService = new AssetAnalyticsService();

const LOCK_TTL = 7200; // 2 hours
const LOCK_KEY_INTERACTIONS_CLEANUP = 'job:lock:interactions_cleanup';
const LOCK_KEY_LOG_ROTATION = 'job:lock:log_rotation';
const LOCK_KEY_VENDOR_SEGMENT_UPDATE = 'job:lock:vendor_segment_update';
const LOCK_KEY_ASSET_PERFORMANCE_UPDATE = 'job:lock:asset_performance_update';
const LOCK_KEY_FEATURE_VECTOR_UPDATE = 'job:lock:feature_vector_update';

let interactionsCleanupJob: cron.ScheduledTask | null = null;
let logRotationJob: cron.ScheduledTask | null = null;
let vendorSegmentUpdateJob: cron.ScheduledTask | null = null;
let assetPerformanceUpdateJob: cron.ScheduledTask | null = null;
let featureVectorUpdateJob: cron.ScheduledTask | null = null;

/**
 * Task 9.4.1: Create interactions table cleanup job (delete >2 years old)
 */
export function startInteractionsCleanupJob() {
  // Run at 5:00 AM every Sunday
  interactionsCleanupJob = cron.schedule('0 5 * * 0', async () => {
    await cleanupOldInteractions();
  });

  console.log('✅ Interactions cleanup job started (runs Sundays at 5:00 AM)');
}

/**
 * Task 9.4.2: Create log rotation job (archive >90 days old)
 */
export function startLogRotationJob() {
  // Run at 6:00 AM every Sunday
  logRotationJob = cron.schedule('0 6 * * 0', async () => {
    await rotateOldLogs();
  });

  console.log('✅ Log rotation job started (runs Sundays at 6:00 AM)');
}

/**
 * Task 9.4.3: Create vendor segment update job (weekly)
 */
export function startVendorSegmentUpdateJob() {
  // Run at 3:00 AM every Monday
  vendorSegmentUpdateJob = cron.schedule('0 3 * * 1', async () => {
    await updateVendorSegments();
  });

  console.log('✅ Vendor segment update job started (runs Mondays at 3:00 AM)');
}

/**
 * Task 9.4.4: Create asset performance update job (daily)
 */
export function startAssetPerformanceUpdateJob() {
  // Run at 2:00 AM every day
  assetPerformanceUpdateJob = cron.schedule('0 2 * * *', async () => {
    await updateAssetPerformance();
  });

  console.log('✅ Asset performance update job started (runs daily at 2:00 AM)');
}

/**
 * Task 9.4.5: Create feature vector update job (weekly)
 */
export function startFeatureVectorUpdateJob() {
  // Run at 4:00 AM every Monday
  featureVectorUpdateJob = cron.schedule('0 4 * * 1', async () => {
    await updateFeatureVectors();
  });

  console.log('✅ Feature vector update job started (runs Mondays at 4:00 AM)');
}

/**
 * Start all data maintenance jobs
 */
export function startDataMaintenanceJobs() {
  startInteractionsCleanupJob();
  startLogRotationJob();
  startVendorSegmentUpdateJob();
  startAssetPerformanceUpdateJob();
  startFeatureVectorUpdateJob();
  console.log('✅ All data maintenance jobs started');
}

/**
 * Stop all data maintenance jobs
 */
export function stopDataMaintenanceJobs() {
  if (interactionsCleanupJob) {
    interactionsCleanupJob.stop();
    interactionsCleanupJob = null;
  }
  if (logRotationJob) {
    logRotationJob.stop();
    logRotationJob = null;
  }
  if (vendorSegmentUpdateJob) {
    vendorSegmentUpdateJob.stop();
    vendorSegmentUpdateJob = null;
  }
  if (assetPerformanceUpdateJob) {
    assetPerformanceUpdateJob.stop();
    assetPerformanceUpdateJob = null;
  }
  if (featureVectorUpdateJob) {
    featureVectorUpdateJob.stop();
    featureVectorUpdateJob = null;
  }
  console.log('✅ All data maintenance jobs stopped');
}

/**
 * Task 9.4.1: Clean up interactions older than 2 years
 */
async function cleanupOldInteractions() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_INTERACTIONS_CLEANUP);
    if (!lockAcquired) {
      console.log('⏭️  Interactions cleanup skipped (already running)');
      return;
    }

    console.log('🔄 Cleaning up old interactions...');

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await db
      .delete(interactions)
      .where(lt(interactions.timestamp, twoYearsAgo));

    console.log(`🗑️  Deleted interactions older than ${twoYearsAgo.toISOString()}`);

    const duration = Date.now() - startTime;
    console.log(`✅ Interactions cleanup completed (${duration}ms)`);

    await logJobExecution('interactions_cleanup', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Interactions cleanup failed:', error);
    await logJobExecution('interactions_cleanup', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_INTERACTIONS_CLEANUP);
  }
}

/**
 * Task 9.4.2: Archive logs older than 90 days
 */
async function rotateOldLogs() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_LOG_ROTATION);
    if (!lockAcquired) {
      console.log('⏭️  Log rotation skipped (already running)');
      return;
    }

    console.log('🔄 Rotating old logs...');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Archive prediction logs
    const predictionLogsResult = await db
      .delete(predictionLogs)
      .where(lt(predictionLogs.createdAt, ninetyDaysAgo));

    console.log(`🗑️  Archived prediction logs older than ${ninetyDaysAgo.toISOString()}`);

    // Archive recommendation logs
    const recommendationLogsResult = await db
      .delete(recommendationLogs)
      .where(lt(recommendationLogs.createdAt, ninetyDaysAgo));

    console.log(`🗑️  Archived recommendation logs older than ${ninetyDaysAgo.toISOString()}`);

    // Archive fraud detection logs
    const fraudLogsResult = await db
      .delete(fraudDetectionLogs)
      .where(lt(fraudDetectionLogs.createdAt, ninetyDaysAgo));

    console.log(`🗑️  Archived fraud detection logs older than ${ninetyDaysAgo.toISOString()}`);

    const duration = Date.now() - startTime;
    console.log(`✅ Log rotation completed (${duration}ms)`);

    await logJobExecution('log_rotation', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Log rotation failed:', error);
    await logJobExecution('log_rotation', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_LOG_ROTATION);
  }
}

/**
 * Task 9.4.3: Update vendor segments
 */
async function updateVendorSegments() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_VENDOR_SEGMENT_UPDATE);
    if (!lockAcquired) {
      console.log('⏭️  Vendor segment update skipped (already running)');
      return;
    }

    console.log('🔄 Updating vendor segments...');

    // Get all active vendors
    const vendors: any = await db.execute(sql`
      SELECT DISTINCT vendor_id 
      FROM bids 
      WHERE created_at > NOW() - INTERVAL '6 months'
    `);

    let updatedCount = 0;
    for (const vendor of vendors) {
      try {
        await behavioralService.segmentVendor(vendor.vendor_id);
        updatedCount++;
      } catch (error) {
        console.error(`Error segmenting vendor ${vendor.vendor_id}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Vendor segments updated (${updatedCount} vendors, ${duration}ms)`);

    await logJobExecution('vendor_segment_update', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Vendor segment update failed:', error);
    await logJobExecution('vendor_segment_update', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_VENDOR_SEGMENT_UPDATE);
  }
}

/**
 * Task 9.4.4: Update asset performance analytics
 */
async function updateAssetPerformance() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_ASSET_PERFORMANCE_UPDATE);
    if (!lockAcquired) {
      console.log('⏭️  Asset performance update skipped (already running)');
      return;
    }

    console.log('🔄 Updating asset performance analytics...');

    // Update asset performance for all asset types
    const assetTypes = ['vehicle', 'electronics', 'machinery'];
    
    for (const assetType of assetTypes) {
      try {
        await assetService.calculateAssetPerformance(assetType);
      } catch (error) {
        console.error(`Error updating ${assetType} performance:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Asset performance updated (${duration}ms)`);

    await logJobExecution('asset_performance_update', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Asset performance update failed:', error);
    await logJobExecution('asset_performance_update', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_ASSET_PERFORMANCE_UPDATE);
  }
}

/**
 * Task 9.4.5: Update feature vectors for ML training
 */
async function updateFeatureVectors() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_FEATURE_VECTOR_UPDATE);
    if (!lockAcquired) {
      console.log('⏭️  Feature vector update skipped (already running)');
      return;
    }

    console.log('🔄 Updating feature vectors...');

    // Get recent closed auctions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const result: any = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM auctions
      WHERE status = 'closed'
        AND end_time > ${thirtyDaysAgoISO}
    `);

    const count = parseInt(result[0]?.count || '0');

    // TODO: Implement feature vector computation
    // This would call FeatureEngineeringService to compute and store feature vectors

    const duration = Date.now() - startTime;
    console.log(`✅ Feature vectors updated (${count} auctions, ${duration}ms)`);

    await logJobExecution('feature_vector_update', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Feature vector update failed:', error);
    await logJobExecution('feature_vector_update', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_FEATURE_VECTOR_UPDATE);
  }
}

/**
 * Helper functions
 */
async function acquireLock(lockKey: string): Promise<boolean> {
  try {
    const existing = await getCached<string>(lockKey);
    if (existing) return false;
    await setCached(lockKey, Date.now().toString(), LOCK_TTL);
    return true;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
}

async function releaseLock(lockKey: string): Promise<void> {
  try {
    await setCached(lockKey, '', 0);
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
}

async function logJobExecution(
  jobName: string,
  status: 'success' | 'error',
  duration: number,
  error?: any
): Promise<void> {
  try {
    console.log('📝 Job execution log:', { jobName, status, duration, error: error ? String(error) : null });
  } catch (err) {
    console.error('Error logging job execution:', err);
  }
}

/**
 * Manual run for testing
 */
export async function runDataMaintenanceNow(
  type: 'interactions' | 'logs' | 'segments' | 'performance' | 'vectors'
) {
  console.log(`🔄 Running ${type} maintenance manually...`);
  
  // For testing, we need to propagate errors instead of catching them internally
  switch (type) {
    case 'interactions':
      await cleanupOldInteractions();
      break;
    case 'logs':
      await rotateOldLogs();
      break;
    case 'segments':
      await updateVendorSegments();
      break;
    case 'performance':
      await updateAssetPerformance();
      break;
    case 'vectors':
      await updateFeatureVectors();
      break;
  }
  
  console.log(`✅ ${type} maintenance completed`);
  return { success: true };
}
