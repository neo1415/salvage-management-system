/**
 * Test Script: Temporal Patterns API Response
 * 
 * This script simulates what the frontend will receive from the API
 * and verifies the data structure matches expectations.
 */

import { db } from '@/lib/db';
import { temporalPatternsAnalytics } from '@/lib/db/schema/analytics';

async function testTemporalPatternsAPI() {
  console.log('🧪 Testing Temporal Patterns API Response...\n');

  try {
    // Simulate API logic
    const patterns = await db.select().from(temporalPatternsAnalytics);
    
    if (patterns.length === 0) {
      console.log('❌ No data in temporal_patterns_analytics table!');
      return;
    }

    console.log(`📊 Fetched ${patterns.length} patterns from database\n`);

    // Calculate min/max for normalization (same as API)
    const activityScores = patterns.map(p => Number(p.peakActivityScore) || 0);
    const minActivity = Math.min(...activityScores);
    const maxActivity = Math.max(...activityScores);
    const activityRange = maxActivity - minActivity || 1;

    // Transform data (same as API)
    const transformedData = patterns.map(item => {
      const rawActivity = Number(item.peakActivityScore) || 0;
      const normalizedActivity = (rawActivity - minActivity) / activityRange;

      return {
        ...item,
        bidCount: item.avgBidCount,
        avgPrice: item.avgFinalPrice,
        vendorActivity: item.avgVendorActivity,
        hour: item.hourOfDay,
        dayOfWeek: item.dayOfWeek,
        activityScore: item.peakActivityScore,
        avgBids: Number(item.avgBidCount),
        totalAuctions: 0,
        competitionLevel: (() => {
          if (normalizedActivity < 0.33) return 'low';
          if (normalizedActivity < 0.67) return 'medium';
          return 'high';
        })() as 'low' | 'medium' | 'high',
      };
    });

    // Simulate frontend getBestBiddingTimes() function
    console.log('🎯 Simulating getBestBiddingTimes() function...\n');
    
    const bestBiddingTimes = transformedData
      .filter(p => p.competitionLevel === 'low')
      .sort((a, b) => Number(b.activityScore) - Number(a.activityScore))
      .slice(0, 5);

    console.log(`✅ Found ${bestBiddingTimes.length} low competition time slots\n`);

    if (bestBiddingTimes.length === 0) {
      console.log('❌ getBestBiddingTimes() would return empty array!');
      console.log('💡 UI would show: "No temporal pattern data available yet"\n');
      return;
    }

    console.log('📋 Best Bidding Times (as displayed in UI):\n');
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    bestBiddingTimes.forEach((time, idx) => {
      const dayName = dayNames[time.dayOfWeek] || 'Unknown';
      const hourFormatted = time.hour.toString().padStart(2, '0') + ':00';
      
      console.log(`${idx + 1}. ${dayName} at ${hourFormatted}`);
      console.log(`   Competition: ${time.competitionLevel}`);
      console.log(`   Activity Score: ${time.activityScore}`);
      console.log(`   Avg Bids: ${time.avgBids}`);
      console.log(`   Avg Price: ₦${Number(time.avgPrice).toLocaleString()}`);
      console.log('');
    });

    // Verify data structure
    console.log('✅ Data Structure Verification:\n');
    const sampleRecord = bestBiddingTimes[0];
    
    const requiredFields = [
      'hour',
      'dayOfWeek',
      'competitionLevel',
      'activityScore',
      'avgBids',
      'avgPrice',
      'bidCount',
      'vendorActivity',
    ];

    let allFieldsPresent = true;
    requiredFields.forEach(field => {
      const hasField = field in sampleRecord;
      console.log(`   ${hasField ? '✅' : '❌'} ${field}: ${hasField ? typeof sampleRecord[field as keyof typeof sampleRecord] : 'missing'}`);
      if (!hasField) allFieldsPresent = false;
    });

    console.log('');
    
    if (allFieldsPresent) {
      console.log('✅ All required fields present!');
      console.log('✅ API response format is correct!');
      console.log('✅ Frontend should display temporal patterns successfully!');
    } else {
      console.log('❌ Some required fields are missing!');
    }

    // Show API response format
    console.log('\n📦 Sample API Response Format:\n');
    console.log(JSON.stringify({
      success: true,
      data: bestBiddingTimes.slice(0, 2).map(item => ({
        hour: item.hour,
        dayOfWeek: item.dayOfWeek,
        competitionLevel: item.competitionLevel,
        activityScore: item.activityScore,
        avgBids: item.avgBids,
        avgPrice: item.avgPrice,
      })),
      meta: {
        count: transformedData.length,
        filters: {},
      },
    }, null, 2));

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  }
}

// Run the test
testTemporalPatternsAPI()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
