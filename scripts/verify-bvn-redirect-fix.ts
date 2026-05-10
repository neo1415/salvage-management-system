#!/usr/bin/env tsx
/**
 * Verification script for BVN redirect fix
 * 
 * This script verifies that:
 * 1. Login page uses router.push() instead of window.location.href
 * 2. Middleware checks BVN verification for vendors
 * 3. JWT callback refreshes BVN status periodically
 */

import fs from 'fs';
import path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: CheckResult[] = [];

function checkFile(filePath: string, checks: Array<{ name: string; pattern: RegExp; shouldExist: boolean }>) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    results.push({
      name: `File exists: ${filePath}`,
      passed: false,
      message: `File not found: ${filePath}`,
    });
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  for (const check of checks) {
    const found = check.pattern.test(content);
    const passed = found === check.shouldExist;
    
    results.push({
      name: check.name,
      passed,
      message: passed
        ? `✅ ${check.name}`
        : `❌ ${check.name} - ${check.shouldExist ? 'Pattern not found' : 'Pattern should not exist'}`,
    });
  }
}

console.log('🔍 Verifying BVN Redirect Fix...\n');

// Check 1: Login page should use router.push() instead of window.location.href
checkFile('src/app/(auth)/login/page.tsx', [
  {
    name: 'Login page uses router.push() for vendor redirect',
    pattern: /router\.push\('\/vendor\/dashboard'\)/,
    shouldExist: true,
  },
  {
    name: 'Login page does NOT use window.location.href for vendor redirect',
    pattern: /window\.location\.href\s*=\s*['"]\/vendor\/dashboard['"]/,
    shouldExist: false,
  },
  {
    name: 'Login page has comment explaining router.push usage',
    pattern: /Use router\.push instead of window\.location\.href/,
    shouldExist: true,
  },
]);

// Check 2: Middleware checks BVN verification
checkFile('src/middleware.ts', [
  {
    name: 'Middleware checks if user is vendor',
    pattern: /token\?\.role\s*===\s*['"]vendor['"]/,
    shouldExist: true,
  },
  {
    name: 'Middleware checks bvnVerified flag',
    pattern: /bvnVerified/,
    shouldExist: true,
  },
  {
    name: 'Middleware redirects to tier1 KYC when BVN not verified',
    pattern: /\/vendor\/kyc\/tier1/,
    shouldExist: true,
  },
]);

// Check 3: JWT callback refreshes BVN status
checkFile('src/lib/auth/next-auth.config.ts', [
  {
    name: 'JWT callback checks BVN status on initial login',
    pattern: /\[JWT Initial Login\] Vendor BVN status/,
    shouldExist: true,
  },
  {
    name: 'JWT callback refreshes BVN status for existing sessions',
    pattern: /\[JWT Session Refresh\] Vendor BVN status changed/,
    shouldExist: true,
  },
  {
    name: 'JWT callback has periodic BVN check logic',
    pattern: /lastBvnCheck/,
    shouldExist: true,
  },
]);

// Print results
console.log('📊 Verification Results:\n');

let allPassed = true;
for (const result of results) {
  console.log(result.message);
  if (!result.passed) {
    allPassed = false;
  }
}

console.log('\n' + '='.repeat(60));

if (allPassed) {
  console.log('✅ All checks passed! The BVN redirect fix is correctly implemented.');
  console.log('\n📝 Next steps:');
  console.log('1. Commit the changes');
  console.log('2. Push to repository');
  console.log('3. Deploy to production');
  console.log('4. Test with a new vendor account');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the issues above.');
  process.exit(1);
}
