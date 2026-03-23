#!/usr/bin/env ts-node
/**
 * Redact Secrets from Documentation
 * 
 * This script replaces real API keys in documentation with placeholders
 * Run with: npx ts-node scripts/redact-secrets-from-docs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Map of real secrets to placeholders (using generic patterns)
const REDACTIONS = [
  {
    pattern: /AIzaSy[A-Za-z0-9_-]{33}/g,
    replacement: 'your-google-api-key-here',
    name: 'Google API Key (Gemini/Maps)',
  },
  {
    pattern: /sk_test_[a-f0-9]{40}/g,
    replacement: 'sk_test_your-paystack-secret-key',
    name: 'Paystack Test Secret Key',
  },
  {
    pattern: /pk_test_[a-f0-9]{40}/g,
    replacement: 'pk_test_your-paystack-public-key',
    name: 'Paystack Test Public Key',
  },
];

// Files to process
const FILES_TO_REDACT = [
  'docs/AI_DAMAGE_DETECTION_GEMINI_FIX.md',
  'docs/AI_ASSESSMENT_WITH_VEHICLE_CONTEXT_COMPLETE.md',
  'docs/AUCTION_DETAILS_PAGE_COMPREHENSIVE_FIXES_COMPLETE.md',
  'docs/GOOGLE_MAPS_403_FIX_STEPS.md',
  'docs/GOOGLE_MAPS_API_403_ERROR_FIX.md',
  'docs/GOOGLE_GEOLOCATION_ACCURACY_ANALYSIS_AND_SOLUTION.md',
  'docs/BVN_VERIFICATION_TEST_MODE_GUIDE.md',
  'docs/PAYSTACK_BVN_MIGRATION_COMPLETE.md',
  'docs/PAYSTACK_BVN_VERIFICATION_GUIDE.md',
  '.kiro/specs/gemini-damage-detection-migration/TASK_4_COMPLETE.md',
];

let totalRedactions = 0;

function redactFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let fileRedactions = 0;

  REDACTIONS.forEach(({ pattern, replacement, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      fileRedactions += matches.length;
      content = content.replace(pattern, replacement);
      console.log(`   ✓ Redacted ${matches.length}x ${name}`);
    }
  });

  if (fileRedactions > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${filePath}: ${fileRedactions} redaction(s)`);
    totalRedactions += fileRedactions;
  } else {
    console.log(`✓  ${filePath}: No secrets found`);
  }
}

// Main execution
console.log('🔒 Redacting secrets from documentation files...\n');

FILES_TO_REDACT.forEach(redactFile);

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Complete! Redacted ${totalRedactions} secret(s) from ${FILES_TO_REDACT.length} file(s)`);
console.log(`\n⚠️  IMPORTANT: The .env file still contains real secrets.`);
console.log(`   This is CORRECT - .env should never be committed to git.`);
console.log(`   Verify .env is in .gitignore: git check-ignore .env`);
console.log(`\n🔐 Next steps:`);
console.log(`   1. Review the changes: git diff`);
console.log(`   2. Commit the redacted docs: git add docs/ .kiro/`);
console.log(`   3. REVOKE the exposed API keys (see SECURITY_BREACH_ACTION_PLAN.md)`);
console.log(`   4. Generate NEW API keys`);
console.log(`   5. Update your .env file with new keys`);
