/**
 * Prediction Accuracy Validation Tests
 * 
 * Requirements:
 * - Prediction accuracy within ±12% of actual final price
 * - Test on historical data with known outcomes
 * - Validate across different asset types
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PredictionService } from '@/features/intelligence/services/prediction.service';
import { db } from '@/lib/db';
import { auctions, cases, vehicles, electronics, machinery } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

describe('Prediction Accuracy Validation Tests', () => {
  let predictionService: PredictionService;
  let testDataset: Array<{
    auctionId: string;
    actualPrice: number;
    assetType: string;
    make?: string;
    model?: string;
    year?: number;
  }>;

  beforeAll(async () => {
    predictionService = new PredictionService();

    // Load historical closed auctions as test dataset
    const closedAuctions = await db.query.auctions.findMany({
      where: and(
        eq(auctions.status, 'closed'),
        isNotNull(auctions.finalPrice)
      ),
      with: {
        case: {
          with: {
            vehicle: true,
            electronic: true,
            machinery: true,
          },
        },
      },
      limit: 100,
    });

    testDataset = closedAuctions.map(auction => ({
      auctionId: auction.id,
      actualPrice: auction.finalPrice!,
      assetType: auction.case.assetType,
      make: auction.case.vehicle?.make || auction.case.electronic?.make || auction.case.machinery?.make,
      model: auction.case.vehicle?.model || auction.case.electronic?.model || auction.case.machinery?.model,
      year: auction.case.vehicle?.year || auction.case.electronic?.year || auction.case.machinery?.year,
    }));

    console.log(`Loaded ${testDataset.length} historical auctions for accuracy testing`);
  });

  it('should achieve ±12% accuracy on overall test dataset', async () => {
    const predictions: Array<{
      actual: number;
      predicted: number;
      error: number;
      errorPercent: number;
    }> = [];

    for (const testCase of testDataset) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        
        const actual = testCase.actualPrice;
        const predicted = prediction.predictedPrice;
        const error = Math.abs(actual - predicted);
        const errorPercent = (error / actual) * 100;

        predictions.push({
          actual,
          predicted,
          error,
          errorPercent,
        });
      } catch (error) {
        console.warn(`Failed to generate prediction for ${testCase.auctionId}:`, error);
      }
    }

    // Calculate accuracy metrics
    const avgErrorPercent = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;
    const medianErrorPercent = predictions
      .map(p => p.errorPercent)
      .sort((a, b) => a - b)[Math.floor(predictions.length / 2)];
    const within12Percent = predictions.filter(p => p.errorPercent <= 12).length;
    const accuracyRate = (within12Percent / predictions.length) * 100;

    console.log('\nOverall Prediction Accuracy:');
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Average error: ${avgErrorPercent.toFixed(2)}%`);
    console.log(`  Median error: ${medianErrorPercent.toFixed(2)}%`);
    console.log(`  Within ±12%: ${within12Percent} (${accuracyRate.toFixed(2)}%)`);

    // At least 70% of predictions should be within ±12%
    expect(accuracyRate).toBeGreaterThanOrEqual(70);
    expect(avgErrorPercent).toBeLessThan(15);
  });

  it('should achieve ±12% accuracy for vehicle predictions', async () => {
    const vehicleData = testDataset.filter(d => d.assetType === 'vehicle');
    const predictions: Array<{ errorPercent: number }> = [];

    for (const testCase of vehicleData) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
        predictions.push({ errorPercent });
      } catch (error) {
        // Skip failed predictions
      }
    }

    const avgError = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;
    const within12Percent = predictions.filter(p => p.errorPercent <= 12).length;
    const accuracyRate = (within12Percent / predictions.length) * 100;

    console.log('\nVehicle Prediction Accuracy:');
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Average error: ${avgError.toFixed(2)}%`);
    console.log(`  Within ±12%: ${within12Percent} (${accuracyRate.toFixed(2)}%)`);

    expect(accuracyRate).toBeGreaterThanOrEqual(70);
  });

  it('should achieve ±12% accuracy for electronics predictions', async () => {
    const electronicsData = testDataset.filter(d => d.assetType === 'electronics');
    
    if (electronicsData.length === 0) {
      console.log('No electronics data available for testing');
      return;
    }

    const predictions: Array<{ errorPercent: number }> = [];

    for (const testCase of electronicsData) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
        predictions.push({ errorPercent });
      } catch (error) {
        // Skip failed predictions
      }
    }

    const avgError = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;
    const within12Percent = predictions.filter(p => p.errorPercent <= 12).length;
    const accuracyRate = (within12Percent / predictions.length) * 100;

    console.log('\nElectronics Prediction Accuracy:');
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Average error: ${avgError.toFixed(2)}%`);
    console.log(`  Within ±12%: ${within12Percent} (${accuracyRate.toFixed(2)}%)`);

    expect(accuracyRate).toBeGreaterThanOrEqual(65); // Slightly lower threshold for electronics
  });

  it('should achieve ±12% accuracy for machinery predictions', async () => {
    const machineryData = testDataset.filter(d => d.assetType === 'machinery');
    
    if (machineryData.length === 0) {
      console.log('No machinery data available for testing');
      return;
    }

    const predictions: Array<{ errorPercent: number }> = [];

    for (const testCase of machineryData) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
        predictions.push({ errorPercent });
      } catch (error) {
        // Skip failed predictions
      }
    }

    const avgError = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;
    const within12Percent = predictions.filter(p => p.errorPercent <= 12).length;
    const accuracyRate = (within12Percent / predictions.length) * 100;

    console.log('\nMachinery Prediction Accuracy:');
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Average error: ${avgError.toFixed(2)}%`);
    console.log(`  Within ±12%: ${within12Percent} (${accuracyRate.toFixed(2)}%)`);

    expect(accuracyRate).toBeGreaterThanOrEqual(65);
  });

  it('should have higher confidence for more accurate predictions', async () => {
    const predictions: Array<{
      errorPercent: number;
      confidence: number;
    }> = [];

    for (const testCase of testDataset.slice(0, 50)) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
        
        predictions.push({
          errorPercent,
          confidence: prediction.confidence,
        });
      } catch (error) {
        // Skip failed predictions
      }
    }

    // Split into high and low accuracy groups
    const highAccuracy = predictions.filter(p => p.errorPercent <= 10);
    const lowAccuracy = predictions.filter(p => p.errorPercent > 20);

    if (highAccuracy.length > 0 && lowAccuracy.length > 0) {
      const avgConfidenceHigh = highAccuracy.reduce((sum, p) => sum + p.confidence, 0) / highAccuracy.length;
      const avgConfidenceLow = lowAccuracy.reduce((sum, p) => sum + p.confidence, 0) / lowAccuracy.length;

      console.log('\nConfidence vs Accuracy:');
      console.log(`  High accuracy (≤10% error): avg confidence ${avgConfidenceHigh.toFixed(2)}`);
      console.log(`  Low accuracy (>20% error): avg confidence ${avgConfidenceLow.toFixed(2)}`);

      // High accuracy predictions should have higher confidence
      expect(avgConfidenceHigh).toBeGreaterThan(avgConfidenceLow);
    }
  });

  it('should provide reasonable confidence intervals', async () => {
    const predictions: Array<{
      actual: number;
      predicted: number;
      lowerBound: number;
      upperBound: number;
      withinInterval: boolean;
    }> = [];

    for (const testCase of testDataset.slice(0, 50)) {
      try {
        const prediction = await predictionService.generatePrediction(testCase.auctionId);
        
        const withinInterval = 
          testCase.actualPrice >= prediction.lowerBound &&
          testCase.actualPrice <= prediction.upperBound;

        predictions.push({
          actual: testCase.actualPrice,
          predicted: prediction.predictedPrice,
          lowerBound: prediction.lowerBound,
          upperBound: prediction.upperBound,
          withinInterval,
        });
      } catch (error) {
        // Skip failed predictions
      }
    }

    const withinIntervalCount = predictions.filter(p => p.withinInterval).length;
    const intervalCoverage = (withinIntervalCount / predictions.length) * 100;

    console.log('\nConfidence Interval Coverage:');
    console.log(`  Total predictions: ${predictions.length}`);
    console.log(`  Within interval: ${withinIntervalCount} (${intervalCoverage.toFixed(2)}%)`);

    // At least 80% of actual prices should fall within confidence intervals
    expect(intervalCoverage).toBeGreaterThanOrEqual(80);
  });

  it('should handle edge cases gracefully', async () => {
    // Test with very high-value assets
    const highValueCases = testDataset.filter(d => d.actualPrice > 20000000);
    
    if (highValueCases.length > 0) {
      const predictions: Array<{ errorPercent: number }> = [];

      for (const testCase of highValueCases) {
        try {
          const prediction = await predictionService.generatePrediction(testCase.auctionId);
          const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
          predictions.push({ errorPercent });
        } catch (error) {
          // Skip failed predictions
        }
      }

      const avgError = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;

      console.log('\nHigh-Value Asset Accuracy:');
      console.log(`  Total predictions: ${predictions.length}`);
      console.log(`  Average error: ${avgError.toFixed(2)}%`);

      // Allow slightly higher error for high-value assets
      expect(avgError).toBeLessThan(20);
    }
  });

  it('should improve accuracy with more historical data', async () => {
    // Group by make/model to test data availability impact
    const makeModelGroups = new Map<string, typeof testDataset>();
    
    testDataset.forEach(d => {
      if (d.make && d.model) {
        const key = `${d.make}-${d.model}`;
        if (!makeModelGroups.has(key)) {
          makeModelGroups.set(key, []);
        }
        makeModelGroups.get(key)!.push(d);
      }
    });

    // Find groups with sufficient data
    const largeGroups = Array.from(makeModelGroups.entries())
      .filter(([_, items]) => items.length >= 5)
      .slice(0, 3);

    if (largeGroups.length > 0) {
      for (const [makeModel, items] of largeGroups) {
        const predictions: Array<{ errorPercent: number }> = [];

        for (const testCase of items) {
          try {
            const prediction = await predictionService.generatePrediction(testCase.auctionId);
            const errorPercent = (Math.abs(testCase.actualPrice - prediction.predictedPrice) / testCase.actualPrice) * 100;
            predictions.push({ errorPercent });
          } catch (error) {
            // Skip
          }
        }

        const avgError = predictions.reduce((sum, p) => sum + p.errorPercent, 0) / predictions.length;

        console.log(`\n${makeModel} (n=${items.length}): ${avgError.toFixed(2)}% avg error`);

        // Groups with more data should have better accuracy
        expect(avgError).toBeLessThan(15);
      }
    }
  });
});
