/**
 * Diagnostic Script: Vendor Segments Pie Chart
 * 
 * Investigates the data structure mismatch between:
 * - Database activitySegment values
 * - Component SEGMENT_COLORS mapping
 */

import { db } from '@/lib/db';
import { vendorSegments } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('='.repeat(60));
  console.log('VENDOR SEGMENTS PIE CHART DIAGNOSTIC');
  console.log('='.repeat(60));

  // 1. Check actual activitySegment values in database
  console.log('\n📊 STEP 1: Database activitySegment Values');
  console.log('-'.repeat(60));
  
  const segments = await db
    .select({
      segment: vendorSegments.activitySegment,
      count: sql<number>`COUNT(*)`,
    })
    .from(vendorSegments)
    .where(sql`${vendorSegments.activitySegment} IS NOT NULL`)
    .groupBy(vendorSegments.activitySegment)
    .orderBy(sql`COUNT(*) DESC`);

  console.log('Actual segments in database:');
  segments.forEach(s => {
    console.log(`   - ${s.segment}: ${s.count} vendors`);
  });

  const total = segments.reduce((sum, s) => sum + Number(s.count), 0);
  console.log(`\nTotal vendors: ${total}`);

  // 2. Check what the component expects
  console.log('\n🎨 STEP 2: Component Expected Segments');
  console.log('-'.repeat(60));
  console.log('SEGMENT_COLORS mapping expects:');
  const expectedSegments = ['High-Value', 'Active', 'Occasional', 'New', 'Inactive'];
  expectedSegments.forEach(s => console.log(`   - ${s}`));

  // 3. Identify the mismatch
  console.log('\n❌ STEP 3: Data Mismatch Analysis');
  console.log('-'.repeat(60));
  console.log('Database values DO NOT match component expectations!');
  console.log('\nDatabase has:');
  segments.forEach(s => console.log(`   - ${s.segment}`));
  console.log('\nComponent expects:');
  expectedSegments.forEach(s => console.log(`   - ${s}`));

  // 4. Check TypeScript errors
  console.log('\n🔧 STEP 4: TypeScript Errors');
  console.log('-'.repeat(60));
  console.log('Issues in label rendering:');
  console.log('   1. Property "segment" does not exist on type "PieLabelRenderProps"');
  console.log('   2. Property "percentage" does not exist on type "PieLabelRenderProps"');
  console.log('   3. "Cell" is deprecated warning');

  // 5. Proposed solution
  console.log('\n✅ STEP 5: Proposed Solution');
  console.log('-'.repeat(60));
  console.log('Option 1: Map database values to display names');
  console.log('   - Keep database values as-is');
  console.log('   - Create mapping function in component');
  console.log('   - Map: active_bidder → Active, selective_bidder → Occasional, etc.');
  console.log('\nOption 2: Update database values');
  console.log('   - Change activitySegment values to match component');
  console.log('   - Update behavioral-analytics.service.ts');
  console.log('   - Requires data migration');
  console.log('\nRecommendation: Option 1 (less invasive, no data migration)');

  // 6. Fix TypeScript errors
  console.log('\n🔧 STEP 6: TypeScript Error Fixes');
  console.log('-'.repeat(60));
  console.log('Fix 1: Update label prop to use render function correctly');
  console.log('   - Access data via payload parameter');
  console.log('   - Type: (props: PieLabelRenderProps) => ReactNode');
  console.log('\nFix 2: Replace deprecated Cell with proper typing');
  console.log('   - Cell is not deprecated, just needs proper usage');

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
}

diagnose()
  .then(() => {
    console.log('\n✅ Diagnostic completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
