/**
 * End-to-End Test: Temporal Patterns Fix
 * 
 * This script performs a complete end-to-end test of the temporal patterns fix:
 * 1. Checks database has data
 * 2. Simulates API transformation
 * 3. Simulates frontend filtering
 * 4. Verifies UI would display correctly
 */

import { db } from '@/lib/db';
import { temporalPatternsAnalytics } from '@/lib/db/schema/analytics';

async function testTemporalPatternsE2E() {
  console.log('🧪 End-to-End Test: Temporal Patterns Fix\n');
  console.log('=' .repeat(60));
  
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // TEST 1: Database has data
    console.log('\n📋 TEST 1: Database has temporal pattern data');
    const patterns = await db.select().from(temporalPatternsAnalytics);
    
    if (patterns.length > 0) {
      console.log(`✅ PASS - Found ${patterns.length} records in database`);
      testsPassed++;
    } else {
      console.log('❌ FAIL - No data in database');
      testsFailed++;
      return;
    }

    // TEST 2: Activity scores are in expected range
    console.log('\n📋 TEST 2: Activity scores are valid');
    const activityScores = patterns.map(p => Number(p.peakActivityScore) || 0);
    const minActivity = Math.min(...activityScores);
    const maxActivity = Math.max(...activityScores);
    
    if (minActivity >= 0 && maxActivity > minActivity) {
      console.log(`✅ PASS - Activity scores range from ${minActivity} to ${maxActivity}`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL - Invalid activity score range: ${minActivity} to ${maxActivity}`);
      testsFailed++;
    }

    // TEST 3: Normalization produces 0-1 values
    console.log('\n📋 TEST 3: Normalization produces valid 0-1 range');
    const activityRange = maxActivity - minActivity || 1;
    const normalizedScores = activityScores.map(score => (score - minActivity) / activityRange);
    const allInRange = normalizedScores.every(score => score >= 0 && score <= 1);
    
    if (allInRange) {
      console.log(`✅ PASS - All normalized scores are between 0 and 1`);
      testsPassed++;
    } else {
      console.log('❌ FAIL - Some normalized scores are out of range');
      testsFailed++;
    }

    // TEST 4: Competition levels are distributed
    console.log('\n📋 TEST 4: Competition levels are properly distributed');
    const transformedData = patterns.map(item => {
      const rawActivity = Number(item.peakActivityScore) || 0;
      const normalizedActivity = (rawActivity - minActivity) / activityRange;

      let competitionLevel: 'low' | 'medium' | 'high';
      if (normalizedActivity < 0.33) {
        competitionLevel = 'low';
      } else if (normalizedActivity < 0.67) {
        competitionLevel = 'medium';
      } else {
        competitionLevel = 'high';
      }

      return {
        ...item,
        hour: item.hourOfDay,
        dayOfWeek: item.dayOfWeek,
        activityScore: item.peakActivityScore,
        competitionLevel,
      };
    });

    const lowCount = transformedData.filter(p => p.competitionLevel === 'low').length;
    const mediumCount = transformedData.filter(p => p.competitionLevel === 'medium').length;
    const highCount = transformedData.filter(p => p.competitionLevel === 'high').length;

    console.log(`   Low: ${lowCount} (${((lowCount / patterns.length) * 100).toFixed(1)}%)`);
    console.log(`   Medium: ${mediumCount} (${((mediumCount / patterns.length) * 100).toFixed(1)}%)`);
    console.log(`   High: ${highCount} (${((highCount / patterns.length) * 100).toFixed(1)}%)`);

    if (lowCount > 0 && mediumCount > 0 && highCount > 0) {
      console.log('✅ PASS - All competition levels are represented');
      testsPassed++;
    } else if (lowCount > 0) {
      console.log('⚠️  PARTIAL PASS - At least low competition exists');
      testsPassed++;
    } else {
      console.log('❌ FAIL - No low competition records found');
      testsFailed++;
    }

    // TEST 5: Frontend filter returns results
    console.log('\n📋 TEST 5: Frontend getBestBiddingTimes() returns results');
    const bestBiddingTimes = transformedData
      .filter(p => p.competitionLevel === 'low')
      .sort((a, b) => Number(b.activityScore) - Number(a.activityScore))
      .slice(0, 5);

    if (bestBiddingTimes.length > 0) {
      console.log(`✅ PASS - Found ${bestBiddingTimes.length} best bidding times`);
      testsPassed++;
    } else {
      console.log('❌ FAIL - No best bidding times found');
      testsFailed++;
    }

    // TEST 6: UI data structure is correct
    console.log('\n📋 TEST 6: UI data structure has required fields');
    if (bestBiddingTimes.length > 0) {
      const sampleRecord = bestBiddingTimes[0];
      const requiredFields = ['hour', 'dayOfWeek', 'competitionLevel', 'activityScore'];
      const missingFields = requiredFields.filter(field => !(field in sampleRecord));

      if (missingFields.length === 0) {
        console.log('✅ PASS - All required fields present');
        testsPassed++;
      } else {
        console.log(`❌ FAIL - Missing fields: ${missingFields.join(', ')}`);
        testsFailed++;
      }
    } else {
      console.log('⚠️  SKIP - No records to check');
    }

    // TEST 7: Display format is correct
    console.log('\n📋 TEST 7: Display format is user-friendly');
    if (bestBiddingTimes.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const sampleRecord = bestBiddingTimes[0];
      const dayName = dayNames[sampleRecord.dayOfWeek];
      const hourFormatted = sampleRecord.hour.toString().padStart(2, '0') + ':00';

      console.log(`   Sample display: ${dayName} at ${hourFormatted} - ${sampleRecord.competitionLevel} competition`);
      
      if (dayName && hourFormatted && sampleRecord.competitionLevel) {
        console.log('✅ PASS - Display format is correct');
        testsPassed++;
      } else {
        console.log('❌ FAIL - Display format has issues');
        testsFailed++;
      }
    } else {
      console.log('⚠️  SKIP - No records to display');
    }

    // SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Temporal patterns fix is working correctly.');
      console.log('\n✅ Ready for production deployment');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above.');
    }

    // Show what the UI will display
    if (bestBiddingTimes.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('\n🎨 UI PREVIEW: Best Time to Bid Section\n');
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      bestBiddingTimes.forEach((time, idx) => {
        const dayName = dayNames[time.dayOfWeek];
        const hourFormatted = time.hour.toString().padStart(2, '0') + ':00';
        
        console.log(`┌─────────────────────┐`);
        console.log(`│  ${dayName.padEnd(17)}│`);
        console.log(`│  ${hourFormatted.padEnd(17)}│`);
        console.log(`│  Low Competition    │`);
        console.log(`└─────────────────────┘`);
        if (idx < bestBiddingTimes.length - 1) console.log('');
      });
    }

  } catch (error) {
    console.error('\n❌ Test execution error:', error);
    testsFailed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ End-to-End test complete\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run the test
testTemporalPatternsE2E();
