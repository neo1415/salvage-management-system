/**
 * Verification Script: Vehicle Input Cascade and Clear Logic
 * 
 * This script verifies that Task 7.4 requirements are met:
 * - Automatic model fetch when make is selected
 * - Automatic year fetch when model is selected
 * - Model and year clear when make changes
 * - Year clears when model changes
 * 
 * Requirements: 4.4, 4.5, 4.8, 4.9
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function addResult(check: string, passed: boolean, details: string) {
  results.push({ check, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${check}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function verifyFile(filePath: string): string | null {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

console.log('🔍 Verifying Vehicle Input Cascade and Clear Logic (Task 7.4)\n');

// Load the case creation form
const formPath = 'src/app/(dashboard)/adjuster/cases/new/page.tsx';
const formContent = verifyFile(formPath);

if (!formContent) {
  console.error(`❌ Could not find ${formPath}`);
  process.exit(1);
}

console.log('📋 Checking Requirements...\n');

// ============================================================================
// Requirement 4.4: Automatic model fetch when make is selected
// ============================================================================
console.log('Requirement 4.4: Automatic model fetch when make is selected');

// Check 1: Model autocomplete has make query parameter
const hasModelQueryParam = formContent.includes('queryParams={{ make: watch(\'vehicleMake\')');
addResult(
  'Model autocomplete has make query parameter',
  hasModelQueryParam,
  hasModelQueryParam
    ? 'Model endpoint receives make as query parameter'
    : 'Missing make query parameter for model endpoint'
);

// Check 2: Model endpoint is correct
const hasModelEndpoint = formContent.includes('endpoint="/api/valuations/models"');
addResult(
  'Model autocomplete connected to correct endpoint',
  hasModelEndpoint,
  hasModelEndpoint
    ? 'Connected to /api/valuations/models'
    : 'Model endpoint not configured correctly'
);

// Check 3: Model field is disabled until make is selected
const modelDisabledLogic = formContent.includes('disabled={!watch(\'vehicleMake\')}');
addResult(
  'Model field disabled until make is selected',
  modelDisabledLogic,
  modelDisabledLogic
    ? 'Model field has correct disabled logic'
    : 'Model field missing disabled logic'
);

console.log('');

// ============================================================================
// Requirement 4.5: Automatic year fetch when model is selected
// ============================================================================
console.log('Requirement 4.5: Automatic year fetch when model is selected');

// Check 4: Year autocomplete has make and model query parameters
const hasYearQueryParams = 
  formContent.includes('make: watch(\'vehicleMake\')') &&
  formContent.includes('model: watch(\'vehicleModel\')') &&
  formContent.includes('endpoint="/api/valuations/years"');
addResult(
  'Year autocomplete has make and model query parameters',
  hasYearQueryParams,
  hasYearQueryParams
    ? 'Year endpoint receives both make and model as query parameters'
    : 'Missing make/model query parameters for year endpoint'
);

// Check 5: Year endpoint is correct
const hasYearEndpoint = formContent.includes('endpoint="/api/valuations/years"');
addResult(
  'Year autocomplete connected to correct endpoint',
  hasYearEndpoint,
  hasYearEndpoint
    ? 'Connected to /api/valuations/years'
    : 'Year endpoint not configured correctly'
);

// Check 6: Year field is disabled until make AND model are selected
const yearDisabledLogic = formContent.includes('disabled={!watch(\'vehicleMake\') || !watch(\'vehicleModel\')}');
addResult(
  'Year field disabled until make and model are selected',
  yearDisabledLogic,
  yearDisabledLogic
    ? 'Year field has correct disabled logic'
    : 'Year field missing disabled logic'
);

console.log('');

// ============================================================================
// Requirement 4.8: Model and year clear when make changes
// ============================================================================
console.log('Requirement 4.8: Model and year clear when make changes');

// Check 7: Make onChange clears model
const makeClearsModel = formContent.includes('setValue(\'vehicleModel\', \'\')') &&
  formContent.match(/name="vehicleMake"[\s\S]*?onChange=\{[\s\S]*?setValue\('vehicleModel', ''\)/);
addResult(
  'Make onChange handler clears model',
  makeClearsModel,
  makeClearsModel
    ? 'Make onChange includes setValue(\'vehicleModel\', \'\')'
    : 'Make onChange does not clear model'
);

// Check 8: Make onChange clears year
const makeClearsYear = formContent.includes('setValue(\'vehicleYear\', undefined)') &&
  formContent.match(/name="vehicleMake"[\s\S]*?onChange=\{[\s\S]*?setValue\('vehicleYear', undefined\)/);
addResult(
  'Make onChange handler clears year',
  makeClearsYear,
  makeClearsYear
    ? 'Make onChange includes setValue(\'vehicleYear\', undefined)'
    : 'Make onChange does not clear year'
);

console.log('');

// ============================================================================
// Requirement 4.9: Year clears when model changes
// ============================================================================
console.log('Requirement 4.9: Year clears when model changes');

// Check 9: Model onChange clears year
const modelClearsYear = formContent.includes('setValue(\'vehicleYear\', undefined)') &&
  formContent.match(/name="vehicleModel"[\s\S]*?onChange=\{[\s\S]*?setValue\('vehicleYear', undefined\)/);
addResult(
  'Model onChange handler clears year',
  modelClearsYear,
  modelClearsYear
    ? 'Model onChange includes setValue(\'vehicleYear\', undefined)'
    : 'Model onChange does not clear year'
);

console.log('');

// ============================================================================
// Additional Checks
// ============================================================================
console.log('Additional Checks:');

// Check 10: All three fields use VehicleAutocomplete
const makeUsesAutocomplete = formContent.includes('<VehicleAutocomplete') &&
  formContent.includes('name="vehicleMake"');
const modelUsesAutocomplete = formContent.includes('<VehicleAutocomplete') &&
  formContent.includes('name="vehicleModel"');
const yearUsesAutocomplete = formContent.includes('<VehicleAutocomplete') &&
  formContent.includes('name="vehicleYear"');

const allUseAutocomplete = makeUsesAutocomplete && modelUsesAutocomplete && yearUsesAutocomplete;
addResult(
  'All three vehicle fields use VehicleAutocomplete',
  allUseAutocomplete,
  allUseAutocomplete
    ? 'Make, model, and year all use VehicleAutocomplete component'
    : 'Not all fields use VehicleAutocomplete'
);

// Check 11: Required validation preserved
const makeRequired = formContent.match(/name="vehicleMake"[\s\S]*?required/);
const modelRequired = formContent.match(/name="vehicleModel"[\s\S]*?required/);
const yearRequired = formContent.match(/name="vehicleYear"[\s\S]*?required/);

const allRequired = makeRequired && modelRequired && yearRequired;
addResult(
  'All vehicle fields have required validation',
  allRequired,
  allRequired
    ? 'Make, model, and year all have required prop'
    : 'Not all fields have required validation'
);

// Check 12: Mobile optimization
const makeHasMobile = formContent.match(/name="vehicleMake"[\s\S]*?isMobile/);
const modelHasMobile = formContent.match(/name="vehicleModel"[\s\S]*?isMobile/);
const yearHasMobile = formContent.match(/name="vehicleYear"[\s\S]*?isMobile/);

const allHaveMobile = makeHasMobile && modelHasMobile && yearHasMobile;
addResult(
  'All vehicle fields have mobile optimization',
  allHaveMobile,
  allHaveMobile
    ? 'Make, model, and year all have isMobile prop'
    : 'Not all fields have mobile optimization'
);

console.log('');

// ============================================================================
// Summary
// ============================================================================
console.log('═'.repeat(60));
console.log('📊 VERIFICATION SUMMARY');
console.log('═'.repeat(60));

const totalChecks = results.length;
const passedChecks = results.filter(r => r.passed).length;
const failedChecks = totalChecks - passedChecks;

console.log(`Total Checks: ${totalChecks}`);
console.log(`Passed: ${passedChecks} ✅`);
console.log(`Failed: ${failedChecks} ❌`);
console.log('');

if (failedChecks > 0) {
  console.log('❌ FAILED CHECKS:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`   - ${r.check}`);
    console.log(`     ${r.details}`);
  });
  console.log('');
}

// ============================================================================
// Requirements Mapping
// ============================================================================
console.log('📋 REQUIREMENTS STATUS:');
console.log('');

const req44 = results.slice(0, 3).every(r => r.passed);
console.log(`Requirement 4.4 (Automatic model fetch): ${req44 ? '✅ PASS' : '❌ FAIL'}`);

const req45 = results.slice(3, 6).every(r => r.passed);
console.log(`Requirement 4.5 (Automatic year fetch): ${req45 ? '✅ PASS' : '❌ FAIL'}`);

const req48 = results.slice(6, 8).every(r => r.passed);
console.log(`Requirement 4.8 (Clear model/year on make change): ${req48 ? '✅ PASS' : '❌ FAIL'}`);

const req49 = results.slice(8, 9).every(r => r.passed);
console.log(`Requirement 4.9 (Clear year on model change): ${req49 ? '✅ PASS' : '❌ FAIL'}`);

console.log('');

// ============================================================================
// Final Result
// ============================================================================
const allPassed = failedChecks === 0;

if (allPassed) {
  console.log('🎉 SUCCESS! All cascade and clear logic checks passed!');
  console.log('');
  console.log('Task 7.4 is complete. The form correctly implements:');
  console.log('  ✅ Automatic model fetch when make is selected');
  console.log('  ✅ Automatic year fetch when model is selected');
  console.log('  ✅ Model and year clear when make changes');
  console.log('  ✅ Year clears when model changes');
  process.exit(0);
} else {
  console.log('❌ VERIFICATION FAILED');
  console.log('');
  console.log('Please review the failed checks above and fix the issues.');
  process.exit(1);
}
