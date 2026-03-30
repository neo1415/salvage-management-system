/**
 * Verification Script: Gemini Damage Display Consistency
 * 
 * This script verifies that all pages displaying AI assessment data
 * are using the GeminiDamageDisplay component consistently.
 * 
 * Run with: npx tsx scripts/verify-gemini-display-consistency.ts
 */

import fs from 'fs';
import path from 'path';

interface PageCheck {
  file: string;
  hasGeminiDamageDisplay: boolean;
  hasItemDetails: boolean;
  hasDamagedParts: boolean;
  hasSummary: boolean;
  hasFallback: boolean;
  issues: string[];
}

const PAGES_TO_CHECK = [
  'src/app/(dashboard)/vendor/auctions/[id]/page.tsx',
  'src/app/(dashboard)/manager/approvals/page.tsx',
  'src/app/(dashboard)/adjuster/cases/[id]/page.tsx',
];

function checkPage(filePath: string): PageCheck {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];

  // Check for GeminiDamageDisplay import
  const hasImport = content.includes('import { GeminiDamageDisplay }');
  if (!hasImport) {
    issues.push('Missing GeminiDamageDisplay import');
  }

  // Check for GeminiDamageDisplay usage
  const hasGeminiDamageDisplay = content.includes('<GeminiDamageDisplay');
  if (!hasGeminiDamageDisplay) {
    issues.push('Not using GeminiDamageDisplay component');
  }

  // Check for itemDetails prop
  const hasItemDetails = content.includes('itemDetails={');
  if (!hasItemDetails && hasGeminiDamageDisplay) {
    issues.push('Missing itemDetails prop');
  }

  // Check for damagedParts prop
  const hasDamagedParts = content.includes('damagedParts={');
  if (!hasDamagedParts && hasGeminiDamageDisplay) {
    issues.push('Missing damagedParts prop');
  }

  // Check for summary prop
  const hasSummary = content.includes('summary={');
  if (!hasSummary && hasGeminiDamageDisplay) {
    issues.push('Missing summary prop');
  }

  // Check for fallback to Vision API labels
  const hasFallback = content.includes('labels.map') || content.includes('aiAssessment.labels');
  if (!hasFallback && hasGeminiDamageDisplay) {
    issues.push('Missing fallback for Vision API labels');
  }

  return {
    file: filePath,
    hasGeminiDamageDisplay,
    hasItemDetails,
    hasDamagedParts,
    hasSummary,
    hasFallback,
    issues,
  };
}

function main() {
  console.log('🔍 Verifying Gemini Damage Display Consistency\n');
  console.log('=' .repeat(80));
  console.log('\n');

  let allPassed = true;
  const results: PageCheck[] = [];

  for (const page of PAGES_TO_CHECK) {
    const result = checkPage(page);
    results.push(result);

    const status = result.issues.length === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${path.basename(page)}`);
    console.log(`  File: ${page}`);
    console.log(`  GeminiDamageDisplay: ${result.hasGeminiDamageDisplay ? '✓' : '✗'}`);
    console.log(`  itemDetails prop: ${result.hasItemDetails ? '✓' : '✗'}`);
    console.log(`  damagedParts prop: ${result.hasDamagedParts ? '✓' : '✗'}`);
    console.log(`  summary prop: ${result.hasSummary ? '✓' : '✗'}`);
    console.log(`  Fallback to labels: ${result.hasFallback ? '✓' : '✗'}`);

    if (result.issues.length > 0) {
      console.log(`  Issues:`);
      result.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
      allPassed = false;
    }

    console.log('');
  }

  console.log('=' .repeat(80));
  console.log('\n');

  // Summary
  const passedCount = results.filter(r => r.issues.length === 0).length;
  const totalCount = results.length;

  console.log('📊 Summary:');
  console.log(`  Total pages checked: ${totalCount}`);
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${totalCount - passedCount}`);
  console.log('');

  if (allPassed) {
    console.log('✅ All pages are displaying Gemini damage data consistently!');
    console.log('');
    console.log('All pages are using:');
    console.log('  - GeminiDamageDisplay component');
    console.log('  - itemDetails prop (make, model, year, color, trim, bodyStyle, condition, notes)');
    console.log('  - damagedParts prop (list with severity and confidence)');
    console.log('  - summary prop (AI-generated description)');
    console.log('  - Fallback to Vision API labels for old data');
    console.log('');
    process.exit(0);
  } else {
    console.log('❌ Some pages have inconsistencies. Please review the issues above.');
    console.log('');
    process.exit(1);
  }
}

main();
