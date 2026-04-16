/**
 * Setup Test Database Script
 * 
 * This script helps set up the local PostgreSQL test database by:
 * 1. Checking if TEST_DATABASE_URL is configured
 * 2. Testing the connection
 * 3. Running migrations
 * 4. Verifying tables exist
 * 
 * Usage:
 *   tsx scripts/setup-test-database.ts
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/db/schema';

// Load environment variables
config();

async function setupTestDatabase() {
  console.log('🔧 Test Database Setup\n');

  // Step 1: Check TEST_DATABASE_URL
  const testDbUrl = process.env.TEST_DATABASE_URL;
  
  if (!testDbUrl) {
    console.error('❌ TEST_DATABASE_URL not found in .env file');
    console.log('\n📝 Add this to your .env file:');
    console.log('TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test\n');
    process.exit(1);
  }

  console.log('✅ TEST_DATABASE_URL found');
  console.log(`   ${testDbUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  // Step 2: Test connection
  console.log('🔌 Testing database connection...');
  
  let client: postgres.Sql;
  try {
    client = postgres(testDbUrl, {
      max: 1,
      connect_timeout: 10,
    });

    await client`SELECT 1 as test`;
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Database connection failed');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Is PostgreSQL installed and running?');
    console.log('   2. Is the password correct?');
    console.log('   3. Does the database exist?');
    console.log('\n   To create the database:');
    console.log('   psql -U postgres -c "CREATE DATABASE salvage_test;"\n');
    process.exit(1);
  }

  // Step 3: Check if tables exist
  console.log('📊 Checking database schema...');
  
  try {
    const result = await client`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    const tableCount = parseInt(result[0].table_count);
    
    if (tableCount === 0) {
      console.log('⚠️  No tables found - migrations need to be run');
      console.log('\n📝 Run migrations with:');
      console.log('   $env:DATABASE_URL = $env:TEST_DATABASE_URL');
      console.log('   npm run db:push\n');
    } else {
      console.log(`✅ Found ${tableCount} tables in database\n`);
      
      // List some key tables
      const tables = await client`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
        LIMIT 10
      `;
      
      console.log('📋 Sample tables:');
      tables.forEach(t => console.log(`   - ${t.table_name}`));
      
      if (tableCount > 10) {
        console.log(`   ... and ${tableCount - 10} more\n`);
      } else {
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error checking schema');
    console.error('   Error:', error instanceof Error ? error.message : String(error));
  }

  // Step 4: Verify critical tables for auction deposit tests
  console.log('🔍 Verifying critical tables for integration tests...');
  
  const criticalTables = [
    'users',
    'vendors',
    'escrow_wallets',
    'salvage_cases',
    'auctions',
    'bids',
    'deposit_events',
  ];

  let allTablesExist = true;
  
  for (const tableName of criticalTables) {
    try {
      const result = await client`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${tableName}
        ) as exists
      `;
      
      if (result[0].exists) {
        console.log(`   ✅ ${tableName}`);
      } else {
        console.log(`   ❌ ${tableName} - MISSING`);
        allTablesExist = false;
      }
    } catch (error) {
      console.log(`   ❌ ${tableName} - ERROR`);
      allTablesExist = false;
    }
  }

  console.log('');

  // Step 5: Summary
  if (allTablesExist) {
    console.log('🎉 Test database is ready!');
    console.log('\n✅ You can now run integration tests:');
    console.log('   npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts\n');
  } else {
    console.log('⚠️  Some tables are missing');
    console.log('\n📝 Run migrations to create missing tables:');
    console.log('   $env:DATABASE_URL = $env:TEST_DATABASE_URL');
    console.log('   npm run db:push\n');
  }

  // Close connection
  await client.end();
}

// Run setup
setupTestDatabase().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
