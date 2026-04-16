/**
 * Daily Analytics Aggregation Job
 * Task 5.1.3: Implement daily aggregation background job
 * 
 * Runs daily at 1 AM to aggregate analytics data
 * Uses setInterval for scheduling (production should use cron or task scheduler)
 */

import { AnalyticsAggregationService } from '../services/analytics-aggregation.service';

const aggregationService = new AnalyticsAggregationService();
let scheduledJob: NodeJS.Timeout | null = null;

/**
 * Schedule daily analytics aggregation job
 * Runs at 1:00 AM every day
 */
export function scheduleDailyAnalyticsAggregation() {
  // Calculate milliseconds until next 1:00 AM
  const now = new Date();
  const next1AM = new Date();
  next1AM.setHours(1, 0, 0, 0);
  
  // If it's already past 1 AM today, schedule for tomorrow
  if (now.getHours() >= 1) {
    next1AM.setDate(next1AM.getDate() + 1);
  }
  
  const msUntilNext1AM = next1AM.getTime() - now.getTime();
  
  // Schedule first run
  setTimeout(() => {
    runDailyAggregation();
    
    // Then run every 24 hours
    scheduledJob = setInterval(() => {
      runDailyAggregation();
    }, 24 * 60 * 60 * 1000);
  }, msUntilNext1AM);

  console.log(`✅ Daily analytics aggregation job scheduled (next run: ${next1AM.toISOString()})`);
}

/**
 * Stop the scheduled job
 */
export function stopDailyAnalyticsAggregation() {
  if (scheduledJob) {
    clearInterval(scheduledJob);
    scheduledJob = null;
    console.log('✅ Daily analytics aggregation job stopped');
  }
}

/**
 * Internal function to run aggregation
 */
async function runDailyAggregation() {
  console.log('🔄 Starting daily analytics aggregation job...');
  
  try {
    await aggregationService.runDailyRollup();
    console.log('✅ Daily analytics aggregation completed successfully');
  } catch (error) {
    console.error('❌ Daily analytics aggregation failed:', error);
    // TODO: Send alert to admins
  }
}

/**
 * Run daily aggregation manually (for testing)
 */
export async function runDailyAggregationNow() {
  console.log('🔄 Running daily analytics aggregation manually...');
  
  try {
    await aggregationService.runDailyRollup();
    console.log('✅ Daily analytics aggregation completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Daily analytics aggregation failed:', error);
    return { success: false, error };
  }
}
