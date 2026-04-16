/**
 * Accuracy Tracking Jobs
 * Tasks 9.3.1, 9.3.2, 9.3.3, 9.3.4
 * 
 * Tracks prediction accuracy, recommendation effectiveness, and tunes algorithm parameters
 */

import cron from 'node-cron';
import { db } from '@/lib/db';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { predictions, recommendations, algorithmConfig } from '@/lib/db/schema/intelligence';
import { predictionLogs, recommendationLogs } from '@/lib/db/schema/ml-training';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { getCached, setCached } from '@/lib/cache/redis';

const LOCK_TTL = 3600; // 1 hour
const LOCK_KEY_PREDICTION_ACCURACY = 'job:lock:prediction_accuracy';
const LOCK_KEY_RECOMMENDATION_EFFECTIVENESS = 'job:lock:recommendation_effectiveness';
const LOCK_KEY_ALGORITHM_TUNING = 'job:lock:algorithm_tuning';

let predictionAccuracyJob: cron.ScheduledTask | null = null;
let recommendationEffectivenessJob: cron.ScheduledTask | null = null;
let algorithmTuningJob: cron.ScheduledTask | null = null;

/**
 * Task 9.3.1: Create prediction accuracy calculation job (hourly)
 */
export function startPredictionAccuracyJob() {
  // Run at 15 minutes past every hour
  predictionAccuracyJob = cron.schedule('15 * * * *', async () => {
    await calculatePredictionAccuracy();
  });

  console.log('✅ Prediction accuracy job started (runs hourly at :15)');
}

/**
 * Task 9.3.2: Create recommendation effectiveness tracking job (hourly)
 */
export function startRecommendationEffectivenessJob() {
  // Run at 30 minutes past every hour
  recommendationEffectivenessJob = cron.schedule('30 * * * *', async () => {
    await trackRecommendationEffectiveness();
  });

  console.log('✅ Recommendation effectiveness job started (runs hourly at :30)');
}

/**
 * Task 9.3.3: Create algorithm parameter tuning job (daily)
 */
export function startAlgorithmTuningJob() {
  // Run at 4:00 AM every day
  algorithmTuningJob = cron.schedule('0 4 * * *', async () => {
    await tuneAlgorithmParameters();
  });

  console.log('✅ Algorithm tuning job started (runs daily at 4:00 AM)');
}

/**
 * Start all accuracy tracking jobs
 */
export function startAccuracyTrackingJobs() {
  startPredictionAccuracyJob();
  startRecommendationEffectivenessJob();
  startAlgorithmTuningJob();
  console.log('✅ All accuracy tracking jobs started');
}

/**
 * Stop all accuracy tracking jobs
 */
export function stopAccuracyTrackingJobs() {
  if (predictionAccuracyJob) {
    predictionAccuracyJob.stop();
    predictionAccuracyJob = null;
  }
  if (recommendationEffectivenessJob) {
    recommendationEffectivenessJob.stop();
    recommendationEffectivenessJob = null;
  }
  if (algorithmTuningJob) {
    algorithmTuningJob.stop();
    algorithmTuningJob = null;
  }
  console.log('✅ All accuracy tracking jobs stopped');
}

/**
 * Task 9.3.1: Calculate prediction accuracy
 */
async function calculatePredictionAccuracy() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_PREDICTION_ACCURACY);
    if (!lockAcquired) {
      console.log('⏭️  Prediction accuracy calculation skipped (already running)');
      return;
    }

    console.log('🔄 Calculating prediction accuracy...');

    // Get predictions for closed auctions in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result: any = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_predictions,
        AVG(ABS(p.predicted_price - a.current_bid) / NULLIF(a.current_bid, 0)) AS avg_error_rate,
        COUNT(*) FILTER (
          WHERE a.current_bid BETWEEN p.lower_bound AND p.upper_bound
        ) AS within_bounds_count,
        AVG(p.confidence_score) AS avg_confidence_score
      FROM ${predictions} p
      JOIN ${auctions} a ON p.auction_id = a.id
      WHERE a.status = 'closed'
        AND a.end_time > ${oneDayAgo}
        AND a.current_bid IS NOT NULL
    `);

    const metrics = result[0];
    const totalPredictions = parseInt(metrics?.total_predictions || '0');
    const avgErrorRate = parseFloat(metrics?.avg_error_rate || '0');
    const withinBoundsCount = parseInt(metrics?.within_bounds_count || '0');
    const avgConfidenceScore = parseFloat(metrics?.avg_confidence_score || '0');

    const accuracy = totalPredictions > 0 
      ? (1 - avgErrorRate) * 100 
      : 0;
    const boundsAccuracy = totalPredictions > 0 
      ? (withinBoundsCount / totalPredictions) * 100 
      : 0;

    console.log(`📊 Prediction Accuracy Metrics:
      - Total Predictions: ${totalPredictions}
      - Accuracy: ${accuracy.toFixed(2)}%
      - Bounds Accuracy: ${boundsAccuracy.toFixed(2)}%
      - Avg Confidence: ${avgConfidenceScore.toFixed(4)}
      - Avg Error Rate: ${(avgErrorRate * 100).toFixed(2)}%
    `);

    // Task 9.3.4: Trigger alert if accuracy drops below threshold
    if (accuracy < 85 && totalPredictions >= 10) {
      await sendAccuracyAlert('prediction', accuracy, 85);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Prediction accuracy calculated (${duration}ms)`);

    await logJobExecution('prediction_accuracy', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Prediction accuracy calculation failed:', error);
    await logJobExecution('prediction_accuracy', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_PREDICTION_ACCURACY);
  }
}

/**
 * Task 9.3.2: Track recommendation effectiveness
 */
async function trackRecommendationEffectiveness() {
  const startTime = Date.now();
  
  try {
    const lockAcquired = await acquireLock(LOCK_KEY_RECOMMENDATION_EFFECTIVENESS);
    if (!lockAcquired) {
      console.log('⏭️  Recommendation effectiveness tracking skipped (already running)');
      return;
    }

    console.log('🔄 Tracking recommendation effectiveness...');

    // Get recommendations from the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result: any = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_recommendations,
        COUNT(*) FILTER (WHERE rl.clicked = true) AS clicked_count,
        COUNT(*) FILTER (WHERE rl.bid_placed = true) AS bid_placed_count,
        AVG(r.match_score) AS avg_match_score
      FROM ${recommendations} r
      LEFT JOIN ${recommendationLogs} rl ON r.id = rl.recommendation_id
      WHERE r.created_at > ${oneDayAgo}
    `);

    const metrics = result[0];
    const totalRecommendations = parseInt(metrics?.total_recommendations || '0');
    const clickedCount = parseInt(metrics?.clicked_count || '0');
    const bidPlacedCount = parseInt(metrics?.bid_placed_count || '0');
    const avgMatchScore = parseFloat(metrics?.avg_match_score || '0');

    const clickThroughRate = totalRecommendations > 0 
      ? (clickedCount / totalRecommendations) * 100 
      : 0;
    const bidConversionRate = totalRecommendations > 0 
      ? (bidPlacedCount / totalRecommendations) * 100 
      : 0;

    console.log(`📊 Recommendation Effectiveness Metrics:
      - Total Recommendations: ${totalRecommendations}
      - Click-Through Rate: ${clickThroughRate.toFixed(2)}%
      - Bid Conversion Rate: ${bidConversionRate.toFixed(2)}%
      - Avg Match Score: ${avgMatchScore.toFixed(2)}
    `);

    // Task 9.3.4: Trigger alert if effectiveness drops below threshold
    if (bidConversionRate < 10 && totalRecommendations >= 50) {
      await sendAccuracyAlert('recommendation', bidConversionRate, 10);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Recommendation effectiveness tracked (${duration}ms)`);

    await logJobExecution('recommendation_effectiveness', 'success', duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Recommendation effectiveness tracking failed:', error);
    await logJobExecution('recommendation_effectiveness', 'error', duration, error);
  } finally {
    await releaseLock(LOCK_KEY_RECOMMENDATION_EFFECTIVENESS);
  }
}

/**
 * Task 9.3.3: Tune algorithm parameters based on accuracy metrics
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

    // Get recent prediction accuracy
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const accuracyResult: any = await db.execute(sql`
      SELECT 
        AVG(ABS(p.predicted_price - a.current_bid) / NULLIF(a.current_bid, 0)) AS avg_error_rate,
        COUNT(*) FILTER (
          WHERE a.current_bid BETWEEN p.lower_bound AND p.upper_bound
        )::float / NULLIF(COUNT(*), 0) AS bounds_accuracy
      FROM ${predictions} p
      JOIN ${auctions} a ON p.auction_id = a.id
      WHERE a.status = 'closed'
        AND a.end_time > ${sevenDaysAgoISO}
        AND a.current_bid IS NOT NULL
    `);

    const avgErrorRate = parseFloat(accuracyResult[0]?.avg_error_rate || '0');
    const boundsAccuracy = parseFloat(accuracyResult[0]?.bounds_accuracy || '0');

    console.log(`📊 7-Day Accuracy Metrics:
      - Avg Error Rate: ${(avgErrorRate * 100).toFixed(2)}%
      - Bounds Accuracy: ${(boundsAccuracy * 100).toFixed(2)}%
    `);

    // Adjust similarity threshold based on accuracy
    const currentConfig = await db
      .select()
      .from(algorithmConfig)
      .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
      .limit(1);

    if (currentConfig.length > 0) {
      const currentThreshold = parseFloat(currentConfig[0].configValue);
      let newThreshold = currentThreshold;

      // If error rate is high, increase similarity threshold (be more selective)
      if (avgErrorRate > 0.15) {
        newThreshold = Math.min(80, currentThreshold + 5);
      }
      // If error rate is low and bounds accuracy is high, decrease threshold (be more inclusive)
      else if (avgErrorRate < 0.10 && boundsAccuracy > 0.85) {
        newThreshold = Math.max(50, currentThreshold - 5);
      }

      if (newThreshold !== currentThreshold) {
        await db
          .update(algorithmConfig)
          .set({ 
            configValue: newThreshold.toString(),
            updatedAt: new Date()
          })
          .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'));

        console.log(`🔧 Adjusted similarity threshold: ${currentThreshold} → ${newThreshold}`);
      }
    }

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
 * Task 9.3.4: Send accuracy alert
 */
async function sendAccuracyAlert(
  type: 'prediction' | 'recommendation',
  currentValue: number,
  threshold: number
): Promise<void> {
  try {
    const alertData = {
      type,
      currentValue,
      threshold,
      timestamp: new Date().toISOString()
    };
    
    console.error(`🚨 ACCURACY ALERT: ${type} accuracy (${currentValue.toFixed(2)}%) below threshold (${threshold}%)`, alertData);
    
    // TODO: Send Socket.IO notification to admins
    // TODO: Send email alert
  } catch (error) {
    console.error('Error sending accuracy alert:', error);
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
export async function runAccuracyTrackingNow(type: 'prediction' | 'recommendation' | 'tuning') {
  console.log(`🔄 Running ${type} accuracy tracking manually...`);
  
  try {
    switch (type) {
      case 'prediction':
        await calculatePredictionAccuracy();
        break;
      case 'recommendation':
        await trackRecommendationEffectiveness();
        break;
      case 'tuning':
        await tuneAlgorithmParameters();
        break;
    }
    
    console.log(`✅ ${type} accuracy tracking completed`);
    return { success: true };
  } catch (error) {
    console.error(`❌ ${type} accuracy tracking failed:`, error);
    return { success: false, error };
  }
}
