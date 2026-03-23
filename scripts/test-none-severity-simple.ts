/**
 * Simple test for 'none' damage severity enum value
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function testNoneSeverity() {
  console.log('🧪 Testing "none" damage severity enum value');
  console.log('================================================\n');

  try {
    // Test 1: Check if 'none' is a valid enum value
    console.log('1️⃣ Testing if "none" is accepted by damage_severity enum...');
    const test1 = await db.execute(sql`SELECT 'none'::damage_severity as severity;`);
    console.log('✅ "none" is accepted!');
    console.log('   Result:', test1[0]);

    // Test 2: Check all enum values
    console.log('\n2️⃣ Checking all damage_severity enum values...');
    const test2 = await db.execute(sql`
      SELECT unnest(enum_range(NULL::damage_severity)) as severity;
    `);
    console.log('✅ All enum values:');
    test2.forEach((row: any) => {
      console.log(`   - ${row.severity}`);
    });

    // Test 3: Verify the order
    console.log('\n3️⃣ Verifying enum includes all expected values...');
    const expectedValues = ['minor', 'moderate', 'severe', 'none'];
    const actualValues = test2.map((row: any) => row.severity);
    
    const hasAllValues = expectedValues.every(val => actualValues.includes(val));
    if (hasAllValues) {
      console.log('✅ All expected values are present');
    } else {
      const missing = expectedValues.filter(val => !actualValues.includes(val));
      console.log('❌ Missing values:', missing);
    }

    console.log('\n✅ Test completed successfully!');
    console.log('   The damage_severity enum now includes "none"');
    console.log('   Pristine items can be submitted with severity: "none"');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
testNoneSeverity()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
