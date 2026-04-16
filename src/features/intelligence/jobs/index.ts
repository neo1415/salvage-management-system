/**
 * Intelligence Background Jobs Manager
 * Central manager for all intelligence background jobs
 * 
 * Phase 9: Background Jobs and Automation
 */

import {
  startMaterializedViewRefreshJobs,
  stopMaterializedViewRefreshJobs,
  refreshMaterializedViewsNow,
} from './materialized-view-refresh.job';

import {
  startAnalyticsAggregationJobs,
  stopAnalyticsAggregationJobs,
  runAnalyticsAggregationNow,
} from './analytics-aggregation.job';

import {
  startAccuracyTrackingJobs,
  stopAccuracyTrackingJobs,
  runAccuracyTrackingNow,
} from './accuracy-tracking.job';

import {
  startDataMaintenanceJobs,
  stopDataMaintenanceJobs,
  runDataMaintenanceNow,
} from './data-maintenance.job';

import {
  startSchemaEvolutionJobs,
  stopSchemaEvolutionJobs,
  runSchemaEvolutionNow,
} from './schema-evolution.job';

import {
  startAlgorithmTuningJob,
  stopAlgorithmTuningJob,
  runAlgorithmTuningNow,
} from './algorithm-tuning.job';

/**
 * Start all intelligence background jobs
 */
export function startAllIntelligenceJobs() {
  console.log('🚀 Starting all intelligence background jobs...');
  
  try {
    // Phase 9.1: Materialized View Refresh (every 5 min)
    startMaterializedViewRefreshJobs();
    
    // Phase 9.2: Analytics Aggregation (hourly, daily, weekly, monthly)
    startAnalyticsAggregationJobs();
    
    // Phase 9.3: Accuracy Tracking (hourly, daily)
    startAccuracyTrackingJobs();
    
    // Phase 9.4: Data Maintenance (daily, weekly)
    startDataMaintenanceJobs();
    
    // Phase 9.5: Schema Evolution (daily)
    startSchemaEvolutionJobs();
    
    // Phase 16.1: Algorithm Tuning (daily at 2 AM)
    startAlgorithmTuningJob();
    
    console.log('✅ All intelligence background jobs started successfully');
  } catch (error) {
    console.error('❌ Failed to start intelligence background jobs:', error);
    throw error;
  }
}

/**
 * Stop all intelligence background jobs
 */
export function stopAllIntelligenceJobs() {
  console.log('🛑 Stopping all intelligence background jobs...');
  
  try {
    stopMaterializedViewRefreshJobs();
    stopAnalyticsAggregationJobs();
    stopAccuracyTrackingJobs();
    stopDataMaintenanceJobs();
    stopSchemaEvolutionJobs();
    stopAlgorithmTuningJob();
    
    console.log('✅ All intelligence background jobs stopped successfully');
  } catch (error) {
    console.error('❌ Failed to stop intelligence background jobs:', error);
    throw error;
  }
}

/**
 * Export individual job managers for manual testing
 */
export {
  // Materialized View Refresh
  refreshMaterializedViewsNow,
  
  // Analytics Aggregation
  runAnalyticsAggregationNow,
  
  // Accuracy Tracking
  runAccuracyTrackingNow,
  
  // Data Maintenance
  runDataMaintenanceNow,
  
  // Schema Evolution
  runSchemaEvolutionNow,
  
  // Algorithm Tuning
  runAlgorithmTuningNow,
};

// Export job monitoring functions
export {
  logJobExecution,
  logJobStart,
  getJobPerformanceMetrics,
  getRecentJobLogs,
  getJobLogsFromCache,
  getJobFailureHistory,
  getJobHealthStatus,
  clearJobMetrics,
} from './job-monitoring';

/**
 * Get job status summary
 */
export function getJobStatus() {
  return {
    status: 'running',
    jobs: {
      materializedViewRefresh: {
        vendorBiddingPatterns: 'every 5 minutes',
        marketConditions: 'every 5 minutes',
      },
      analyticsAggregation: {
        hourly: 'every hour at :00',
        daily: 'daily at 1:00 AM',
        weekly: 'Mondays at 2:00 AM',
        monthly: '1st of month at 3:00 AM',
      },
      accuracyTracking: {
        predictionAccuracy: 'hourly at :15',
        recommendationEffectiveness: 'hourly at :30',
        algorithmTuning: 'daily at 4:00 AM',
      },
      dataMaintenance: {
        interactionsCleanup: 'Sundays at 5:00 AM',
        logRotation: 'Sundays at 6:00 AM',
        vendorSegmentUpdate: 'Mondays at 3:00 AM',
        assetPerformanceUpdate: 'daily at 2:00 AM',
        featureVectorUpdate: 'Mondays at 4:00 AM',
      },
      schemaEvolution: {
        assetTypeDetection: 'daily at 5:00 AM',
        attributeDetection: 'daily at 5:30 AM',
      },
      algorithmTuning: {
        parameterTuning: 'daily at 2:00 AM',
      },
    },
  };
}
