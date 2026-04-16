/**
 * Populate Vendor Segments Properly
 * 
 * Uses the BehavioralAnalyticsService to properly segment vendors
 * based on their actual bidding behavior
 */

import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { db } from '@/lib/db';
import { vendorSegments } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function populateVendorSegments() {
  console.log('='.repeat(60));
  console.log('POPULATE VENDOR SEGMENTS PROPERLY');
  console.log('='.repeat(60));

  // 1. Check current state
  console.log('\n📊 STEP 1: Check Current State');
  console.log('-'.repeat(60));
  
  const currentSegments = await db
    .select({
      segment: vendorSegments.activitySegment,
      count: sql<number>`COUNT(*)`,
    })
    .from(vendorSegments)
    .groupBy(vendorSegments.activitySegment)
    .orderBy(sql`COUNT(*) DESC`);

  console.log('Current segments:');
  currentSegments.forEach(s => {
    console.log(`   - ${s.segment || 'NULL'}: ${s.count} vendors`);
  });

  // 2. Run segmentation
  console.log('\n🔄 STEP 2: Run Vendor Segmentation');
  console.log('-'.repeat(60));
  console.log('Running BehavioralAnalyticsService.segmentVendors()...');
  
  const service = new BehavioralAnalyticsService();
  
  try {
    await service.segmentVendors();
    console.log('✅ Segmentation completed successfully');
  } catch (error) {
    console.error('❌ Segmentation failed:', error);
    throw error;
  }

  // 3. Check updated state
  console.log('\n📊 STEP 3: Check Updated State');
  console.log('-'.repeat(60));
  
  const updatedSegments = await db
    .select({
      segment: vendorSegments.activitySegment,
      count: sql<number>`COUNT(*)`,
    })
    .from(vendorSegments)
    .groupBy(vendorSegments.activitySegment)
    .orderBy(sql`COUNT(*) DESC`);

  console.log('Updated segments:');
  updatedSegments.forEach(s => {
    console.log(`   - ${s.segment || 'NULL'}: ${s.count} vendors`);
  });

  // 4. Show sample data
  console.log('\n📋 STEP 4: Sample Vendor Segments');
  console.log('-'.repeat(60));
  
  const samples = await db
    .select({
      vendorId: vendorSegments.vendorId,
      activitySegment: vendorSegments.activitySegment,
      priceSegment: vendorSegments.priceSegment,
      categorySegment: vendorSegments.categorySegment,
      bidsPerWeek: vendorSegments.bidsPerWeek,
      overallWinRate: vendorSegments.overallWinRate,
    })
    .from(vendorSegments)
    .limit(10);

  console.log('Sample vendor segments:');
  samples.forEach(s => {
    console.log(`   Vendor ${s.vendorId}:`);
    console.log(`     Activity: ${s.activitySegment}`);
    console.log(`     Price: ${s.priceSegment}`);
    console.log(`     Category: ${s.categorySegment}`);
    console.log(`     Bids/week: ${s.bidsPerWeek}`);
    console.log(`     Win rate: ${s.overallWinRate}`);
  });

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ Vendor segments populated based on actual bidding behavior');
  console.log('✅ Activity segments: active_bidder, regular_bidder, selective_bidder');
  console.log('✅ Pie chart component will now display proper distribution');
  console.log('\n📊 Expected segments in pie chart:');
  console.log('   - Active (from active_bidder, regular_bidder)');
  console.log('   - Occasional (from selective_bidder)');
  console.log('   - Inactive (from vendors with no recent bids)');
  
  console.log('\n' + '='.repeat(60));
}

populateVendorSegments()
  .then(() => {
    console.log('\n✅ Population completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Population failed:', error);
    process.exit(1);
  });
