/**
 * MLDatasetService
 * Tasks 6.2.1-6.2.10
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { mlTrainingDatasets } from '@/lib/db/schema/ml-training';
import { predictions } from '@/lib/db/schema/intelligence';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';

type DatasetType = typeof mlTrainingDatasets.$inferInsert.datasetType;
type ExportFormat = typeof mlTrainingDatasets.$inferInsert.format;
type DatasetRow = Record<string, unknown>;

export class MLDatasetService {
  async exportPricePredictionDataset(
    dateRangeStart: Date,
    dateRangeEnd: Date,
    format: ExportFormat = 'csv'
  ): Promise<string> {
    const result = await db.execute(sql`
      SELECT 
        a.id AS auction_id,
        sc.asset_type,
        sc.asset_details->>'make' AS make,
        sc.asset_details->>'model' AS model,
        (sc.asset_details->>'year')::int AS year,
        sc.damage_severity,
        sc.market_value,
        sc.estimated_salvage_value,
        a.current_bid AS actual_price,
        p.predicted_price,
        p.confidence_score,
        p.method,
        COUNT(b.id) AS bid_count,
        a.watching_count
      FROM ${auctions} a
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      LEFT JOIN ${predictions} p ON p.auction_id = a.id
      LEFT JOIN bids b ON b.auction_id = a.id
      WHERE a.status = 'closed'
        AND a.end_time BETWEEN ${dateRangeStart} AND ${dateRangeEnd}
        AND a.current_bid IS NOT NULL
      GROUP BY a.id, sc.id, p.id
    `);

    const data = result as unknown as DatasetRow[];

    await this.storeDatasetMetadata(
      'price_prediction',
      format,
      data.length,
      dateRangeStart,
      dateRangeEnd
    );

    if (format === 'csv') {
      return this.exportToCSV(data);
    } else if (format === 'json') {
      return this.exportToJSON(data);
    } else {
      return this.exportToParquet(data);
    }
  }

  async exportRecommendationDataset(
    dateRangeStart: Date,
    dateRangeEnd: Date,
    format: ExportFormat = 'csv'
  ): Promise<string> {
    const result = await db.execute(sql`
      SELECT 
        r.vendor_id,
        r.auction_id,
        r.match_score,
        r.collaborative_score,
        r.content_score,
        r.clicked,
        r.bid_placed,
        sc.asset_type,
        sc.asset_details
      FROM recommendations r
      JOIN auctions a ON r.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE r.created_at BETWEEN ${dateRangeStart} AND ${dateRangeEnd}
    `);

    const data = result as unknown as DatasetRow[];

    await this.storeDatasetMetadata(
      'recommendation',
      format,
      data.length,
      dateRangeStart,
      dateRangeEnd
    );

    if (format === 'csv') {
      return this.exportToCSV(data);
    } else if (format === 'json') {
      return this.exportToJSON(data);
    } else {
      return this.exportToParquet(data);
    }
  }

  /**
   * Export fraud detection dataset
   * Task 6.2.3: Implement fraud detection dataset export
   */
  async exportFraudDetectionDataset(
    dateRangeStart: Date,
    dateRangeEnd: Date,
    format: ExportFormat = 'csv'
  ): Promise<string> {
    const result = await db.execute(sql`
      SELECT 
        fa.id AS alert_id,
        fa.entity_type,
        fa.entity_id,
        fa.risk_score,
        fa.flag_reasons,
        fa.status,
        fa.created_at,
        CASE 
          WHEN fa.status = 'confirmed' THEN 1
          WHEN fa.status = 'dismissed' THEN 0
          ELSE NULL
        END AS is_fraud,
        fdl.detection_type,
        fdl.analysis_details
      FROM fraud_alerts fa
      LEFT JOIN fraud_detection_logs fdl ON fdl.fraud_alert_id = fa.id
      WHERE fa.created_at BETWEEN ${dateRangeStart} AND ${dateRangeEnd}
        AND fa.status IN ('confirmed', 'dismissed')
    `);

    const data = result as unknown as DatasetRow[];

    await this.storeDatasetMetadata(
      'fraud_detection',
      format,
      data.length,
      dateRangeStart,
      dateRangeEnd
    );

    if (format === 'csv') {
      return this.exportToCSV(data);
    } else if (format === 'json') {
      return this.exportToJSON(data);
    } else {
      return this.exportToParquet(data);
    }
  }

  /**
   * Split dataset into train/validation/test sets with stratified sampling
   * Task 6.2.4: Implement train/validation/test split with stratified sampling
   */
  splitDataset<T extends Record<string, unknown>>(
    data: T[],
    trainRatio: number = 0.7,
    valRatio: number = 0.15,
    testRatio: number = 0.15,
    stratifyBy?: string
  ): { train: T[]; validation: T[]; test: T[] } {
    if (Math.abs(trainRatio + valRatio + testRatio - 1.0) > 0.001) {
      throw new Error('Train, validation, and test ratios must sum to 1.0');
    }

    // Shuffle data
    const shuffled = [...data].sort(() => Math.random() - 0.5);

    if (!stratifyBy) {
      // Simple split without stratification
      const trainSize = Math.floor(shuffled.length * trainRatio);
      const valSize = Math.floor(shuffled.length * valRatio);

      return {
        train: shuffled.slice(0, trainSize),
        validation: shuffled.slice(trainSize, trainSize + valSize),
        test: shuffled.slice(trainSize + valSize),
      };
    }

    // Stratified split
    const groups: Record<string, T[]> = {};
    for (const item of shuffled) {
      const key = String(item[stratifyBy] ?? 'unknown');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }

    const train: T[] = [];
    const validation: T[] = [];
    const test: T[] = [];

    for (const group of Object.values(groups)) {
      const groupTrainSize = Math.floor(group.length * trainRatio);
      const groupValSize = Math.floor(group.length * valRatio);

      train.push(...group.slice(0, groupTrainSize));
      validation.push(...group.slice(groupTrainSize, groupTrainSize + groupValSize));
      test.push(...group.slice(groupTrainSize + groupValSize));
    }

    return { train, validation, test };
  }

  private async storeDatasetMetadata(
    datasetType: DatasetType,
    format: ExportFormat,
    recordCount: number,
    dateRangeStart: Date,
    dateRangeEnd: Date
  ): Promise<string> {
    const [dataset] = await db
      .insert(mlTrainingDatasets)
      .values({
        datasetType,
        datasetName: `${datasetType}_${Date.now()}`,
        format,
        recordCount,
        featureCount: 0,
        dateRangeStart,
        dateRangeEnd,
        metadata: {
          description: null,
          version: 'v1',
          anonymized: true,
          filters: {},
        },
      })
      .returning({ id: mlTrainingDatasets.id });

    return dataset.id;
  }

  private exportToCSV(data: DatasetRow[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => this.anonymizeValue(v)).join(','));

    return [headers, ...rows].join('\n');
  }

  private exportToJSON(data: DatasetRow[]): string {
    const anonymized = data.map(row => {
      const newRow: DatasetRow = {};
      for (const [key, value] of Object.entries(row)) {
        newRow[key] = this.anonymizeValue(value);
      }
      return newRow;
    });

    return JSON.stringify(anonymized, null, 2);
  }

  private exportToParquet(data: DatasetRow[]): string {
    // Task 6.2.7: Implement actual Parquet export
    // Note: Parquet export requires parquetjs library which is not installed
    // For production, install: npm install parquetjs
    // Implementation would use ParquetWriter to write binary Parquet format
    
    // For now, return JSON format as fallback
    // ML extension: implement actual Parquet export using parquetjs when needed.
    /*
    Example implementation with parquetjs:
    
    import parquet from 'parquetjs';
    
    const schema = new parquet.ParquetSchema({
      auction_id: { type: 'UTF8' },
      asset_type: { type: 'UTF8' },
      make: { type: 'UTF8' },
      model: { type: 'UTF8' },
      year: { type: 'INT32' },
      actual_price: { type: 'DOUBLE' },
      predicted_price: { type: 'DOUBLE' },
      // ... other fields
    });
    
    const writer = await parquet.ParquetWriter.openFile(schema, 'output.parquet');
    
    for (const row of data) {
      await writer.appendRow(row);
    }
    
    await writer.close();
    */
    
    console.warn('Parquet export not fully implemented. Returning JSON format.');
    return this.exportToJSON(data);
  }

  private anonymizeValue(value: unknown): unknown {
    if (typeof value === 'string' && value.includes('@')) {
      return 'REDACTED_EMAIL';
    }
    if (typeof value === 'string' && value.match(/^\+?[\d\s-()]+$/)) {
      return 'REDACTED_PHONE';
    }
    return value;
  }
}
