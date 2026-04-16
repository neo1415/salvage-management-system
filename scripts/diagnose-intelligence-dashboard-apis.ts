/**
 * Diagnostic Script: Intelligence Dashboard APIs
 * 
 * Tests all APIs used by the Intelligence Dashboard to identify why
 * Vendor Analytics, Schema Evolution, and ML Datasets show 0 or no data
 */

import { db } from '@/lib/db';
import { 
  vendorSegments,
  schemaEvolutionLog,
  mlTrainingDatasets,
  predictions,
  predictionLogs
} from '@/lib/db/schema';
import { sql, desc, gte } from 'drizzle-orm';
import { subDays } from 'date-fns';

async function diagnoseIntelligenceDashboard() {
  console.log('🔍 INTELLIGENCE DASHBOARD API DIAGNOSTIC\n');
  console.log('=' .repeat(60));

  // Test 1: Vendor Segments
  console.log('\n📊 TEST 1: Vendor Segments (Vendor Analytics Tab)');
  console.log('-'.repeat(60));
  
  try {
    const segments = await db
      .select({
        segment: vendorSegments.activitySegment,
        count: sql<number>`COUNT(*)`,
        avgBidAmount: sql<number>`AVG(CASE WHEN preferred_price_range IS NOT NULL THEN (preferred_price_range->>'max')::numeric ELSE 0 END)`,
        avgWinRate: sql<number>`AVG(overall_win_rate)`,
      })
      .from(vendorSegments)
      .where(sql`${vendorSegments.activitySegment} IS NOT NULL`)
      .groupBy(vendorSegments.activitySegment)
      .orderBy(sql`COUNT(*) DESC`);

    console.log(`✅ Query executed successfully`);
    console.log(`📈 Results: ${segments.length} segments found`);
    
    if (segments.length > 0) {
      console.log('\nSegment Distribution:');
      segments.forEach(s => {
        console.log(`  - ${s.segment}: ${s.count} vendors (${s.avgWinRate}% win rate)`);
      });
    } else {
      console.log('⚠️  No vendor segments found in database');
      
      // Check if table has any data
      const totalRecords = await db.select({ count: sql<number>`COUNT(*)` }).from(vendorSegments);
      console.log(`   Total records in vendor_segments: ${totalRecords[0].count}`);
      
      if (totalRecords[0].count > 0) {
        // Check if activitySegment is NULL
        const nullSegments = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(vendorSegments)
          .where(sql`${vendorSegments.activitySegment} IS NULL`);
        console.log(`   Records with NULL activitySegment: ${nullSegments[0].count}`);
      }
    }
  } catch (error) {
    console.error('❌ Error querying vendor segments:', error);
  }

  // Test 2: Schema Evolution Log
  console.log('\n\n📝 TEST 2: Schema Evolution Log');
  console.log('-'.repeat(60));
  
  try {
    const changes = await db
      .select()
      .from(schemaEvolutionLog)
      .orderBy(desc(schemaEvolutionLog.createdAt))
      .limit(10);

    console.log(`✅ Query executed successfully`);
    console.log(`📈 Results: ${changes.length} schema changes found`);
    
    if (changes.length > 0) {
      console.log('\nRecent Schema Changes:');
      changes.forEach(c => {
        console.log(`  - ${c.changeType}: ${c.entityType}.${c.entityName} (${c.status})`);
      });
      
      // Count by status
      const pending = changes.filter(c => c.status === 'pending').length;
      const approved = changes.filter(c => c.status === 'approved').length;
      const rejected = changes.filter(c => c.status === 'rejected').length;
      console.log(`\nStatus Summary: ${pending} pending, ${approved} approved, ${rejected} rejected`);
    } else {
      console.log('⚠️  No schema evolution log entries found');
      
      // Check total records
      const totalRecords = await db.select({ count: sql<number>`COUNT(*)` }).from(schemaEvolutionLog);
      console.log(`   Total records in schema_evolution_log: ${totalRecords[0].count}`);
    }
  } catch (error) {
    console.error('❌ Error querying schema evolution log:', error);
  }

  // Test 3: ML Training Datasets
  console.log('\n\n🤖 TEST 3: ML Training Datasets');
  console.log('-'.repeat(60));
  
  try {
    const datasets = await db
      .select()
      .from(mlTrainingDatasets)
      .orderBy(desc(mlTrainingDatasets.createdAt));

    console.log(`✅ Query executed successfully`);
    console.log(`📈 Results: ${datasets.length} datasets found`);
    
    if (datasets.length > 0) {
      console.log('\nDatasets:');
      datasets.forEach(d => {
        const sizeInMB = d.fileSize ? (d.fileSize / (1024 * 1024)).toFixed(2) : '0';
        console.log(`  - ${d.datasetType}: ${d.recordCount} records, ${sizeInMB} MB`);
      });
      
      const totalRecords = datasets.reduce((sum, d) => sum + d.recordCount, 0);
      const totalSize = datasets.reduce((sum, d) => sum + (d.fileSize || 0), 0);
      console.log(`\nTotal: ${totalRecords.toLocaleString()} records, ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    } else {
      console.log('⚠️  No ML training datasets found');
      
      // Check total records
      const totalRecords = await db.select({ count: sql<number>`COUNT(*)` }).from(mlTrainingDatasets);
      console.log(`   Total records in ml_training_datasets: ${totalRecords[0].count}`);
    }
  } catch (error) {
    console.error('❌ Error querying ML datasets:', error);
  }

  // Test 4: System Metrics (for context)
  console.log('\n\n⚙️  TEST 4: System Metrics (Overview Tab - Should Work)');
  console.log('-'.repeat(60));
  
  try {
    const startDate = subDays(new Date(), 30);
    
    // Prediction accuracy
    const metrics = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        accuracy: sql<number>`AVG(CASE WHEN accuracy IS NOT NULL THEN accuracy ELSE 0 END)`,
        avgError: sql<number>`AVG(CASE WHEN absolute_error IS NOT NULL THEN absolute_error ELSE 0 END)`,
        predictions: sql<number>`COUNT(*)`,
      })
      .from(predictionLogs)
      .where(gte(predictionLogs.createdAt, startDate))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    console.log(`✅ Prediction metrics query executed`);
    console.log(`📈 Results: ${metrics.length} days of data`);
    
    if (metrics.length > 0) {
      const avgAccuracy = metrics.reduce((sum, m) => sum + Number(m.accuracy), 0) / metrics.length;
      const totalPredictions = metrics.reduce((sum, m) => sum + Number(m.predictions), 0);
      console.log(`   Average Accuracy: ${avgAccuracy.toFixed(1)}%`);
      console.log(`   Total Predictions: ${totalPredictions}`);
    }
  } catch (error) {
    console.error('❌ Error querying system metrics:', error);
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\nExpected Issues:');
  console.log('1. Vendor Analytics: Check if activitySegment is NULL');
  console.log('2. Schema Evolution: Check if table is empty');
  console.log('3. ML Datasets: Check if table is empty');
  console.log('\nNext Steps:');
  console.log('- If tables are empty: Run population scripts');
  console.log('- If activitySegment is NULL: Update vendor_segments data');
  console.log('- If date range mismatch: Update period_start/period_end fields');
}

diagnoseIntelligenceDashboard()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
