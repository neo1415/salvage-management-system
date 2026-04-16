/**
 * Materialized View Refresh Trigger
 * Task 8.2.2: Implement materialized view refresh triggers
 * 
 * Refreshes materialized views after significant data changes.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Refresh all intelligence materialized views
 * 
 * Uses CONCURRENTLY to avoid locking tables during refresh.
 */
export async function refreshMaterializedViews(): Promise<void> {
  try {
    console.log('🔄 Starting materialized view refresh...');
    
    const startTime = Date.now();
    
    // Refresh vendor_bidding_patterns_mv
    console.log('  - Refreshing vendor_bidding_patterns_mv...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns_mv`);
    console.log('  ✅ vendor_bidding_patterns_mv refreshed');
    
    // Refresh market_conditions_mv
    console.log('  - Refreshing market_conditions_mv...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY market_conditions_mv`);
    console.log('  ✅ market_conditions_mv refreshed');
    
    const duration = Date.now() - startTime;
    console.log(`✅ All materialized views refreshed successfully in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error refreshing materialized views:', error);
    throw error;
  }
}

/**
 * Refresh vendor bidding patterns materialized view only
 */
export async function refreshVendorBiddingPatterns(): Promise<void> {
  try {
    console.log('🔄 Refreshing vendor_bidding_patterns_mv...');
    const startTime = Date.now();
    
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns_mv`);
    
    const duration = Date.now() - startTime;
    console.log(`✅ vendor_bidding_patterns_mv refreshed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error refreshing vendor_bidding_patterns_mv:', error);
    throw error;
  }
}

/**
 * Refresh market conditions materialized view only
 */
export async function refreshMarketConditions(): Promise<void> {
  try {
    console.log('🔄 Refreshing market_conditions_mv...');
    const startTime = Date.now();
    
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY market_conditions_mv`);
    
    const duration = Date.now() - startTime;
    console.log(`✅ market_conditions_mv refreshed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error refreshing market_conditions_mv:', error);
    throw error;
  }
}

/**
 * Trigger refresh after significant data changes
 * 
 * @param changeType - Type of data change (bid, auction, case)
 */
export async function triggerRefreshOnDataChange(
  changeType: 'bid' | 'auction' | 'case'
): Promise<void> {
  try {
    console.log(`📊 Data change detected (${changeType}) - scheduling materialized view refresh`);
    
    // Refresh asynchronously to avoid blocking the main operation
    setImmediate(async () => {
      try {
        if (changeType === 'bid') {
          // Refresh vendor patterns on new bids
          await refreshVendorBiddingPatterns();
        } else if (changeType === 'auction') {
          // Refresh market conditions on auction changes
          await refreshMarketConditions();
        } else if (changeType === 'case') {
          // Refresh both on new cases
          await refreshMaterializedViews();
        }
      } catch (error) {
        console.error('Error in async materialized view refresh:', error);
      }
    });
    
    console.log('✅ Materialized view refresh scheduled');
  } catch (error) {
    console.error('❌ Error triggering materialized view refresh:', error);
    // Don't throw - data change should succeed even if refresh fails
  }
}
