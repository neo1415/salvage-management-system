/**
 * Check all tables in the database
 */

import 'dotenv/config';
import { client } from '@/lib/db/drizzle';

async function checkTables() {
  console.log('🔍 Checking All Database Tables\n');

  try {
    // List all tables
    const tablesResult = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log('📋 All Tables in Database:');
    console.log('='.repeat(60));
    for (const row of tablesResult) {
      console.log(`   - ${row.table_name}`);
    }

    // Check if there are any other valuation-related tables
    console.log('\n🔍 Searching for valuation-related tables...');
    const valuationTables = tablesResult.filter((row: any) => 
      row.table_name.toLowerCase().includes('valuation') ||
      row.table_name.toLowerCase().includes('vehicle') ||
      row.table_name.toLowerCase().includes('price')
    );

    if (valuationTables.length > 0) {
      console.log('\nFound valuation-related tables:');
      for (const row of valuationTables) {
        const countResult = await client`
          SELECT COUNT(*) as count FROM ${client(row.table_name)}
        `;
        console.log(`   ${row.table_name}: ${countResult[0].count} records`);
      }
    }

    console.log('\n✅ Check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTables();
