/**
 * Check Analytics Tables using Drizzle
 */

import { db } from '../src/lib/db/index';
import { sql } from 'drizzle-orm';

async function checkAnalyticsTables() {
  try {
    console.log('🔍 ANALYTICS DASHBOARD INVESTIGATION\n');
    console.log('='.repeat(80) + '\n');

    // 1. Check if tables exist
    console.log('📋 STEP 1: Checking if analytics tables exist...\n');
    
    const tables = [
      'asset_performance_analytics',
      'attribute_performance_analytics',
      'temporal_patterns_analytics',
      'geographic_patterns_analytics',
      'vendor_segments',
      'conversion_funnel_analytics',
      'session_analytics',
    ];

    const tableExistence: Record<string, boolean> = {};
    
    for (const table of tables) {
      try {
        const result: any = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          )
        `);
        
        const exists = result[0]?.exists ?? false;
        tableExistence[table] = exists;
        console.log(`   ${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
      } catch (error) {
        console.log(`   ❌ ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown'}`);
        tableExistence[table] = false;
      }
    }

    // 2. Check row counts
    console.log('\n📊 STEP 2: Checking row counts...\n');
    
    const counts: Record<string, number> = {};
    
    for (const table of tables) {
      if (tableExistence[table]) {
        try {
          const result: any = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
          const count = parseInt(result[0]?.count ?? '0');
          counts[table] = count;
          console.log(`   ${table}: ${count} rows`);
        } catch (error) {
          console.log(`   ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown'}`);
          counts[table] = 0;
        }
      } else {
        console.log(`   ${table}: TABLE DOES NOT EXIST`);
        counts[table] = 0;
      }
    }

    // 3. Check source data
    console.log('\n🏷️  STEP 3: Checking source data (auctions, bids, vendors)...\n');
    
    try {
      const auctionsResult: any = await db.execute(sql`SELECT COUNT(*) as count FROM "auctions"`);
      const auctionsCount = parseInt(auctionsResult[0]?.count ?? '0');
      console.log(`   Auctions: ${auctionsCount} rows`);

      const bidsResult: any = await db.execute(sql`SELECT COUNT(*) as count FROM "bids"`);
      const bidsCount = parseInt(bidsResult[0]?.count ?? '0');
      console.log(`   Bids: ${bidsCount} rows`);

      const vendorsResult: any = await db.execute(sql`SELECT COUNT(*) as count FROM "vendors"`);
      const vendorsCount = parseInt(vendorsResult[0]?.count ?? '0');
      console.log(`   Vendors: ${vendorsCount} rows`);

      if (auctionsCount === 0) {
        console.log('\n   ⚠️  WARNING: No auctions found!');
      }
      if (bidsCount === 0) {
        console.log('   ⚠️  WARNING: No bids found!');
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 4. Sample data from populated tables
    console.log('\n📝 STEP 4: Sampling data from analytics tables...\n');
    
    for (const table of tables) {
      if (tableExistence[table] && counts[table] > 0) {
        try {
          const result: any = await db.execute(sql.raw(`SELECT * FROM "${table}" LIMIT 1`));
          if (result && result.length > 0) {
            console.log(`   ✅ ${table} - Sample row found`);
            console.log(`      Keys: ${Object.keys(result[0]).join(', ')}`);
          }
        } catch (error) {
          console.log(`   ❌ ${table} - ERROR: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else if (tableExistence[table]) {
        console.log(`   ⚠️  ${table} - Table exists but is EMPTY`);
      } else {
        console.log(`   ❌ ${table} - Table DOES NOT EXIST`);
      }
    }

    // 5. Check date ranges
    console.log('\n📅 STEP 5: Checking date ranges in analytics tables...\n');
    
    const dateRangeTables = [
      'asset_performance_analytics',
      'attribute_performance_analytics',
      'temporal_patterns_analytics',
      'geographic_patterns_analytics',
      'conversion_funnel_analytics',
    ];

    for (const table of dateRangeTables) {
      if (tableExistence[table] && counts[table] > 0) {
        try {
          const result: any = await db.execute(sql.raw(`
            SELECT 
              MIN(period_start) as min_date,
              MAX(period_end) as max_date,
              COUNT(*) as count
            FROM "${table}"
          `));
          
          if (result && result.length > 0) {
            console.log(`   ${table}:`);
            console.log(`      Date range: ${result[0].min_date} to ${result[0].max_date}`);
            console.log(`      Records: ${result[0].count}`);
          }
        } catch (error) {
          console.log(`   ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else if (tableExistence[table]) {
        console.log(`   ${table}: EMPTY`);
      } else {
        console.log(`   ${table}: DOES NOT EXIST`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY\n');

    const allTablesExist = tables.every(t => tableExistence[t]);
    const allTablesHaveData = tables.every(t => tableExistence[t] && counts[table] > 0);

    if (!allTablesExist) {
      console.log('❌ ISSUE: Some analytics tables are MISSING');
      console.log('\nRECOMMENDED ACTION:');
      console.log('   Run migrations: npx drizzle-kit push\n');
    } else if (!allTablesHaveData) {
      console.log('⚠️  ISSUE: Analytics tables exist but are EMPTY');
      console.log('\nRECOMMENDED ACTIONS:');
      console.log('   1. Check if source data exists (auctions, bids)');
      console.log('   2. Run population script: npx tsx scripts/populate-intelligence-data-fixed.ts\n');
    } else {
      console.log('✅ All analytics tables exist and have data!');
      console.log('\nIf dashboard still shows "No data available":');
      console.log('   1. Check browser console for errors');
      console.log('   2. Check Network tab for API responses');
      console.log('   3. Verify date range filters match data in tables\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    process.exit(0);
  }
}

checkAnalyticsTables();
