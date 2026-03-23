#!/usr/bin/env tsx

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function completeMigration() {
  console.log('🔄 Completing Migration 0010: Adding audit log and initial data...');
  
  try {
    console.log('⏳ Adding audit log entry...');
    await db.execute(sql`
      INSERT INTO valuation_audit_logs (
        id,
        action,
        entity_type,
        entity_id,
        changed_fields,
        user_id,
        created_at
      )
      SELECT
        gen_random_uuid(),
        'create',
        'migration',
        gen_random_uuid(),
        jsonb_build_object(
          'migration', jsonb_build_object(
            'name', '0010_add_internet_search_tables',
            'description', 'Added database tables for Universal AI Internet Search System analytics and monitoring',
            'tables_created', jsonb_build_array(
              'internet_search_logs',
              'internet_search_results', 
              'internet_search_metrics',
              'popular_search_queries',
              'api_usage_tracking'
            ),
            'purpose', jsonb_build_object(
              'analytics', 'Long-term search performance tracking',
              'monitoring', 'API usage and cost monitoring',
              'optimization', 'Cache warming and query optimization',
              'debugging', 'Detailed search result analysis'
            ),
            'integration', jsonb_build_object(
              'cache_strategy', '24-hour Redis cache with persistent analytics',
              'existing_tables', 'Works alongside market_data_cache and scraping_logs',
              'api_provider', 'Serper.dev Google Search API'
            )
          )
        ),
        (SELECT id FROM users WHERE role = 'system_admin' LIMIT 1),
        NOW()
      WHERE EXISTS (SELECT 1 FROM users WHERE role = 'system_admin')
    `);

    console.log('⏳ Creating initial API usage tracking entry...');
    await db.execute(sql`
      INSERT INTO api_usage_tracking (
        provider,
        endpoint,
        tracking_date,
        quota_limit,
        created_at,
        updated_at
      )
      VALUES (
        'serper',
        'search',
        DATE_TRUNC('day', NOW()),
        2500,
        NOW(),
        NOW()
      ) ON CONFLICT DO NOTHING
    `);

    console.log('✅ Migration 0010 completed successfully!');
    console.log('');
    console.log('📋 All Tables Created:');
    console.log('  ✓ internet_search_logs - Search operation tracking');
    console.log('  ✓ internet_search_results - Detailed search results');
    console.log('  ✓ internet_search_metrics - Performance metrics');
    console.log('  ✓ popular_search_queries - Query optimization data');
    console.log('  ✓ api_usage_tracking - API cost monitoring');
    console.log('');
    console.log('📝 Audit and Initial Data:');
    console.log('  ✓ Migration audit log entry created');
    console.log('  ✓ Initial API usage tracking entry created');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('  1. Verify migration with: npx tsx scripts/verify-migration-0010.ts');
    console.log('  2. Update internet search services to use new analytics tables');
    console.log('  3. Set up monitoring dashboards for new metrics');
    console.log('  4. Configure automated reporting for API usage');

  } catch (error) {
    console.error('❌ Failed to complete migration:', error);
    process.exit(1);
  }
}

completeMigration();