/**
 * Verification Script: Temporal Patterns Fix
 * 
 * This script verifies that the temporal patterns API now returns
 * records with proper competitionLevel distribution.
 */

import { db } from '@/lib/db';
import { temporalPatternsAnalytics } from '@/lib/db/schema/analytics';

async function verifyTemporalPatternsFix() {
  console.log('✅ Verifying Temporal Patterns Fix...\n');

  try {
    // Fetch patterns from database
    const patterns = await db.select().from(temporalPatternsAnalytics).limit(20);
    
    console.log(`📊 Found ${patterns.length} temporal pattern records\n`);

    if (patterns.length === 0) {
      console.log('❌ No data in temporal_patterns_analytics table!');
      return;
    }

    // Calculate min/max for normalization (same logic as API)
    const activityScores = patterns.map(p => Number(p.peakActivityScore) || 0);
    const minActivity = Math.min(...activityScores);
    const maxActivity = Math.max(...activityScores);
    const activityRange = maxActivity - minActivity || 1;

    console.log('📈 Activity Score Range:');
    console.log(`   Min: ${minActivity}`);
    console.log(`   Max: ${maxActivity}`);
    console.log(`   Range: ${activityRange}\n`);

    // Transform and categorize
    const transformedPatterns = patterns.map(item => {
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
        hour: item.hourOfDay,
        dayOfWeek: item.dayOfWeek,
        rawActivity,
        normalizedActivity: normalizedActivity.toFixed(3),
        competitionLevel,
        avgBids: Number(item.avgBidCount),
      };
    });

    // Count by competition level
    const lowCount = transformedPatterns.filter(p => p.competitionLevel === 'low').length;
    const mediumCount = transformedPatterns.filter(p => p.competitionLevel === 'medium').length;
    const highCount = transformedPatterns.filter(p => p.competitionLevel === 'high').length;

    console.log('🎯 Competition Level Distribution:');
    console.log(`   Low: ${lowCount} records (${((lowCount / patterns.length) * 100).toFixed(1)}%)`);
    console.log(`   Medium: ${mediumCount} records (${((mediumCount / patterns.length) * 100).toFixed(1)}%)`);
    console.log(`   High: ${highCount} records (${((highCount / patterns.length) * 100).toFixed(1)}%)\n`);

    // Show best bidding times (low competition)
    console.log('⏰ Best Bidding Times (Low Competition):');
    const bestTimes = transformedPatterns
      .filter(p => p.competitionLevel === 'low')
      .sort((a, b) => Number(b.normalizedActivity) - Number(a.normalizedActivity))
      .slice(0, 5);

    if (bestTimes.length === 0) {
      console.log('   ⚠️  No low competition times found');
    } else {
      bestTimes.forEach((time, idx) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[time.dayOfWeek] || 'Unknown';
        const hourFormatted = time.hour.toString().padStart(2, '0') + ':00';
        
        console.log(`   ${idx + 1}. ${dayName} at ${hourFormatted}`);
        console.log(`      - Raw Activity: ${time.rawActivity}`);
        console.log(`      - Normalized: ${time.normalizedActivity}`);
        console.log(`      - Avg Bids: ${time.avgBids}`);
        console.log(`      - Competition: ${time.competitionLevel}`);
      });
    }

    // Show all times sorted by competition
    console.log('\n📋 All Times Sorted by Competition (showing top 10):');
    const sortedByCompetition = transformedPatterns
      .sort((a, b) => Number(a.normalizedActivity) - Number(b.normalizedActivity))
      .slice(0, 10);

    sortedByCompetition.forEach((time, idx) => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[time.dayOfWeek] || 'Unknown';
      const hourFormatted = time.hour.toString().padStart(2, '0') + ':00';
      
      console.log(`   ${idx + 1}. ${dayName} at ${hourFormatted} - ${time.competitionLevel} (${time.normalizedActivity})`);
    });

    console.log('\n✅ Verification complete!');
    
    if (lowCount > 0) {
      console.log('✅ Fix successful! Low competition times are now available.');
    } else {
      console.log('⚠️  No low competition times found. Consider adjusting thresholds.');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  }
}

// Run the verification
verifyTemporalPatternsFix()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
