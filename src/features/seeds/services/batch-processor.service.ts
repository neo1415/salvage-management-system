/**
 * Batch Processor Service
 * 
 * Processes seed records in batches for optimal performance.
 * Provides progress indicators and aggregates results across batches.
 * Handles batch-level failures with fallback to individual processing.
 * 
 * Requirements: 13.1, 13.2, 13.3
 */

export interface BatchResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ record: any; error: Error }>;
}

export interface ProcessingStats {
  totalRecords: number;
  totalImported: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: Array<{ record: any; error: Error }>;
}

export class BatchProcessor<T = any> {
  /**
   * Process records in batches
   * 
   * @param records - Array of records to process
   * @param batchSize - Number of records per batch (default: 50)
   * @param processor - Async function that processes a batch and returns results
   * @returns Aggregated processing statistics
   */
  async processBatch(
    records: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<BatchResult>
  ): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      totalRecords: records.length,
      totalImported: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [],
    };

    // Calculate total number of batches
    const totalBatches = Math.ceil(records.length / batchSize);

    // Process records in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      // Display progress indicator
      console.log(
        `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`
      );

      try {
        // Process the batch
        const batchResult = await processor(batch);

        // Aggregate results
        stats.totalImported += batchResult.imported;
        stats.totalUpdated += batchResult.updated;
        stats.totalSkipped += batchResult.skipped;
        stats.totalErrors += batchResult.errors.length;
        stats.errors.push(...batchResult.errors);

        // Display batch summary
        console.log(
          `   ✅ Imported: ${batchResult.imported}, ` +
          `🔄 Updated: ${batchResult.updated}, ` +
          `⏭️  Skipped: ${batchResult.skipped}, ` +
          `❌ Errors: ${batchResult.errors.length}`
        );
      } catch (error) {
        // Batch-level failure - fall back to individual processing
        console.warn(
          `⚠️  Batch ${batchNumber} failed, falling back to individual processing...`
        );
        console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);

        // Process each record individually
        const fallbackResult = await this.processIndividually(batch, processor);

        // Aggregate fallback results
        stats.totalImported += fallbackResult.imported;
        stats.totalUpdated += fallbackResult.updated;
        stats.totalSkipped += fallbackResult.skipped;
        stats.totalErrors += fallbackResult.errors.length;
        stats.errors.push(...fallbackResult.errors);

        console.log(
          `   ✅ Fallback complete: Imported: ${fallbackResult.imported}, ` +
          `🔄 Updated: ${fallbackResult.updated}, ` +
          `⏭️  Skipped: ${fallbackResult.skipped}, ` +
          `❌ Errors: ${fallbackResult.errors.length}`
        );
      }
    }

    return stats;
  }

  /**
   * Process records individually (fallback for batch failures)
   * 
   * @param records - Array of records to process
   * @param processor - Async function that processes a batch
   * @returns Aggregated processing statistics
   */
  private async processIndividually(
    records: T[],
    processor: (batch: T[]) => Promise<BatchResult>
  ): Promise<BatchResult> {
    const result: BatchResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Process each record as a single-item batch
    for (const record of records) {
      try {
        const singleResult = await processor([record]);
        result.imported += singleResult.imported;
        result.updated += singleResult.updated;
        result.skipped += singleResult.skipped;
        result.errors.push(...singleResult.errors);
      } catch (error) {
        // Individual record failed
        result.errors.push({
          record,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        result.skipped++;
      }
    }

    return result;
  }
}

// Export singleton instance
export const batchProcessor = new BatchProcessor();
