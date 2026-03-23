/**
 * Direct SQL count of ALL vehicle data
 */

import 'dotenv/config';
import { client } from '@/lib/db/drizzle';

async function directSQLCount() {
  console.log('🔍 Direct SQL Query - Counting ALL Records\n');
  console.log('='.repeat(60));

  try {
    // Count vehicle valuations
    const valuationsResult = await client`
      SELECT COUNT(*) as count FROM vehicle_valuations
    `;
    console.log(`\n📊 Vehicle Valuations: ${valuationsResult[0].count}`);

    // Count by make
    const byMakeResult = await client`
      SELECT make, COUNT(*) as count 
      FROM vehicle_valuations 
      GROUP BY make 
      ORDER BY make
    `;
    
    console.log('\nBreakdown by Make:');
    for (const row of byMakeResult) {
      console.log(`   ${row.make}: ${row.count} records`);
    }

    // Count damage deductions
    const deductionsResult = await client`
      SELECT COUNT(*) as count FROM damage_deductions
    `;
    console.log(`\n🔧 Damage Deductions: ${deductionsResult[0].count}`);

    // Count deductions by make
    const deductionsByMakeResult = await client`
      SELECT make, COUNT(*) as count 
      FROM damage_deductions 
      GROUP BY make 
      ORDER BY make
    `;
    
    console.log('\nBreakdown by Make:');
    for (const row of deductionsByMakeResult) {
      console.log(`   ${row.make}: ${row.count} records`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Direct SQL query complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

directSQLCount();
