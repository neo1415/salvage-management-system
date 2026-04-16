/**
 * Admin Actions for Intelligence System
 * 
 * Tasks: 15.3.1, 15.3.2
 */

import { db } from '@/lib/db';
import { mlTrainingDatasets, algorithmConfig, algorithmConfigHistory } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { MLDatasetService } from '@/features/intelligence/services';
import { auth } from '@/lib/auth';

/**
 * Task 15.3.1: Export ML Dataset
 * 
 * Exports a specific ML training dataset with all splits
 */
export async function exportMLDataset(datasetId: string) {
  try {
    // Verify admin authentication
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Get dataset metadata
    const dataset = await db
      .select()
      .from(mlTrainingDatasets)
      .where(eq(mlTrainingDatasets.id, datasetId))
      .limit(1);

    if (!dataset || dataset.length === 0) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    const datasetInfo = dataset[0];

    // Initialize ML dataset service
    const mlService = new MLDatasetService();

    // Export dataset based on type
    let exportData;
    switch (datasetInfo.datasetType) {
      case 'price_prediction':
        exportData = await mlService.exportPricePredictionDataset(
          datasetInfo.format as 'csv' | 'json' | 'parquet',
          {
            trainSplit: datasetInfo.trainSplit / 100,
            validationSplit: datasetInfo.validationSplit / 100,
            testSplit: datasetInfo.testSplit / 100,
          }
        );
        break;

      case 'recommendation':
        exportData = await mlService.exportRecommendationDataset(
          datasetInfo.format as 'csv' | 'json' | 'parquet',
          {
            trainSplit: datasetInfo.trainSplit / 100,
            validationSplit: datasetInfo.validationSplit / 100,
            testSplit: datasetInfo.testSplit / 100,
          }
        );
        break;

      case 'fraud_detection':
        exportData = await mlService.exportFraudDetectionDataset(
          datasetInfo.format as 'csv' | 'json' | 'parquet',
          {
            trainSplit: datasetInfo.trainSplit / 100,
            validationSplit: datasetInfo.validationSplit / 100,
            testSplit: datasetInfo.testSplit / 100,
          }
        );
        break;

      default:
        throw new Error(`Unknown dataset type: ${datasetInfo.datasetType}`);
    }

    return {
      success: true,
      datasetId,
      datasetType: datasetInfo.datasetType,
      format: datasetInfo.format,
      recordCount: datasetInfo.recordCount,
      size: datasetInfo.fileSize || 0, // Use fileSize field from schema
      exportData,
    };
  } catch (error) {
    console.error('Error exporting ML dataset:', error);
    throw error;
  }
}

/**
 * Task 15.3.2: Tune Algorithm Parameters
 * 
 * Adjusts algorithm parameters based on recent accuracy metrics
 */
export async function tuneAlgorithm(params?: {
  targetAccuracy?: number;
  adjustmentFactor?: number;
}) {
  try {
    // Verify admin authentication
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const targetAccuracy = params?.targetAccuracy || 0.88; // 88% default target
    const adjustmentFactor = params?.adjustmentFactor || 0.05; // 5% adjustment

    // Get current algorithm configuration (key-value pairs)
    const configKeys = [
      'prediction.similarity_threshold',
      'prediction.time_decay_factor',
      'prediction.confidence_base'
    ];

    const currentConfigs = await db
      .select()
      .from(algorithmConfig)
      .where(sql`${algorithmConfig.configKey} IN ${configKeys}`);

    if (!currentConfigs || currentConfigs.length === 0) {
      throw new Error('No algorithm configuration found');
    }

    // Parse config values
    const configMap = new Map(
      currentConfigs.map(c => [c.configKey, parseFloat(c.configValue as string)])
    );

    const similarityThreshold = configMap.get('prediction.similarity_threshold') || 70;
    const timeDecayFactor = configMap.get('prediction.time_decay_factor') || 0.85;
    const confidenceBase = configMap.get('prediction.confidence_base') || 0.7;

    // Calculate recent accuracy from predictionLogs (last 7 days)
    const recentAccuracy = await db.execute(sql`
      SELECT AVG(CASE WHEN accuracy IS NOT NULL THEN accuracy ELSE 0 END) as avg_accuracy
      FROM prediction_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    const avgAccuracy = Number((recentAccuracy as any).rows?.[0]?.avg_accuracy || 0);

    // Determine if tuning is needed
    if (avgAccuracy >= targetAccuracy) {
      return {
        success: true,
        message: 'Algorithm performing within target accuracy',
        currentAccuracy: avgAccuracy,
        targetAccuracy,
        tuningApplied: false,
      };
    }

    // Calculate adjustments
    const accuracyGap = targetAccuracy - avgAccuracy;
    const adjustmentNeeded = accuracyGap > 0.05; // Only adjust if gap > 5%

    if (!adjustmentNeeded) {
      return {
        success: true,
        message: 'Accuracy gap too small for tuning',
        currentAccuracy: avgAccuracy,
        targetAccuracy,
        tuningApplied: false,
      };
    }

    // Apply tuning adjustments
    const newSimilarityThreshold = Math.max(50, similarityThreshold - adjustmentFactor * 100);
    const newTimeDecayFactor = Math.min(0.95, timeDecayFactor + adjustmentFactor);
    const newConfidenceBase = Math.max(0.5, confidenceBase - adjustmentFactor);

    // Update configurations
    await Promise.all([
      db
        .update(algorithmConfig)
        .set({
          configValue: newSimilarityThreshold.toString(),
          updatedAt: new Date(),
        })
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold')),
      
      db
        .update(algorithmConfig)
        .set({
          configValue: newTimeDecayFactor.toString(),
          updatedAt: new Date(),
        })
        .where(eq(algorithmConfig.configKey, 'prediction.time_decay_factor')),
      
      db
        .update(algorithmConfig)
        .set({
          configValue: newConfidenceBase.toString(),
          updatedAt: new Date(),
        })
        .where(eq(algorithmConfig.configKey, 'prediction.confidence_base')),
    ]);

    // Log configuration changes
    const changeReason = `Automatic tuning: accuracy ${(avgAccuracy * 100).toFixed(2)}% < target ${targetAccuracy * 100}%`;
    
    await Promise.all([
      db.insert(algorithmConfigHistory).values({
        configId: currentConfigs.find(c => c.configKey === 'prediction.similarity_threshold')?.id || '',
        configKey: 'prediction.similarity_threshold',
        oldValue: similarityThreshold as any,
        newValue: newSimilarityThreshold as any,
        changeReason,
      }),
      db.insert(algorithmConfigHistory).values({
        configId: currentConfigs.find(c => c.configKey === 'prediction.time_decay_factor')?.id || '',
        configKey: 'prediction.time_decay_factor',
        oldValue: timeDecayFactor as any,
        newValue: newTimeDecayFactor as any,
        changeReason,
      }),
      db.insert(algorithmConfigHistory).values({
        configId: currentConfigs.find(c => c.configKey === 'prediction.confidence_base')?.id || '',
        configKey: 'prediction.confidence_base',
        oldValue: confidenceBase as any,
        newValue: newConfidenceBase as any,
        changeReason,
      }),
    ]);

    return {
      success: true,
      message: 'Algorithm parameters tuned successfully',
      currentAccuracy: avgAccuracy,
      targetAccuracy,
      tuningApplied: true,
      adjustments: {
        similarityThreshold: {
          old: similarityThreshold,
          new: newSimilarityThreshold,
        },
        timeDecayFactor: {
          old: timeDecayFactor,
          new: newTimeDecayFactor,
        },
        confidenceBase: {
          old: confidenceBase,
          new: newConfidenceBase,
        },
      },
    };
  } catch (error) {
    console.error('Error tuning algorithm:', error);
    throw error;
  }
}

/**
 * Get tuning history
 */
export async function getTuningHistory(limit: number = 20) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const history = await db
      .select()
      .from(algorithmConfigHistory)
      .orderBy(desc(algorithmConfigHistory.changedAt))
      .limit(limit);

    return {
      success: true,
      history,
    };
  } catch (error) {
    console.error('Error fetching tuning history:', error);
    throw error;
  }
}
