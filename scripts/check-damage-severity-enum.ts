/**
 * Check damage_severity enum values
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkEnum() {
  console.log('🔍 Checking damage_severity enum...\n');

  try {
    // Try a simple test insert to see if 'none' is accepted
    console.log('Testing if "none" is accepted by the enum...');
    
    const testQuery = sql`
      SELECT 'none'::damage_severity as test_value;
    `;
    
    const result = await db.execute(testQuery);
    console.log('✅ "none" is accepted by the damage_severity enum!');
    console.log('   Result:', result);

  } catch (error: any) {
    if (error.message?.includes('invalid input value for enum')) {
      console.log('❌ "none" is NOT accepted by the damage_severity enum');
      console.log('   The migration may not have run successfully');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

checkEnum()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
