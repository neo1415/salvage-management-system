/**
 * Diagnostic Script: Case Processing Data Analysis
 * 
 * This script analyzes the actual data in the database to understand:
 * 1. What the Master Report calculates for case processing
 * 2. What the Case Processing Report currently shows
 * 3. What additional metrics we can add based on available data
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnoseCaseProcessingData() {
  console.log('🔍 CASE PROCESSING DATA ANALYSIS');
  console.log('='.repeat(80));
  console.log('');

  // Date range for analysis (Feb 1 - April 28, 2026)
  const startDate = '2026-02-01';
  const endDate = '2026-04-29';

  console.log(`📅 Date Range: ${startDate} to ${endDate}`);
  console.log('');

  // 1. MASTER REPORT LOGIC (Source of Truth)
  console.log('📊 MASTER REPORT CASE PROCESSING LOGIC:');
  console.log('-'.repeat(80));
  
  const masterReportData = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT sc.id) as total_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status != 'draft') as non_draft_cases,
      AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 86400) as avg_processing_days,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'approved') as approved_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'pending_approval') as pending_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'sold') as sold_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'active_auction') as active_auction_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'cancelled') as cancelled_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'draft') as draft_cases
    FROM salvage_cases sc
    WHERE sc.created_at >= ${startDate}
      AND sc.created_at <= ${endDate}
  `);

  const masterRow = masterReportData[0] as any;
  console.log(`Total Cases (including drafts): ${masterRow.total_cases}`);
  console.log(`Total Cases (excluding drafts): ${masterRow.non_draft_cases}`);
  console.log(`Avg Processing Time: ${parseFloat(masterRow.avg_processing_days || '0').toFixed(2)} days`);
  console.log(`Approved: ${masterRow.approved_cases}`);
  console.log(`Pending Approval: ${masterRow.pending_cases}`);
  console.log(`Sold: ${masterRow.sold_cases}`);
  console.log(`Active Auction: ${masterRow.active_auction_cases}`);
  console.log(`Cancelled: ${masterRow.cancelled_cases}`);
  console.log(`Draft: ${masterRow.draft_cases}`);
  console.log('');

  // 2. CASE PROCESSING BY ASSET TYPE
  console.log('📦 CASE PROCESSING BY ASSET TYPE:');
  console.log('-'.repeat(80));
  
  const byAssetType = await db.execute(sql`
    SELECT 
      sc.asset_type,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 86400) as avg_processing_days,
      COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold')) as approved_count,
      COUNT(*) FILTER (WHERE sc.status = 'pending_approval') as pending_count
    FROM salvage_cases sc
    WHERE sc.created_at >= ${startDate}
      AND sc.created_at <= ${endDate}
      AND sc.status != 'draft'
    GROUP BY sc.asset_type
    ORDER BY count DESC
  `);

  for (const row of byAssetType as any[]) {
    const approvalRate = row.count > 0 ? (row.approved_count / row.count * 100).toFixed(1) : '0.0';
    console.log(`${row.asset_type}:`);
    console.log(`  Count: ${row.count}`);
    console.log(`  Avg Processing: ${parseFloat(row.avg_processing_days || '0').toFixed(2)} days`);
    console.log(`  Approval Rate: ${approvalRate}%`);
    console.log('');
  }

  // 3. CASE PROCESSING BY ADJUSTER
  console.log('👤 CASE PROCESSING BY ADJUSTER:');
  console.log('-'.repeat(80));
  
  const byAdjuster = await db.execute(sql`
    SELECT 
      u.id,
      u.full_name,
      COUNT(sc.id) as cases_processed,
      AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 86400) as avg_processing_days,
      COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold')) as approved_count,
      COUNT(*) FILTER (WHERE sc.status = 'pending_approval') as pending_count
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by
      AND sc.created_at >= ${startDate}
      AND sc.created_at <= ${endDate}
      AND sc.status != 'draft'
    WHERE u.role = 'claims_adjuster'
    GROUP BY u.id, u.full_name
    HAVING COUNT(sc.id) > 0
    ORDER BY cases_processed DESC
  `);

  for (const row of byAdjuster as any[]) {
    const approvalRate = row.cases_processed > 0 ? (row.approved_count / row.cases_processed * 100).toFixed(1) : '0.0';
    console.log(`${row.full_name}:`);
    console.log(`  Cases Processed: ${row.cases_processed}`);
    console.log(`  Avg Processing: ${parseFloat(row.avg_processing_days || '0').toFixed(2)} days`);
    console.log(`  Approval Rate: ${approvalRate}%`);
    console.log('');
  }

  // 4. AVAILABLE COLUMNS FOR COMPREHENSIVE METRICS
  console.log('📋 AVAILABLE DATA COLUMNS FOR COMPREHENSIVE METRICS:');
  console.log('-'.repeat(80));
  
  const sampleCase = await db.execute(sql`
    SELECT *
    FROM salvage_cases
    WHERE created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND status != 'draft'
    LIMIT 1
  `);

  if (sampleCase.length > 0) {
    const columns = Object.keys(sampleCase[0] as any);
    console.log('Available columns:');
    columns.forEach(col => console.log(`  - ${col}`));
    console.log('');
  }

  // 5. ADDITIONAL METRICS WE CAN CALCULATE
  console.log('💡 ADDITIONAL COMPREHENSIVE METRICS AVAILABLE:');
  console.log('-'.repeat(80));
  
  const additionalMetrics = await db.execute(sql`
    SELECT 
      -- AI Assessment metrics
      COUNT(*) FILTER (WHERE sc.ai_assessment IS NOT NULL) as cases_with_ai_assessment,
      AVG((sc.ai_assessment->>'confidenceScore')::numeric) as avg_ai_confidence,
      
      -- Photo metrics
      AVG(array_length(sc.photos, 1)) as avg_photos_per_case,
      COUNT(*) FILTER (WHERE array_length(sc.photos, 1) >= 5) as cases_with_5plus_photos,
      
      -- Voice note metrics
      COUNT(*) FILTER (WHERE sc.voice_notes IS NOT NULL AND array_length(sc.voice_notes, 1) > 0) as cases_with_voice_notes,
      
      -- Valuation metrics
      AVG(CAST(sc.market_value AS NUMERIC)) as avg_market_value,
      AVG(CAST(sc.estimated_salvage_value AS NUMERIC)) as avg_salvage_value,
      AVG(CAST(sc.reserve_price AS NUMERIC)) as avg_reserve_price,
      
      -- Manager override metrics
      COUNT(*) FILTER (WHERE sc.manager_overrides IS NOT NULL) as cases_with_manager_overrides,
      
      -- Approval metrics
      COUNT(*) FILTER (WHERE sc.approved_by IS NOT NULL) as cases_approved,
      COUNT(*) FILTER (WHERE sc.approved_at IS NOT NULL) as cases_with_approval_timestamp
      
    FROM salvage_cases sc
    WHERE sc.created_at >= ${startDate}
      AND sc.created_at <= ${endDate}
      AND sc.status != 'draft'
  `);

  const metricsRow = additionalMetrics[0] as any;
  console.log(`Cases with AI Assessment: ${metricsRow.cases_with_ai_assessment}`);
  console.log(`Avg AI Confidence: ${parseFloat(metricsRow.avg_ai_confidence || '0').toFixed(2)}%`);
  console.log(`Avg Photos per Case: ${parseFloat(metricsRow.avg_photos_per_case || '0').toFixed(1)}`);
  console.log(`Cases with 5+ Photos: ${metricsRow.cases_with_5plus_photos}`);
  console.log(`Cases with Voice Notes: ${metricsRow.cases_with_voice_notes}`);
  console.log(`Avg Market Value: ₦${parseFloat(metricsRow.avg_market_value || '0').toFixed(2)}`);
  console.log(`Avg Salvage Value: ₦${parseFloat(metricsRow.avg_salvage_value || '0').toFixed(2)}`);
  console.log(`Avg Reserve Price: ₦${parseFloat(metricsRow.avg_reserve_price || '0').toFixed(2)}`);
  console.log(`Cases with Manager Overrides: ${metricsRow.cases_with_manager_overrides}`);
  console.log(`Cases Approved: ${metricsRow.cases_approved}`);
  console.log('');

  console.log('✅ Analysis Complete!');
  console.log('');
  console.log('📝 RECOMMENDATIONS:');
  console.log('-'.repeat(80));
  console.log('1. Case Processing Report should EXCLUDE draft cases (like Master Report)');
  console.log('2. Processing time should be in DAYS, not hours');
  console.log('3. Approval rate should be: approved / (approved + pending + cancelled)');
  console.log('4. Add comprehensive metrics:');
  console.log('   - AI assessment quality metrics');
  console.log('   - Photo quality metrics');
  console.log('   - Voice note usage');
  console.log('   - Valuation accuracy');
  console.log('   - Manager override frequency');
  console.log('');

  process.exit(0);
}

diagnoseCaseProcessingData().catch(console.error);
