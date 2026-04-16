/**
 * Diagnostic Script: Temporal Patterns Competition Level Analysis
 * 
 * This script checks:
 * 1. What temporal pattern data exists in the database
 * 2. What competitionLevel values are being calculated
 * 3. Why getBestBiddingTimes() returns no results
 */

import { db } from '@/lib/db';
import { temporalPatternsAnalytics } from '@/lib/db/schema/analytics';
import { sql } from 'drizzle-orm';

async function diagnoseTemporalPatterns() {
  console.log('🔍 Diagnosing Temporal Patterns Issue...\n');

  try {
    // 1. Check if temporal_patterns_analytics table has data
    console.log('1️⃣ Checking temporal_patterns_analytics table...');
    const allPatterns = await db.select().from(temporalPatternsAnalytics).limit(10);
    
    console.log(`   Found ${allPatterns.length} records (showing first 10)`);
    
    if (allPatterns.length === 0) {
      console.log('   ❌ No data in temporal_patterns_analytics table!');
      console.log('   💡 Need to run population script first\n');
      return;
    }

    console.log('\n   Sample records:');
    allPatterns.forEach((pattern, idx) => {
      console.log(`   ${idx + 1}. Hour: ${pattern.hourOfDay}, Day: ${pattern.dayOfWeek}`);
      console.log(`      - peakActivityScore: ${pattern.peakActivityScore}`);
      console.log(`      - avgBidCount: ${pattern.avgBidCount}`);
      console.log(`      - avgVendorActivity: ${pattern.avgVendorActivity}`);
      console.log(`      - avgFinalPrice: ${pattern.avgFinalPrice}`);
    });

    // 2. Calculate competitionLevel for each record
    console.log('\n2️⃣ Calculating competitionLevel for each record...');
    const patternsWithCompetition = allPatterns.map(pattern => {
      const activity = Number(pattern.peakActivityScore) || 0;
      let competitionLevel: 'low' | 'medium' | 'high';
      
      if (activity < 0.3) {
        competitionLevel = 'low';
      } else if (activity < 0.7) {
        competitionLevel = 'medium';
      } else {
        competitionLevel = 'high';
      }

      return {
        hour: pattern.hourOfDay,
        day: pattern.dayOfWeek,
        activityScore: activity,
        competitionLevel,
      };
    });

    console.log('\n   Competition Level Distribution:');
    const lowCount = patternsWithCompetition.filter(p => p.competitionLevel === 'low').length;
    const mediumCount = patternsWithCompetition.filter(p => p.competitionLevel === 'medium').length;
    const highCount = patternsWithCompetition.filter(p => p.competitionLevel === 'high').length;

    console.log(`   - Low: ${lowCount} records`);
    console.log(`   - Medium: ${mediumCount} records`);
    console.log(`   - High: ${highCount} records`);

    // 3. Show records that would be filtered by getBestBiddingTimes()
    console.log('\n3️⃣ Records that pass competitionLevel === "low" filter:');
    const lowCompetitionPatterns = patternsWithCompetition.filter(p => p.competitionLevel === 'low');
    
    if (lowCompetitionPatterns.length === 0) {
      console.log('   ❌ NO RECORDS with competitionLevel === "low"!');
      console.log('   💡 This is why "No temporal pattern data available yet" shows in UI\n');
    } else {
      lowCompetitionPatterns.forEach((pattern, idx) => {
        console.log(`   ${idx + 1}. Hour: ${pattern.hour}, Day: ${pattern.day}`);
        console.log(`      - activityScore: ${pattern.activityScore}`);
        console.log(`      - competitionLevel: ${pattern.competitionLevel}`);
      });
    }

    // 4. Show activity score statistics
    console.log('\n4️⃣ Activity Score Statistics:');
    const activityScores = allPatterns.map(p => Number(p.peakActivityScore) || 0);
    const minScore = Math.min(...activityScores);
    const maxScore = Math.max(...activityScores);
    const avgScore = activityScores.reduce((a, b) => a + b, 0) / activityScores.length;

    console.log(`   - Min: ${minScore.toFixed(4)}`);
    console.log(`   - Max: ${maxScore.toFixed(4)}`);
    console.log(`   - Avg: ${avgScore.toFixed(4)}`);
    console.log(`   - Threshold for "low": < 0.3`);
    console.log(`   - Threshold for "medium": 0.3 - 0.7`);
    console.log(`   - Threshold for "high": >= 0.7`);

    // 5. Recommendation
    console.log('\n5️⃣ Recommendation:');
    if (lowCount === 0) {
      console.log('   ⚠️  No records with competitionLevel === "low"');
      console.log('   📝 Options to fix:');
      console.log('      A. Adjust threshold in API (e.g., < 0.5 for low)');
      console.log('      B. Change getBestBiddingTimes() to show all patterns sorted by competition');
      console.log('      C. Show medium competition times if no low competition exists');
      console.log('      D. Recalculate peakActivityScore in population script');
    } else {
      console.log('   ✅ Found low competition records');
      console.log('   💡 Issue might be in frontend filtering or data fetching');
    }

    console.log('\n✅ Diagnosis complete!\n');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Run the diagnostic
diagnoseTemporalPatterns()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
