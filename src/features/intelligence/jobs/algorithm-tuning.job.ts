/**
 * Algorithm Tuning Job
 * Phase 16: Tasks 16.1.1, 16.1.2, 16.1.3, 16.1.4, 16.1.5
 * 
 * Automatically tunes algorithm parameters based on accuracy metrics
 */

import cron from 'node-cron';
import { db } from '@/lib/db';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { algorithmConfig } from '@/lib/db/schema/intelligence';
import { algorithmConfigHistory } from '@/lib/db/schema/ml-training';
import { predictions } from '@/lib/db/schema/intelligence';
import { auctions } from '@/lib/db/schema/auctions';
import { getCached, setCached } from '@/lib/cache/redis';

const LOCK_TTL = 7200; // 2 hours
const LOCK_KEY_ALGORITHM_TUNING = 'job:lock:algorithm_parameter_tuning';

let algorithmTuningJob: cron.ScheduledTask | null = null;

/**
 * Task 16.1.1: Create algorithm parameter tuning job (daily at 2 AM)
 */
export function startAlgorithmTuningJob() {
  // Run at 2:00 AM every day
  algorithmTuningJob = cron.schedule('0 2 * * *', async () => {
    await tuneAlgorithmParameters();
  });

  console.log('✅ Algorithm tuning job started (runs daily at 2:00 AM)');
}

/**
 * Stop algorithm tuning job
 */
export function stopAlgorithmTuningJob() {
  if (algorithmTuningJob) {
    algorithmTuningJob.stop();
    algorithmTuningJob = null;
  }
  console.log('✅ Algorithm tuning job stopped');
}

/**
 * Main algorithm tuning function
 * Tasks 16.1.2, 16.1.3, 16.1.4
 */
async function tuneAlgorithmParameters() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_ALGORITHM_TUNING);
    if (!lockAcquired) {
      console.log('⏭️  Algorithm tuning skipped (already running)');
      return;
    }

    console.log('🔄 Tuning algorithm parameters...');

    // Get accuracy metrics from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const accuracyMetrics: any = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_predictions,
        AVG(ABS(p.predicted_price - a.current_bid) / NULLIF(a.current_bid, 0)) AS avg_error_rate,
        COUNT(*) FILTER (
          WHERE a.current_bid BETWEEN p.lower_bound AND p.upper_bound
        )::float / NULLIF(COUNT(*), 0) AS bounds_accuracy,
        AVG(p.confidence_score) AS avg_confidence_score,
        STDDEV(ABS(p.predicted_price - a.current_bid) / NULLIF(a.current_bid, 0)) AS error_stddev
      FROM ${predictions} p
      JOIN ${auctions} a ON p.auction_id = a.id
      WHERE a.status = 'closed'
        AND a.end_time > ${thirtyDaysAgoISO}
        AND a.current_bid IS NOT NULL
        AND p.method = 'historical'
    `);

    const metrics = accuracyMetrics[0];
    const totalPredictions = parseInt(metrics?.total_predictions || '0');
    const avgErrorRate = parseFloat(metrics?.avg_error_rate || '0');
    const boundsAccuracy = parseFloat(metrics?.bounds_accuracy || '0');
    const avgConfidenceScore = parseFloat(metrics?.avg_confidence_score || '0');
    const errorStddev = parseFloat(metrics?.error_stddev || '0');

    console.log(`📊 30-Day Accuracy Metrics:
      - Total Predictions: ${totalPredictions}
      - Avg Error Rate: ${(avgErrorRate * 100).toFixed(2)}%
      - Bounds Accuracy: ${(boundsAccuracy * 100).toFixed(2)}%
      - Avg Confidence: ${avgConfidenceScore.toFixed(4)}
      - Error Std Dev: ${(errorStddev * 100).toFixed(2)}%
    `);

    // Skip tuning if insufficient data
    if (totalPredictions < 20) {
      console.log('⏭️  Insufficient data for tuning (need at least 20 predictions)');
      const duration = Date.now() - startTime;
      await logJobExecution('algorithm_tuning', 'skipped', duration);
      return;
    }

    // Task 16.1.2: Implement accuracy-based threshold adjustment
    await adjustSimilarityThreshold(avgErrorRate, boundsAccuracy, totalPredictions);

    // Task 16.1.3: Implement automatic similarity threshold tuning
    await tuneConfidenceParameters(avgConfidenceScore, boundsAccuracy);

    const duration = Date.now() - startTime;
    console.log(`✅ Algorithm parameters tuned (${duration}ms)`);

    await logJobExecution('algorithm_tuning', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Algorithm tuning failed:', error);
    await logJobExecution('algorithm_tuning', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_ALGORITHM_TUNING);
  }
}

/**
 * Task 16.1.2: Adjust similarity threshold based on accuracy
 */
async function adjustSimilarityThreshold(
  avgErrorRate: number,
  boundsAccuracy: number,
  totalPredictions: number
): Promise<void> {
  try {
    // Get current similarity threshold
    const currentConfig = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
      .limit(1);

    if (currentConfig.length === 0) {
      console.log('⚠️  Similarity threshold config not found');
      return;
    }

    const currentThreshold = parseFloat(currentConfig[0].configValue as any);
    let newThreshold = currentThreshold;
    let reason = '';

    // Decision logic for threshold adjustment
    if (avgErrorRate > 0.15) {
      // High error rate: increase threshold (be more selective)
      newThreshold = Math.min(80, currentThreshold + 5);
      reason = `High error rate (${(avgErrorRate * 100).toFixed(2)}%) - increasing selectivity`;
    } else if (avgErrorRate > 0.12) {
      // Moderate error rate: slight increase
      newThreshold = Math.min(75, currentThreshold + 2);
      reason = `Moderate error rate (${(avgErrorRate * 100).toFixed(2)}%) - slight increase`;
    } else if (avgErrorRate < 0.08 && boundsAccuracy > 0.85) {
      // Low error rate and high bounds accuracy: decrease threshold (be more inclusive)
      newThreshold = Math.max(50, currentThreshold - 5);
      reason = `Low error rate (${(avgErrorRate * 100).toFixed(2)}%) and high bounds accuracy (${(boundsAccuracy * 100).toFixed(2)}%) - increasing inclusivity`;
    } else if (avgErrorRate < 0.10 && boundsAccuracy > 0.80) {
      // Good performance: slight decrease
      newThreshold = Math.max(55, currentThreshold - 2);
      reason = `Good performance - slight decrease`;
    } else {
      reason = 'No adjustment needed - performance within acceptable range';
    }

    // Apply change if threshold changed
    if (newThreshold !== currentThreshold) {
      await updateConfig(
        'prediction.similarity_threshold',
        newThreshold.toString(),
        currentConfig[0].version,
        reason,
        {
          avgErrorRate,
          boundsAccuracy,
          totalPredictions,
          oldThreshold: currentThreshold,
          newThreshold
        }
      );

      console.log(`🔧 Similarity threshold adjusted: ${currentThreshold} → ${newThreshold}`);
      console.log(`   Reason: ${reason}`);
    } else {
      console.log(`✓ Similarity threshold unchanged (${currentThreshold}): ${reason}`);
    }
  } catch (error) {
    console.error('Error adjusting similarity threshold:', error);
  }
}

/**
 * Task 16.1.3: Tune confidence parameters
 */
async function tuneConfidenceParameters(
  avgConfidenceScore: number,
  boundsAccuracy: number
): Promise<void> {
  try {
    // Get current confidence base
    const currentConfig = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, 'prediction.confidence_base'))
      .limit(1);

    if (currentConfig.length === 0) {
      console.log('⚠️  Confidence base config not found');
      return;
    }

    const currentBase = parseFloat(currentConfig[0].configValue as any);
    let newBase = currentBase;
    let reason = '';

    // Adjust confidence base based on calibration
    // If bounds accuracy is high, confidence is well-calibrated
    // If bounds accuracy is low, confidence is overestimated
    const calibrationError = Math.abs(avgConfidenceScore - boundsAccuracy);

    if (calibrationError > 0.15) {
      // Poor calibration: adjust confidence base
      if (avgConfidenceScore > boundsAccuracy) {
        // Overconfident: decrease base
        newBase = Math.max(0.70, currentBase - 0.05);
        reason = `Overconfident predictions (confidence: ${avgConfidenceScore.toFixed(2)}, bounds accuracy: ${boundsAccuracy.toFixed(2)}) - decreasing base`;
      } else {
        // Underconfident: increase base
        newBase = Math.min(0.90, currentBase + 0.05);
        reason = `Underconfident predictions - increasing base`;
      }
    } else if (calibrationError > 0.10) {
      // Moderate calibration error: slight adjustment
      if (avgConfidenceScore > boundsAccuracy) {
        newBase = Math.max(0.75, currentBase - 0.02);
        reason = `Slight overconfidence - minor decrease`;
      } else {
        newBase = Math.min(0.88, currentBase + 0.02);
        reason = `Slight underconfidence - minor increase`;
      }
    } else {
      reason = 'Confidence well-calibrated - no adjustment needed';
    }

    // Apply change if base changed
    if (Math.abs(newBase - currentBase) > 0.001) {
      await updateConfig(
        'prediction.confidence_base',
        newBase.toFixed(2),
        currentConfig[0].version,
        reason,
        {
          avgConfidenceScore,
          boundsAccuracy,
          calibrationError,
          oldBase: currentBase,
          newBase
        }
      );

      console.log(`🔧 Confidence base adjusted: ${currentBase.toFixed(2)} → ${newBase.toFixed(2)}`);
      console.log(`   Reason: ${reason}`);
    } else {
      console.log(`✓ Confidence base unchanged (${currentBase.toFixed(2)}): ${reason}`);
    }
  } catch (error) {
    console.error('Error tuning confidence parameters:', error);
  }
}

/**
 * Task 16.1.4: Update config and log to algorithm_config_history
 */
async function updateConfig(
  configKey: string,
  newValue: string,
  currentVersion: string,
  reason: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    // Get old value for history
    const oldConfig = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, configKey))
      .limit(1);

    const oldValue = oldConfig[0]?.configValue || null;

    // Update config
    await db
      .update(algorithmConfig)
      .set({
        configValue: newValue as any,
        version: incrementVersion(currentVersion),
        updatedAt: new Date()
      })
      .where(eq(algorithmConfig.configKey, configKey));

    // Task 16.1.4: Log change to algorithm_config_history
    await db.insert(algorithmConfigHistory).values({
      configKey,
      oldValue: oldValue as any,
      newValue: newValue as any,
      changedBy: 'system_auto_tune',
      changeReason: reason,
      metadata: metadata as any,
      createdAt: new Date()
    });

    console.log(`📝 Config change logged: ${configKey} = ${newValue}`);
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

/**
 * Helper: Increment version string
 */
function incrementVersion(version: string): string {
  const match = version.match(/v(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    return `v${major}.${minor + 1}`;
  }
  return 'v1.1';
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
  status: 'success' | 'error' | 'skipped',
  duration: number,
  error?: any
): Promise<void> {
  try {
    console.log('📝 Job execution log:', { 
      jobName, 
      status, 
      duration, 
      error: error ? String(error) : null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error logging job execution:', err);
  }
}

/**
 * Manual run for testing
 */
export async function runAlgorithmTuningNow() {
  console.log('🔄 Running algorithm tuning manually...');
  
  try {
    await tuneAlgorithmParameters();
    console.log('✅ Algorithm tuning completed');
    return { success: true };
  } catch (error) {
    console.error('❌ Algorithm tuning failed:', error);
    return { success: false, error };
  }
}
