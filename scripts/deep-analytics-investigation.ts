/**
 * Deep Analytics Dashboard Investigation
 * 
 * Comprehensive diagnostic script to investigate why the Analytics Dashboard
 * shows "No data available" even after fixing validation issues.
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function investigateAnalyticsDashboard() {
  console.log('🔍 DEEP ANALYTICS DASHBOARD INVESTIGATION\n');
  console.log('=' .repeat(80));
  
  try {
    // 1. Check if analytics tables exist
    console.log('\n📋 STEP 1: Checking if analytics tables exist...\n');
    
    const tables = [
      'asset_performance_analytics',
      'attribute_performance_analytics',
      'temporal_patterns_analytics',
      'geographic_patterns_analytics',
      'vendor_segments',
      'conversion_funnel_analytics',
      'session_analytics',
    ];
    
    for (const table of tables) {
      try {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          ) as exists
        `);
        
        const exists = result.rows[0]?.exists;
        console.log(`   ${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
      } catch (error) {
        console.log(`   ❌ ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 2. Check row counts in each table
    console.log('\n📊 STEP 2: Checking row counts in analytics tables...\n');
    
    for (const table of tables) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
        const count = result.rows[0]?.count || 0;
        console.log(`   ${table}: ${count} rows`);
      } catch (error) {
        console.log(`   ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 3. Check if there's any auction data (source for analytics)
    console.log('\n🏷️  STEP 3: Checking source data (auctions, bids, etc.)...\n');
    
    try {
      const auctionsResult = await db.execute(sql`SELECT COUNT(*) as count FROM "auctions"`);
      const auctionsCount = auctionsResult.rows[0]?.count || 0;
      console.log(`   Auctions: ${auctionsCount} rows`);
      
      const bidsResult = await db.execute(sql`SELECT COUNT(*) as count FROM "bids"`);
      const bidsCount = bidsResult.rows[0]?.count || 0;
      console.log(`   Bids: ${bidsCount} rows`);
      
      const vendorsResult = await db.execute(sql`SELECT COUNT(*) as count FROM "vendors"`);
      const vendorsCount = vendorsResult.rows[0]?.count || 0;
      console.log(`   Vendors: ${vendorsCount} rows`);
      
      if (auctionsCount === 0) {
        console.log('\n   ⚠️  WARNING: No auctions found! Analytics tables need auction data to populate.');
      }
      
      if (bidsCount === 0) {
        console.log('   ⚠️  WARNING: No bids found! Many analytics metrics require bid data.');
      }
    } catch (error) {
      console.log(`   ERROR checking source data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // 4. Sample data from analytics tables (if any)
    console.log('\n📝 STEP 4: Sampling data from analytics tables...\n');
    
    for (const table of tables) {
      try {
        const result = await db.execute(sql.raw(`SELECT * FROM "${table}" LIMIT 1`));
        if (result.rows.length > 0) {
          console.log(`   ✅ ${table} - Sample row:`);
          console.log(`      ${JSON.stringify(result.rows[0], null, 2).split('\n').join('\n      ')}`);
        } else {
          console.log(`   ⚠️  ${table} - No data`);
        }
      } catch (error) {
        console.log(`   ❌ ${table} - ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 5. Check date ranges in analytics tables
    console.log('\n📅 STEP 5: Checking date ranges in analytics tables...\n');
    
    const dateRangeTables = [
      'asset_performance_analytics',
      'attribute_performance_analytics',
      'temporal_patterns_analytics',
      'geographic_patterns_analytics',
      'conversion_funnel_analytics',
    ];
    
    for (const table of dateRangeTables) {
      try {
        const result = await db.execute(sql.raw(`
          SELECT 
            MIN(period_start) as min_date,
            MAX(period_end) as max_date,
            COUNT(*) as count
          FROM "${table}"
        `));
        
        if (result.rows.length > 0 && result.rows[0].count > 0) {
          console.log(`   ${table}:`);
          console.log(`      Date range: ${result.rows[0].min_date} to ${result.rows[0].max_date}`);
          console.log(`      Records: ${result.rows[0].count}`);
        } else {
          console.log(`   ${table}: No data`);
        }
      } catch (error) {
        console.log(`   ${table}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 6. Check if materialized views exist and have data
    console.log('\n🔄 STEP 6: Checking materialized views...\n');
    
    const materializedViews = [
      'vendor_performance_summary',
      'asset_performance_summary',
      'market_trends_summary',
    ];
    
    for (const view of materializedViews) {
      try {
        const existsResult = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM pg_matviews 
            WHERE schemaname = 'public' 
            AND matviewname = ${view}
          ) as exists
        `);
        
        const exists = existsResult.rows[0]?.exists;
        
        if (exists) {
          const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${view}"`));
          const count = countResult.rows[0]?.count || 0;
          console.log(`   ✅ ${view}: EXISTS (${count} rows)`);
        } else {
          console.log(`   ❌ ${view}: DOES NOT EXIST`);
        }
      } catch (error) {
        console.log(`   ❌ ${view}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 7. Test a simple analytics query
    console.log('\n🧪 STEP 7: Testing a simple analytics query...\n');
    
    try {
      const testResult = await db.execute(sql`
        SELECT 
          asset_type,
          make,
          model,
          COUNT(*) as count
        FROM "asset_performance_analytics"
        GROUP BY asset_type, make, model
        LIMIT 5
      `);
      
      if (testResult.rows.length > 0) {
        console.log('   ✅ Query successful! Sample results:');
        testResult.rows.forEach((row, i) => {
          console.log(`      ${i + 1}. ${row.asset_type} ${row.make} ${row.model} (${row.count} records)`);
        });
      } else {
        console.log('   ⚠️  Query successful but returned no results');
      }
    } catch (error) {
      console.log(`   ❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // 8. Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY AND RECOMMENDATIONS\n');
    
    // Check if we need to populate data
    let needsPopulation = false;
    for (const table of tables) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
        const count = result.rows[0]?.count || 0;
        if (count === 0) {
          needsPopulation = true;
          break;
        }
      } catch (error) {
        // Table might not exist
        needsPopulation = true;
        break;
      }
    }
    
    if (needsPopulation) {
      console.log('⚠️  ISSUE FOUND: Analytics tables are empty or missing\n');
      console.log('RECOMMENDED ACTIONS:');
      console.log('1. Run migrations to create analytics tables:');
      console.log('   npx drizzle-kit push');
      console.log('');
      console.log('2. Populate analytics tables with data:');
      console.log('   npx tsx scripts/populate-intelligence-data-fixed.ts');
      console.log('   OR');
      console.log('   npx tsx scripts/comprehensive-intelligence-population.ts');
      console.log('');
      console.log('3. If no source data (auctions/bids), you need to:');
      console.log('   - Create some test auctions');
      console.log('   - Add some bids');
      console.log('   - Then run the population scripts');
    } else {
      console.log('✅ Analytics tables have data!');
      console.log('');
      console.log('If dashboard still shows "No data available", check:');
      console.log('1. Frontend is making correct API calls');
      console.log('2. Date range filters match data in tables');
      console.log('3. Browser console for JavaScript errors');
      console.log('4. Network tab to see actual API responses');
    }
    
  } catch (error) {
    console.error('\n❌ INVESTIGATION FAILED:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

investigateAnalyticsDashboard();
