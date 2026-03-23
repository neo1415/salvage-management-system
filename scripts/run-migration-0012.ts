#!/usr/bin/env tsx

/**
 * Migration Runner: 0012_add_search_metrics_analytics
 * 
 * This script runs the database migration to add comprehensive search metrics
 * and analytics tables for the Universal AI Internet Search System.
 * 
 * Tables Created:
 * - search_performance_metrics: Real-time performance tracking
 * - search_usage_analytics: User behavior and search patterns
 * - search_quality_metrics: Search result quality and confidence
 * - api_cost_analytics: API usage and cost monitoring
 * - search_trend_analytics: Business intelligence and market trends
 * 
 * Features:
 * - Dashboard views for real-time monitoring
 * - Analytics functions for data processing
 * - Comprehensive indexing for performance
 * - Sample data initialization
 * 
 * Usage: npm run migration:0012
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function runMigration() {
  console.log('🚀 Starting Migration 0012: Add Search Metrics and Analytics Tables');
  console.log('📊 This migration adds comprehensive analytics for the Universal AI Internet Search System');
  
  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'src/lib/db/migrations/0012_add_search_metrics_analytics.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📖 Reading migration file...');
    console.log(`📁 Migration file: ${migrationPath}`);
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration 0012 completed successfully!');
    console.log('');
    console.log('📊 Analytics Tables Created:');
    console.log('  ✓ search_performance_metrics - Real-time performance tracking');
    console.log('  ✓ search_usage_analytics - User behavior and search patterns');
    console.log('  ✓ search_quality_metrics - Search result quality and confidence');
    console.log('  ✓ api_cost_analytics - API usage and cost monitoring');
    console.log('  ✓ search_trend_analytics - Business intelligence and market trends');
    console.log('');
    console.log('📈 Dashboard Views Created:');
    console.log('  ✓ search_performance_dashboard - Real-time performance monitoring');
    console.log('  ✓ daily_search_summary - Daily analytics summary');
    console.log('  ✓ cost_monitoring_dashboard - Cost and quota monitoring');
    console.log('');
    console.log('⚙️ Analytics Functions Created:');
    console.log('  ✓ calculate_search_performance_metrics() - Performance data aggregation');
    console.log('  ✓ update_popular_queries() - Popular query tracking');
    console.log('');
    console.log('🎯 Key Features:');
    console.log('  • Real-time performance monitoring and alerting');
    console.log('  • User behavior analytics and search pattern tracking');
    console.log('  • Search quality metrics with confidence scoring');
    console.log('  • API cost monitoring with budget alerts');
    console.log('  • Business intelligence for market trends');
    console.log('  • Dashboard-ready views and functions');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('  1. Update analytics services to use new tables');
    console.log('  2. Create dashboard APIs for real-time monitoring');
    console.log('  3. Set up automated analytics data processing');
    console.log('  4. Configure cost monitoring alerts');
    console.log('');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the migration
runMigration().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});