/**
 * Production Authentication Diagnostic Script
 * 
 * This script helps diagnose why authentication works on localhost but fails on production.
 * Run this on production to check environment variables and session configuration.
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function diagnoseProductionAuth() {
  console.log('🔍 Production Authentication Diagnostic\n');
  console.log('=' .repeat(60));
  
  // 1. Check critical environment variables
  console.log('\n1️⃣  Environment Variables Check:');
  console.log('-'.repeat(60));
  
  const envVars = {
    'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
    'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET ? '✓ Set' : '✗ Missing',
    'DATABASE_URL': process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
    'KV_URL': process.env.KV_URL ? '✓ Set' : '✗ Missing',
    'KV_REST_API_URL': process.env.KV_REST_API_URL ? '✓ Set' : '✗ Missing',
    'KV_REST_API_TOKEN': process.env.KV_REST_API_TOKEN ? '✓ Set' : '✗ Missing',
    'NODE_ENV': process.env.NODE_ENV,
  };
  
  for (const [key, value] of Object.entries(envVars)) {
    const status = value?.includes('✗') ? '❌' : '✅';
    console.log(`${status} ${key}: ${value}`);
  }
  
  // 2. Validate NEXTAUTH_URL format
  console.log('\n2️⃣  NEXTAUTH_URL Validation:');
  console.log('-'.repeat(60));
  
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) {
    const issues: string[] = [];
    
    if (!nextAuthUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
      issues.push('❌ Must start with https:// in production');
    }
    
    if (nextAuthUrl.endsWith('/')) {
      issues.push('❌ Should not have trailing slash');
    }
    
    if (nextAuthUrl.includes('www.')) {
      issues.push('⚠️  Contains www. - ensure this matches your actual domain');
    }
    
    if (issues.length === 0) {
      console.log('✅ NEXTAUTH_URL format is correct');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }
    
    console.log(`Current value: ${nextAuthUrl}`);
  } else {
    console.log('❌ NEXTAUTH_URL is not set!');
  }
  
  // 3. Test database connection
  console.log('\n3️⃣  Database Connection Test:');
  console.log('-'.repeat(60));
  
  try {
    const testUser = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .limit(1);
    
    console.log('✅ Database connection successful');
    console.log(`   Found ${testUser.length} user(s) in database`);
  } catch (error) {
    console.log('❌ Database connection failed');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // 4. Test Redis/KV connection
  console.log('\n4️⃣  Redis/KV Connection Test:');
  console.log('-'.repeat(60));
  
  try {
    const { redis } = await import('@/lib/redis/client');
    await redis.set('test:auth-diagnostic', 'test-value', { ex: 10 });
    const value = await redis.get('test:auth-diagnostic');
    
    if (value === 'test-value') {
      console.log('✅ Redis/KV connection successful');
      await redis.del('test:auth-diagnostic');
    } else {
      console.log('⚠️  Redis/KV connection works but data mismatch');
    }
  } catch (error) {
    console.log('❌ Redis/KV connection failed');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('   Note: Auth can work without Redis, but sessions won\'t persist across server restarts');
  }
  
  // 5. Check cookie configuration
  console.log('\n5️⃣  Cookie Configuration:');
  console.log('-'.repeat(60));
  
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Secure cookies: ${isProduction ? 'Enabled' : 'Disabled'}`);
  console.log(`Cookie prefix: ${isProduction ? '__Secure-' : 'authjs.'}`);
  console.log(`SameSite: lax`);
  console.log(`HttpOnly: true`);
  
  // 6. Recommendations
  console.log('\n6️⃣  Recommendations:');
  console.log('-'.repeat(60));
  
  const recommendations: string[] = [];
  
  if (!process.env.NEXTAUTH_URL) {
    recommendations.push('Set NEXTAUTH_URL in Vercel environment variables');
  }
  
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'your-nextauth-secret') {
    recommendations.push('Generate a strong NEXTAUTH_SECRET: openssl rand -base64 32');
  }
  
  if (nextAuthUrl && nextAuthUrl.endsWith('/')) {
    recommendations.push('Remove trailing slash from NEXTAUTH_URL');
  }
  
  if (nextAuthUrl && !nextAuthUrl.startsWith('https://') && isProduction) {
    recommendations.push('Change NEXTAUTH_URL to use https:// protocol');
  }
  
  if (!process.env.KV_URL) {
    recommendations.push('Consider setting up Vercel KV for session persistence');
  }
  
  if (recommendations.length === 0) {
    console.log('✅ No issues found! If auth still fails, check:');
    console.log('   1. Browser console for cookie errors');
    console.log('   2. Vercel deployment logs for runtime errors');
    console.log('   3. Clear browser cache and cookies');
    console.log('   4. Try incognito mode');
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic complete!\n');
}

// Run diagnostic
diagnoseProductionAuth()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
