#!/usr/bin/env tsx

/**
 * Database Connection Test Script
 * 
 * Tests the database connection and diagnoses any issues
 */

import { config } from 'dotenv';
config();

import { db, client, checkDatabaseConnection } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');

  // Test 1: Basic health check
  console.log('Test 1: Basic Health Check');
  const healthCheck = await checkDatabaseConnection();
  if (healthCheck.healthy) {
    console.log('✅ Database connection is healthy\n');
  } else {
    console.error('❌ Database connection failed:', healthCheck.error);
    console.log('\n');
  }

  // Test 2: Simple query
  console.log('Test 2: Simple Query (SELECT 1)');
  try {
    const result = await client`SELECT 1 as test`;
    console.log('✅ Simple query successful:', result);
    console.log('\n');
  } catch (error) {
    console.error('❌ Simple query failed:', error);
    console.log('\n');
  }

  // Test 3: Users table query
  console.log('Test 3: Users Table Query');
  try {
    const userCount = await db
      .select()
      .from(users)
      .limit(1);
    console.log('✅ Users table query successful');
    console.log(`   Found ${userCount.length} user(s)`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Users table query failed:', error);
    console.log('\n');
  }

  // Test 4: Test the exact query from the error
  console.log('Test 4: Exact Query from Error Log');
  const testEmail = 'skyneo502@gmail.com';
  try {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        fullName: users.fullName,
        dateOfBirth: users.dateOfBirth,
        requirePasswordChange: users.requirePasswordChange,
        notificationPreferences: users.notificationPreferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        loginDeviceType: users.loginDeviceType,
      })
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);
    
    console.log('✅ Exact query successful');
    console.log(`   Found ${result.length} user(s) with email ${testEmail}`);
    console.log('\n');
  } catch (error) {
    console.error('❌ Exact query failed:', error);
    console.log('\n');
  }

  // Test 5: Connection pool status
  console.log('Test 5: Connection Pool Status');
  console.log('   Max connections:', process.env.NODE_ENV === 'test' ? 5 : 10);
  console.log('   Connection timeout: 30 seconds');
  console.log('   Idle timeout: 30 seconds');
  console.log('   Max lifetime: 30 minutes');
  console.log('\n');

  // Test 6: Database URL validation
  console.log('Test 6: Database URL Validation');
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('✅ DATABASE_URL is set');
    
    // Parse URL to check for issues
    try {
      const url = new URL(dbUrl.replace('postgresql://', 'http://'));
      console.log('   Host:', url.hostname);
      console.log('   Port:', url.port);
      console.log('   Database:', url.pathname.substring(1));
      console.log('   Username:', url.username);
      console.log('   Password:', url.password ? '***' + url.password.slice(-4) : 'NOT SET');
      
      // Check for special characters in password
      if (url.password && (url.password.includes('@') || url.password.includes('%'))) {
        console.log('⚠️  Password contains special characters');
        console.log('   Make sure they are properly URL-encoded');
        console.log('   @ should be %40');
        console.log('   % should be %25');
      }
      console.log('\n');
    } catch (error) {
      console.error('❌ Failed to parse DATABASE_URL:', error);
      console.log('\n');
    }
  } else {
    console.error('❌ DATABASE_URL is not set');
    console.log('\n');
  }

  console.log('✅ Database connection test complete');
  process.exit(0);
}

testDatabaseConnection().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
