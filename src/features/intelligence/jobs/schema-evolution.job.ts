/**
 * Schema Evolution Jobs
 * Tasks 9.5.1, 9.5.2, 9.5.3
 * 
 * Detects new asset types and attributes, and expands analytics tables automatically
 */

import cron from 'node-cron';
import { SchemaEvolutionService } from '../services/schema-evolution.service';
import { getCached, setCached } from '@/lib/cache/redis';

const schemaService = new SchemaEvolutionService();

const LOCK_TTL = 3600; // 1 hour
const LOCK_KEY_ASSET_TYPE_DETECTION = 'job:lock:asset_type_detection';
const LOCK_KEY_ATTRIBUTE_DETECTION = 'job:lock:attribute_detection';

let assetTypeDetectionJob: cron.ScheduledTask | null = null;
let attributeDetectionJob: cron.ScheduledTask | null = null;

/**
 * Task 9.5.1: Create new asset type detection job (daily)
 */
export function startAssetTypeDetectionJob() {
  // Run at 5:00 AM every day
  assetTypeDetectionJob = cron.schedule('0 5 * * *', async () => {
    await detectNewAssetTypes();
  });

  console.log('✅ Asset type detection job started (runs daily at 5:00 AM)');
}

/**
 * Task 9.5.2: Create new attribute detection job (daily)
 */
export function startAttributeDetectionJob() {
  // Run at 5:30 AM every day
  attributeDetectionJob = cron.schedule('30 5 * * *', async () => {
    await detectNewAttributes();
  });

  console.log('✅ Attribute detection job started (runs daily at 5:30 AM)');
}

/**
 * Start all schema evolution jobs
 */
export function startSchemaEvolutionJobs() {
  startAssetTypeDetectionJob();
  startAttributeDetectionJob();
  console.log('✅ All schema evolution jobs started');
}

/**
 * Stop all schema evolution jobs
 */
export function stopSchemaEvolutionJobs() {
  if (assetTypeDetectionJob) {
    assetTypeDetectionJob.stop();
    assetTypeDetectionJob = null;
  }
  if (attributeDetectionJob) {
    attributeDetectionJob.stop();
    attributeDetectionJob = null;
  }
  console.log('✅ All schema evolution jobs stopped');
}

/**
 * Task 9.5.1: Detect new asset types
 */
async function detectNewAssetTypes() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_ASSET_TYPE_DETECTION);
    if (!lockAcquired) {
      console.log('⏭️  Asset type detection skipped (already running)');
      return;
    }

    console.log('🔄 Detecting new asset types...');

    const newAssetTypes = await schemaService.detectNewAssetTypes();

    if (newAssetTypes.length > 0) {
      console.log(`🆕 Detected ${newAssetTypes.length} new asset types:`, newAssetTypes);

      // Task 9.5.3: Automatically expand analytics tables
      for (const assetType of newAssetTypes) {
        try {
          await schemaService.expandAnalyticsTables(assetType);
          console.log(`✅ Expanded analytics tables for asset type: ${assetType}`);
        } catch (error) {
          console.error(`❌ Failed to expand analytics for ${assetType}:`, error);
        }
      }
    } else {
      console.log('✅ No new asset types detected');
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Asset type detection completed (${duration}ms)`);

    await logJobExecution('asset_type_detection', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Asset type detection failed:', error);
    await logJobExecution('asset_type_detection', 'error', duration, error);
    throw error; // Re-throw so manual run can catch it
  } finally {
    await releaseLock(LOCK_KEY_ASSET_TYPE_DETECTION);
  }
}

/**
 * Task 9.5.2: Detect new attributes
 */
async function detectNewAttributes() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_ATTRIBUTE_DETECTION);
    if (!lockAcquired) {
      console.log('⏭️  Attribute detection skipped (already running)');
      return;
    }

    console.log('🔄 Detecting new attributes...');

    const newAttributes = await schemaService.detectNewAttributes();

    if (newAttributes.length > 0) {
      console.log(`🆕 Detected ${newAttributes.length} new attributes:`, newAttributes);

      // Task 9.5.3: Automatically expand analytics tables
      for (const attribute of newAttributes) {
        try {
          await schemaService.expandAnalyticsTablesForAttribute(attribute);
          console.log(`✅ Expanded analytics tables for attribute: ${attribute.attributeName} (${attribute.assetType})`);
        } catch (error) {
          console.error(`❌ Failed to expand analytics for ${attribute.attributeName}:`, error);
        }
      }
    } else {
      console.log('✅ No new attributes detected');
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Attribute detection completed (${duration}ms)`);

    await logJobExecution('attribute_detection', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Attribute detection failed:', error);
    await logJobExecution('attribute_detection', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_ATTRIBUTE_DETECTION);
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
export async function runSchemaEvolutionNow(type: 'asset-types' | 'attributes') {
  console.log(`🔄 Running ${type} detection manually...`);
  
  try {
    switch (type) {
      case 'asset-types':
        await detectNewAssetTypes();
        break;
      case 'attributes':
        await detectNewAttributes();
        break;
    }
    
    console.log(`✅ ${type} detection completed`);
    return { success: true };
  } catch (error) {
    console.error(`❌ ${type} detection failed:`, error);
    return { success: false, error };
  }
}
