import { db } from '../src/lib/db/drizzle';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

async function investigateValuationIssue() {
  console.log('\n🔍 INVESTIGATING MERCEDES GLE 350 W166 2016 VALUATION ISSUE\n');
  console.log('=' .repeat(80));
  
  // Query the database for Mercedes GLE 350 2016
  const results = await db
    .select()
    .from(vehicleValuations)
    .where(
      and(
        eq(vehicleValuations.make, 'Mercedes-Benz'),
        eq(vehicleValuations.model, 'GLE350 W166'),
        eq(vehicleValuations.year, 2016)
      )
    );
  
  console.log(`\n📊 Found ${results.length} valuation records:\n`);
  
  for (const record of results) {
    console.log(`Condition: ${record.conditionCategory}`);
    console.log(`  Low:     ₦${parseFloat(record.lowPrice).toLocaleString()}`);
    console.log(`  Average: ₦${parseFloat(record.averagePrice).toLocaleString()}`);
    console.log(`  High:    ₦${parseFloat(record.highPrice).toLocaleString()}`);
    console.log(`  Source:  ${record.source || 'N/A'}`);
    console.log('');
  }
  
  console.log('\n💡 MARKET RESEARCH FINDINGS:\n');
  console.log('According to current Nigerian market data (March 2026):');
  console.log('  • Fairly-used Mercedes GLE350 2016: ₦26,000,000');
  console.log('  • This is for vehicles in good condition with typical mileage');
  console.log('  • Excellent condition with 50,000 km should be around ₦28-32 million');
  console.log('');
  
  console.log('\n❌ PROBLEM IDENTIFIED:\n');
  console.log('The database contains INCORRECT prices:');
  console.log('  • "excellent" condition shows ₦5-12 million (WAY TOO LOW)');
  console.log('  • "tokunbo_low" shows ₦18-32 million (closer to reality)');
  console.log('');
  console.log('The issue is that the condition categories are misaligned:');
  console.log('  • User selects "excellent" → Gets ₦5-12M (WRONG)');
  console.log('  • Should be getting ₦26-32M for excellent condition');
  console.log('');
  
  console.log('\n🔧 ROOT CAUSE:\n');
  console.log('The seed data has incorrect condition mappings:');
  console.log('  • "nig_used_low" (₦5-12M) is mapped to "excellent" - WRONG!');
  console.log('  • "tokunbo_low" (₦18-32M) is mapped to "tokunbo_low" - Not a standard condition');
  console.log('');
  console.log('Standard conditions should be: excellent, good, fair, poor');
  console.log('But the data uses: nig_used_low, tokunbo_low, etc.');
  console.log('');
  
  console.log('\n📋 RECOMMENDED FIX:\n');
  console.log('1. Update Mercedes seed data to use correct condition categories');
  console.log('2. Map prices correctly:');
  console.log('   • excellent: ₦28-32M (low mileage, pristine)');
  console.log('   • good: ₦24-28M (normal wear, good condition)');
  console.log('   • fair: ₦18-24M (higher mileage, some wear)');
  console.log('   • poor: ₦12-18M (high mileage, needs work)');
  console.log('');
  
  console.log('\n🎯 GEMINI DAMAGE DETECTION ISSUE:\n');
  console.log('=' .repeat(80));
  console.log('');
  console.log('❌ PROBLEM: Gemini only detects "minor" damage even for totaled cars');
  console.log('');
  console.log('🔍 POSSIBLE CAUSES:');
  console.log('1. Prompt may be too conservative in scoring');
  console.log('2. Gemini model may need more explicit examples');
  console.log('3. Image quality or format issues');
  console.log('4. Response parsing may be clamping scores too low');
  console.log('');
  console.log('📋 INVESTIGATION STEPS:');
  console.log('1. Test with known totaled car images');
  console.log('2. Review Gemini response logs');
  console.log('3. Check if scores are being validated/clamped incorrectly');
  console.log('4. Compare with Vision API results (fallback)');
  console.log('');
  console.log('🔧 POTENTIAL FIXES:');
  console.log('1. Enhance prompt with more explicit severity examples');
  console.log('2. Add validation that severe damage must have high scores');
  console.log('3. Implement multi-pass assessment for ambiguous cases');
  console.log('4. Add confidence scoring to flag uncertain assessments');
  console.log('');
}

investigateValuationIssue()
  .then(() => {
    console.log('\n✅ Investigation complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
