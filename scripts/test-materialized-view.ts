/**
 * Test materialized view creation
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    console.log('Testing materialized view creation...\n');
    
    // Test if the issue is with ARRAY_AGG
    const testQuery = sql`
      SELECT 
        ARRAY_AGG(DISTINCT asset_details->>'make')
        FILTER (WHERE asset_details->>'make' IS NOT NULL)
        [1:5] AS top_makes
      FROM salvage_cases
      LIMIT 1
    `;
    
    const result = await db.execute(testQuery);
    console.log('Test result:', result);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
