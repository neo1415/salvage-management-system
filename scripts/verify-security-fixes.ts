#!/usr/bin/env tsx

/**
 * Security Fixes Verification Script
 * 
 * Verifies that all critical security fixes have been applied
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function addCheck(name: string, passed: boolean, message: string) {
  checks.push({ name, passed, message });
}

console.log('🔍 Verifying Security Fixes...\n');

// Check 1: Debug mode disabled
console.log('Check 1: Debug Mode Disabled');
try {
  const authConfig = readFileSync(
    join(process.cwd(), 'src/lib/auth/next-auth.config.ts'),
    'utf-8'
  );
  
  const hasDebugFalse = authConfig.includes('debug: false');
  const hasDebugComment = authConfig.includes('SECURITY: Debug mode disabled');
  const noDebugDevelopment = !authConfig.includes("debug: process.env.NODE_ENV === 'development'");
  
  if (hasDebugFalse && hasDebugComment && noDebugDevelopment) {
    addCheck('Debug Mode', true, '✅ Debug mode is disabled');
  } else {
    addCheck('Debug Mode', false, '❌ Debug mode is still enabled or not properly commented');
  }
} catch (error) {
  addCheck('Debug Mode', false, `❌ Failed to check: ${error}`);
}

// Check 2: Custom logger implemented
console.log('Check 2: Custom Logger Implemented');
try {
  const authConfig = readFileSync(
    join(process.cwd(), 'src/lib/auth/next-auth.config.ts'),
    'utf-8'
  );
  
  const hasLogger = authConfig.includes('logger: {');
  const hasErrorHandler = authConfig.includes('error(error: Error)');
  const hasSanitization = authConfig.includes('sanitizedMessage');
  
  if (hasLogger && hasErrorHandler && hasSanitization) {
    addCheck('Custom Logger', true, '✅ Custom sanitized logger is implemented');
  } else {
    addCheck('Custom Logger', false, '❌ Custom logger is missing or incomplete');
  }
} catch (error) {
  addCheck('Custom Logger', false, `❌ Failed to check: ${error}`);
}

// Check 3: Retry logic implemented
console.log('Check 3: Database Retry Logic');
try {
  const drizzle = readFileSync(
    join(process.cwd(), 'src/lib/db/drizzle.ts'),
    'utf-8'
  );
  
  const hasWithRetry = drizzle.includes('export async function withRetry');
  const hasHealthCheck = drizzle.includes('export async function checkDatabaseConnection');
  const hasExponentialBackoff = drizzle.includes('delayMs * attempt');
  
  if (hasWithRetry && hasHealthCheck && hasExponentialBackoff) {
    addCheck('Retry Logic', true, '✅ Database retry logic with exponential backoff is implemented');
  } else {
    addCheck('Retry Logic', false, '❌ Retry logic is missing or incomplete');
  }
} catch (error) {
  addCheck('Retry Logic', false, `❌ Failed to check: ${error}`);
}

// Check 4: Enhanced connection pool
console.log('Check 4: Enhanced Connection Pool');
try {
  const drizzle = readFileSync(
    join(process.cwd(), 'src/lib/db/drizzle.ts'),
    'utf-8'
  );
  
  const hasTimeout30 = drizzle.includes('connect_timeout: 30');
  const hasApplicationName = drizzle.includes('application_name');
  const hasOnClose = drizzle.includes('onclose:');
  
  if (hasTimeout30 && hasApplicationName && hasOnClose) {
    addCheck('Connection Pool', true, '✅ Enhanced connection pool configuration is in place');
  } else {
    addCheck('Connection Pool', false, '❌ Connection pool configuration is incomplete');
  }
} catch (error) {
  addCheck('Connection Pool', false, `❌ Failed to check: ${error}`);
}

// Check 5: Retry logic used in auth
console.log('Check 5: Retry Logic in Auth Queries');
try {
  const authConfig = readFileSync(
    join(process.cwd(), 'src/lib/auth/next-auth.config.ts'),
    'utf-8'
  );
  
  const importsWithRetry = authConfig.includes('import { db, withRetry }');
  const usesWithRetry = (authConfig.match(/await withRetry/g) || []).length >= 3;
  
  if (importsWithRetry && usesWithRetry) {
    addCheck('Auth Retry Logic', true, '✅ Retry logic is used in authentication queries');
  } else {
    addCheck('Auth Retry Logic', false, '❌ Retry logic is not properly used in auth queries');
  }
} catch (error) {
  addCheck('Auth Retry Logic', false, `❌ Failed to check: ${error}`);
}

// Check 6: Test script exists
console.log('Check 6: Database Test Script');
try {
  const testScript = readFileSync(
    join(process.cwd(), 'scripts/test-database-connection.ts'),
    'utf-8'
  );
  
  const hasHealthCheck = testScript.includes('checkDatabaseConnection');
  const hasExactQuery = testScript.includes('Test 4: Exact Query from Error Log');
  
  if (hasHealthCheck && hasExactQuery) {
    addCheck('Test Script', true, '✅ Database connection test script is available');
  } else {
    addCheck('Test Script', false, '❌ Test script is incomplete');
  }
} catch (error) {
  addCheck('Test Script', false, `❌ Test script not found: ${error}`);
}

// Print results
console.log('\n' + '='.repeat(60));
console.log('VERIFICATION RESULTS');
console.log('='.repeat(60) + '\n');

let allPassed = true;
checks.forEach((check) => {
  console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
  console.log(`   ${check.message}\n`);
  if (!check.passed) allPassed = false;
});

console.log('='.repeat(60));
if (allPassed) {
  console.log('✅ ALL SECURITY FIXES VERIFIED');
  console.log('='.repeat(60));
  console.log('\nNext Steps:');
  console.log('1. Test database connection: npm run tsx scripts/test-database-connection.ts');
  console.log('2. Test authentication flow in development');
  console.log('3. Monitor logs for any password exposure');
  console.log('4. Deploy to production');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED');
  console.log('='.repeat(60));
  console.log('\nPlease review the failed checks above and fix them before deploying.');
  process.exit(1);
}
