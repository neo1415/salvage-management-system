/**
 * Integration Tests for Job Manager
 * Phase 9: Job Manager Integration
 * 
 * Test coverage:
 * - startAllIntelligenceJobs()
 * - stopAllIntelligenceJobs()
 * - getJobStatus()
 * - Manual job execution functions
 * - Job coordination and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all job modules
vi.mock('@/features/intelligence/jobs/materialized-view-refresh.job', () => ({
  startMaterializedViewRefreshJobs: vi.fn(),
  stopMaterializedViewRefreshJobs: vi.fn(),
  refreshMaterializedViewsNow: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/features/intelligence/jobs/analytics-aggregation.job', () => ({
  startAnalyticsAggregationJobs: vi.fn(),
  stopAnalyticsAggregationJobs: vi.fn(),
  runAnalyticsAggregationNow: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/features/intelligence/jobs/accuracy-tracking.job', () => ({
  startAccuracyTrackingJobs: vi.fn(),
  stopAccuracyTrackingJobs: vi.fn(),
  runAccuracyTrackingNow: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/features/intelligence/jobs/data-maintenance.job', () => ({
  startDataMaintenanceJobs: vi.fn(),
  stopDataMaintenanceJobs: vi.fn(),
  runDataMaintenanceNow: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/features/intelligence/jobs/schema-evolution.job', () => ({
  startSchemaEvolutionJobs: vi.fn(),
  stopSchemaEvolutionJobs: vi.fn(),
  runSchemaEvolutionNow: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Job Manager Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startAllIntelligenceJobs', () => {
    it('should start all intelligence background jobs', async () => {
      const { startAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      const {
        startMaterializedViewRefreshJobs,
      } = await import('@/features/intelligence/jobs/materialized-view-refresh.job');

      const {
        startAnalyticsAggregationJobs,
      } = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const {
        startAccuracyTrackingJobs,
      } = await import('@/features/intelligence/jobs/accuracy-tracking.job');

      const {
        startDataMaintenanceJobs,
      } = await import('@/features/intelligence/jobs/data-maintenance.job');

      const {
        startSchemaEvolutionJobs,
      } = await import('@/features/intelligence/jobs/schema-evolution.job');

      expect(() => startAllIntelligenceJobs()).not.toThrow();

      expect(startMaterializedViewRefreshJobs).toHaveBeenCalled();
      expect(startAnalyticsAggregationJobs).toHaveBeenCalled();
      expect(startAccuracyTrackingJobs).toHaveBeenCalled();
      expect(startDataMaintenanceJobs).toHaveBeenCalled();
      expect(startSchemaEvolutionJobs).toHaveBeenCalled();
    });

    it('should log success message', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const { startAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      startAllIntelligenceJobs();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All intelligence background jobs started successfully')
      );
    });

    it('should handle errors during startup', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const {
        startMaterializedViewRefreshJobs,
      } = await import('@/features/intelligence/jobs/materialized-view-refresh.job');

      vi.mocked(startMaterializedViewRefreshJobs).mockImplementation(() => {
        throw new Error('Startup failed');
      });

      const { startAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(() => startAllIntelligenceJobs()).toThrow('Startup failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start intelligence background jobs'),
        expect.anything()
      );
    });
  });

  describe('stopAllIntelligenceJobs', () => {
    it('should stop all intelligence background jobs', async () => {
      const { stopAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      const {
        stopMaterializedViewRefreshJobs,
      } = await import('@/features/intelligence/jobs/materialized-view-refresh.job');

      const {
        stopAnalyticsAggregationJobs,
      } = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const {
        stopAccuracyTrackingJobs,
      } = await import('@/features/intelligence/jobs/accuracy-tracking.job');

      const {
        stopDataMaintenanceJobs,
      } = await import('@/features/intelligence/jobs/data-maintenance.job');

      const {
        stopSchemaEvolutionJobs,
      } = await import('@/features/intelligence/jobs/schema-evolution.job');

      expect(() => stopAllIntelligenceJobs()).not.toThrow();

      expect(stopMaterializedViewRefreshJobs).toHaveBeenCalled();
      expect(stopAnalyticsAggregationJobs).toHaveBeenCalled();
      expect(stopAccuracyTrackingJobs).toHaveBeenCalled();
      expect(stopDataMaintenanceJobs).toHaveBeenCalled();
      expect(stopSchemaEvolutionJobs).toHaveBeenCalled();
    });

    it('should log success message', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const { stopAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      stopAllIntelligenceJobs();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All intelligence background jobs stopped successfully')
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status summary', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status).toHaveProperty('status', 'running');
      expect(status).toHaveProperty('jobs');
      expect(status.jobs).toHaveProperty('materializedViewRefresh');
      expect(status.jobs).toHaveProperty('analyticsAggregation');
      expect(status.jobs).toHaveProperty('accuracyTracking');
      expect(status.jobs).toHaveProperty('dataMaintenance');
      expect(status.jobs).toHaveProperty('schemaEvolution');
    });

    it('should include materialized view refresh schedules', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status.jobs.materializedViewRefresh).toEqual({
        vendorBiddingPatterns: 'every 5 minutes',
        marketConditions: 'every 5 minutes',
      });
    });

    it('should include analytics aggregation schedules', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status.jobs.analyticsAggregation).toEqual({
        hourly: 'every hour at :00',
        daily: 'daily at 1:00 AM',
        weekly: 'Mondays at 2:00 AM',
        monthly: '1st of month at 3:00 AM',
      });
    });

    it('should include accuracy tracking schedules', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status.jobs.accuracyTracking).toEqual({
        predictionAccuracy: 'hourly at :15',
        recommendationEffectiveness: 'hourly at :30',
        algorithmTuning: 'daily at 4:00 AM',
      });
    });

    it('should include data maintenance schedules', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status.jobs.dataMaintenance).toEqual({
        interactionsCleanup: 'Sundays at 5:00 AM',
        logRotation: 'Sundays at 6:00 AM',
        vendorSegmentUpdate: 'Mondays at 3:00 AM',
        assetPerformanceUpdate: 'daily at 2:00 AM',
        featureVectorUpdate: 'Mondays at 4:00 AM',
      });
    });

    it('should include schema evolution schedules', async () => {
      const { getJobStatus } = await import(
        '@/features/intelligence/jobs/index'
      );

      const status = getJobStatus();

      expect(status.jobs.schemaEvolution).toEqual({
        assetTypeDetection: 'daily at 5:00 AM',
        attributeDetection: 'daily at 5:30 AM',
      });
    });
  });

  describe('Manual Job Execution', () => {
    it('should export refreshMaterializedViewsNow', async () => {
      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(refreshMaterializedViewsNow).toBeDefined();
      expect(typeof refreshMaterializedViewsNow).toBe('function');
    });

    it('should export runAnalyticsAggregationNow', async () => {
      const { runAnalyticsAggregationNow } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(runAnalyticsAggregationNow).toBeDefined();
      expect(typeof runAnalyticsAggregationNow).toBe('function');
    });

    it('should export runAccuracyTrackingNow', async () => {
      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(runAccuracyTrackingNow).toBeDefined();
      expect(typeof runAccuracyTrackingNow).toBe('function');
    });

    it('should export runDataMaintenanceNow', async () => {
      const { runDataMaintenanceNow } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(runDataMaintenanceNow).toBeDefined();
      expect(typeof runDataMaintenanceNow).toBe('function');
    });

    it('should export runSchemaEvolutionNow', async () => {
      const { runSchemaEvolutionNow } = await import(
        '@/features/intelligence/jobs/index'
      );

      expect(runSchemaEvolutionNow).toBeDefined();
      expect(typeof runSchemaEvolutionNow).toBe('function');
    });

    it('should execute manual jobs successfully', async () => {
      const {
        refreshMaterializedViewsNow,
        runAnalyticsAggregationNow,
        runAccuracyTrackingNow,
        runDataMaintenanceNow,
        runSchemaEvolutionNow,
      } = await import('@/features/intelligence/jobs/index');

      const results = await Promise.all([
        refreshMaterializedViewsNow(),
        runAnalyticsAggregationNow('hourly'),
        runAccuracyTrackingNow('prediction'),
        runDataMaintenanceNow('interactions'),
        runSchemaEvolutionNow('asset-types'),
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Job Coordination', () => {
    it('should start jobs in correct order', async () => {
      const callOrder: string[] = [];

      const {
        startMaterializedViewRefreshJobs,
      } = await import('@/features/intelligence/jobs/materialized-view-refresh.job');

      const {
        startAnalyticsAggregationJobs,
      } = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const {
        startAccuracyTrackingJobs,
      } = await import('@/features/intelligence/jobs/accuracy-tracking.job');

      const {
        startDataMaintenanceJobs,
      } = await import('@/features/intelligence/jobs/data-maintenance.job');

      const {
        startSchemaEvolutionJobs,
      } = await import('@/features/intelligence/jobs/schema-evolution.job');

      vi.mocked(startMaterializedViewRefreshJobs).mockImplementation(() => {
        callOrder.push('materialized-view');
      });
      vi.mocked(startAnalyticsAggregationJobs).mockImplementation(() => {
        callOrder.push('analytics');
      });
      vi.mocked(startAccuracyTrackingJobs).mockImplementation(() => {
        callOrder.push('accuracy');
      });
      vi.mocked(startDataMaintenanceJobs).mockImplementation(() => {
        callOrder.push('maintenance');
      });
      vi.mocked(startSchemaEvolutionJobs).mockImplementation(() => {
        callOrder.push('schema');
      });

      const { startAllIntelligenceJobs } = await import(
        '@/features/intelligence/jobs/index'
      );

      startAllIntelligenceJobs();

      expect(callOrder).toEqual([
        'materialized-view',
        'analytics',
        'accuracy',
        'maintenance',
        'schema',
      ]);
    });
  });
});
