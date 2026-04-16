/**
 * Comprehensive Analytics Dashboard Diagnostic Script
 * 
 * Diagnoses all 9 critical issues:
 * 1. Sell-through rate display (0.8% vs 80%)
 * 2. React key prop warnings
 * 3. Make/model/brand display for all asset types
 * 4. Performance by Color/Trim/Storage empty
 * 5. Geographic Distribution "Unknown" regions
 * 6. Vendor Segments NaN% and zeros
 * 7. Session Analytics all zeros
 * 8. Conversion Funnel no data
 * 9. ML Datasets 400 Bad Request
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function diagnoseAllIssues() {
  console.log('🔍 COMPREHENSIVE ANALYTICS DASHBOARD DIAGNOSTIC\n');
  console.log('=' .repeat(80));

  // Issue 1: Sell-Through Rate Display
  console.log('\n📊 ISSUE 1: SELL-THROUGH RATE DISPLAY');
  console.log('-'.repeat(80));
  
  try {
    const assetPerformance = await db.execute(sql`
      SELECT 
        asset_type,
        make,
        model,
        AVG(avg_sell_through_rate) as avg_sell_through_rate,
        COUNT(*) as record_count
      FROM asset_performance_analytics
      WHERE avg_sell_through_rate IS NOT NULL
      GROUP BY asset_type, make, model
      LIMIT 5
    `);
    
    const rows = Array.isArray(assetPerformance) ? assetPerformance : (assetPerformance.rows || []);
    console.log('Sample sell-through rates from database:');
    console.log(rows);
    console.log('\n💡 Analysis:');
    if (rows.length > 0) {
      const sampleRate = Number(rows[0].avg_sell_through_rate);
      if (sampleRate < 1) {
        console.log(`✅ Database stores as decimal (${sampleRate}) - UI should multiply by 100`);
        console.log(`   Current: "${(sampleRate * 100).toFixed(1)}%" ❌`);
        console.log(`   Should be: "${(sampleRate * 100).toFixed(0)}%" ✅`);
      } else {
        console.log(`⚠️  Database stores as percentage (${sampleRate}) - UI should display as-is`);
      }
    } else {
      console.log('❌ No sell-through rate data found');
    }
  } catch (error: any) {
    console.log('❌ Error querying asset performance:', error.message);
  }

  // Issue 2: React Key Prop Warnings - Check vendor segments component
  console.log('\n\n🔑 ISSUE 2: REACT KEY PROP WARNINGS');
  console.log('-'.repeat(80));
  console.log('Component: vendor-segments-chart.tsx');
  console.log('Locations to check:');
  console.log('  1. <Cell> elements in PieChart (line ~115)');
  console.log('  2. <TableRow> elements in TableBody (line ~165)');
  console.log('  3. Any mapped <div> elements');
  console.log('\n💡 Fix: Ensure all mapped elements have unique key prop');

  // Issue 3: Make/Model/Brand Display
  console.log('\n\n🚗 ISSUE 3: MAKE/MODEL/BRAND DISPLAY');
  console.log('-'.repeat(80));
  
  const assetNames = await db.execute(sql`
    SELECT 
      asset_type,
      make,
      model,
      year,
      COUNT(*) as count
    FROM asset_performance_analytics
    GROUP BY asset_type, make, model, year
    ORDER BY asset_type, count DESC
    LIMIT 10
  `);
  
  console.log('Asset name data by type:');
  assetNames.rows.forEach((row: any) => {
    const { asset_type, make, model, year, count } = row;
    console.log(`  ${asset_type}: make="${make}", model="${model}", year="${year}" (${count} records)`);
  });
  
  console.log('\n💡 Expected display format:');
  console.log('  Vehicles: "Toyota Camry 2020"');
  console.log('  Electronics: "Apple iPhone 12 Pro" (brand + model)');
  console.log('  Machinery: "CAT D9T" (brand + model)');

  // Issue 4: Performance by Color/Trim/Storage
  console.log('\n\n🎨 ISSUE 4: PERFORMANCE BY COLOR/TRIM/STORAGE');
  console.log('-'.repeat(80));
  
  const attributeData = await db.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT attribute_type) as unique_attributes,
      COUNT(DISTINCT attribute_value) as unique_values
    FROM attribute_performance_analytics
  `);
  
  console.log('Attribute performance data:');
  console.log(attributeData.rows[0]);
  
  const sampleAttributes = await db.execute(sql`
    SELECT 
      attribute_type,
      attribute_value,
      avg_price_premium,
      total_auctions
    FROM attribute_performance_analytics
    LIMIT 10
  `);
  
  console.log('\nSample attribute records:');
  console.log(sampleAttributes.rows);
  
  if (sampleAttributes.rows.length === 0) {
    console.log('\n❌ No attribute performance data - needs population');
  }

  // Issue 5: Geographic Distribution
  console.log('\n\n🌍 ISSUE 5: GEOGRAPHIC DISTRIBUTION');
  console.log('-'.repeat(80));
  
  const geoData = await db.execute(sql`
    SELECT 
      region,
      COUNT(*) as count,
      AVG(avg_final_price) as avg_price
    FROM geographic_patterns_analytics
    GROUP BY region
    ORDER BY count DESC
    LIMIT 10
  `);
  
  console.log('Geographic data by region:');
  geoData.rows.forEach((row: any) => {
    const region = row.region || 'NULL';
    console.log(`  ${region}: ${row.count} records, avg price: ₦${Number(row.avg_price || 0).toLocaleString()}`);
  });
  
  const unknownCount = geoData.rows.filter((row: any) => 
    !row.region || row.region === 'Unknown' || row.region === 'Nigeria'
  ).length;
  
  console.log(`\n💡 Analysis: ${unknownCount}/${geoData.rows.length} regions are Unknown/NULL/Nigeria`);
  console.log('   Should be: Lagos, Abuja, Port Harcourt, etc.');

  // Issue 6: Vendor Segments
  console.log('\n\n👥 ISSUE 6: VENDOR SEGMENTS');
  console.log('-'.repeat(80));
  
  const vendorSegments = await db.execute(sql`
    SELECT 
      price_segment || '_' || activity_segment as segment,
      COUNT(*) as count,
      AVG(overall_win_rate) as avg_win_rate,
      AVG(avg_bid_to_value_ratio) as avg_bid_amount,
      0 as total_revenue
    FROM vendor_segments
    GROUP BY price_segment, activity_segment
  `);
  
  console.log('Vendor segment data:');
  vendorSegments.rows.forEach((row: any) => {
    console.log(`  ${row.segment}:`);
    console.log(`    Count: ${row.count}`);
    console.log(`    Avg Win Rate: ${row.avg_win_rate}`);
    console.log(`    Avg Bid Amount: ${row.avg_bid_amount}`);
    console.log(`    Total Revenue: ${row.total_revenue}`);
  });
  
  if (vendorSegments.rows.length === 0) {
    console.log('❌ No vendor segment data found');
  } else {
    const hasNaN = vendorSegments.rows.some((row: any) => 
      row.avg_win_rate === null || row.avg_bid_amount === null
    );
    if (hasNaN) {
      console.log('⚠️  NULL values detected - will cause NaN% in UI');
    }
  }

  // Issue 7: Session Analytics
  console.log('\n\n⏱️  ISSUE 7: SESSION ANALYTICS');
  console.log('-'.repeat(80));
  
  const sessionData = await db.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      AVG(duration_seconds) as avg_duration,
      AVG(pages_viewed) as avg_pages,
      AVG(bounce_rate) as avg_bounce_rate,
      COUNT(*) as total_sessions
    FROM session_analytics
  `);
  
  console.log('Session analytics summary:');
  console.log(sessionData.rows[0]);
  
  if (Number(sessionData.rows[0]?.total_sessions || 0) === 0) {
    console.log('\n❌ No session data - session tracking not implemented or not populated');
  }

  // Issue 8: Conversion Funnel
  console.log('\n\n🔄 ISSUE 8: CONVERSION FUNNEL');
  console.log('-'.repeat(80));
  
  const conversionData = await db.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      SUM(total_views) as total_views,
      SUM(total_bids) as total_bids,
      SUM(total_wins) as total_wins
    FROM conversion_funnel_analytics
  `);
  
  console.log('Conversion funnel summary:');
  console.log(conversionData.rows[0]);
  
  if (Number(conversionData.rows[0]?.total_views || 0) === 0) {
    console.log('\n❌ No conversion funnel data - needs population');
  }

  // Issue 9: ML Datasets API
  console.log('\n\n🤖 ISSUE 9: ML DATASETS API');
  console.log('-'.repeat(80));
  
  const mlDatasets = await db.execute(sql`
    SELECT 
      dataset_type,
      COUNT(*) as count,
      MAX(created_at) as latest_created
    FROM ml_training_datasets
    GROUP BY dataset_type
  `);
  
  console.log('ML datasets by type:');
  console.log(mlDatasets.rows);
  
  if (mlDatasets.rows.length === 0) {
    console.log('\n❌ No ML datasets found');
  }
  
  console.log('\n💡 Check API route validation:');
  console.log('   File: src/app/api/intelligence/ml/datasets/route.ts');
  console.log('   Common 400 causes:');
  console.log('   - Invalid datasetType enum value');
  console.log('   - Invalid limit parameter');
  console.log('   - Missing required query params');

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SUMMARY OF ISSUES');
  console.log('='.repeat(80));
  
  const issues = [
    { id: 1, name: 'Sell-through rate display', status: 'NEEDS FIX' },
    { id: 2, name: 'React key prop warnings', status: 'NEEDS CODE REVIEW' },
    { id: 3, name: 'Make/model/brand display', status: 'NEEDS FIX' },
    { id: 4, name: 'Color/Trim/Storage empty', status: sampleAttributes.rows.length > 0 ? 'HAS DATA' : 'NEEDS POPULATION' },
    { id: 5, name: 'Unknown regions', status: unknownCount > 0 ? 'NEEDS FIX' : 'OK' },
    { id: 6, name: 'Vendor Segments NaN', status: vendorSegments.rows.length > 0 ? 'HAS DATA' : 'NEEDS POPULATION' },
    { id: 7, name: 'Session Analytics zeros', status: Number(sessionData.rows[0]?.total_sessions || 0) > 0 ? 'HAS DATA' : 'NOT IMPLEMENTED' },
    { id: 8, name: 'Conversion Funnel empty', status: Number(conversionData.rows[0]?.total_views || 0) > 0 ? 'HAS DATA' : 'NEEDS POPULATION' },
    { id: 9, name: 'ML Datasets 400 error', status: 'NEEDS API FIX' },
  ];
  
  issues.forEach(issue => {
    console.log(`${issue.id}. ${issue.name}: ${issue.status}`);
  });
  
  console.log('\n✅ Diagnostic complete!');
}

diagnoseAllIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });
