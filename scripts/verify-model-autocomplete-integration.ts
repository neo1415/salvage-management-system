/**
 * Verification Script: Vehicle Model Autocomplete Integration
 * 
 * This script verifies that Task 7.2 has been completed successfully:
 * - Model field uses VehicleAutocomplete component
 * - Connected to /api/valuations/models endpoint
 * - Disabled until make is selected
 * - Clears year when model changes
 * - Preserves validation rules
 * 
 * Requirements: 4.2, 4.4, 4.6, 4.9, 4.10
 */

import fs from 'fs';
import path from 'path';

const CASE_CREATION_FILE = 'src/app/(dashboard)/adjuster/cases/new/page.tsx';

interface VerificationResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function verify() {
  console.log('🔍 Verifying Vehicle Model Autocomplete Integration (Task 7.2)...\n');

  // Read the case creation file
  const filePath = path.join(process.cwd(), CASE_CREATION_FILE);
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // Check 1: Model field uses VehicleAutocomplete component
  const hasVehicleAutocompleteForModel = fileContent.includes('name="vehicleModel"') && 
                                          fileContent.includes('<VehicleAutocomplete');
  results.push({
    check: 'Model field uses VehicleAutocomplete component',
    passed: hasVehicleAutocompleteForModel,
    details: hasVehicleAutocompleteForModel 
      ? 'Found VehicleAutocomplete with name="vehicleModel"'
      : 'VehicleAutocomplete component not found for model field'
  });

  // Check 2: Connected to /api/valuations/models endpoint
  const hasModelsEndpoint = fileContent.includes('endpoint="/api/valuations/models"');
  results.push({
    check: 'Connected to /api/valuations/models endpoint',
    passed: hasModelsEndpoint,
    details: hasModelsEndpoint
      ? 'Endpoint correctly set to /api/valuations/models'
      : 'Models endpoint not found'
  });

  // Check 3: Has make query parameter
  const hasMakeQueryParam = fileContent.includes('queryParams={{ make: watch(\'vehicleMake\')');
  results.push({
    check: 'Has make query parameter',
    passed: hasMakeQueryParam,
    details: hasMakeQueryParam
      ? 'Query parameter correctly passes make value'
      : 'Make query parameter not found'
  });

  // Check 4: Disabled until make is selected
  const isDisabledUntilMake = fileContent.includes('disabled={!watch(\'vehicleMake\')}');
  results.push({
    check: 'Disabled until make is selected',
    passed: isDisabledUntilMake,
    details: isDisabledUntilMake
      ? 'Model field correctly disabled when make is not selected'
      : 'Disabled logic not found'
  });

  // Check 5: Clears year when model changes
  const clearsYearOnChange = fileContent.match(/name="vehicleModel"[\s\S]*?onChange=\{[\s\S]*?setValue\('vehicleYear', undefined\)/);
  results.push({
    check: 'Clears year when model changes',
    passed: !!clearsYearOnChange,
    details: clearsYearOnChange
      ? 'onChange handler correctly clears year field'
      : 'Year clearing logic not found in onChange handler'
  });

  // Check 6: Preserves required validation
  const hasRequiredProp = fileContent.match(/name="vehicleModel"[\s\S]*?required/);
  results.push({
    check: 'Preserves required validation',
    passed: !!hasRequiredProp,
    details: hasRequiredProp
      ? 'Required prop is set on model field'
      : 'Required validation not found'
  });

  // Check 7: Has mobile optimization
  const hasMobileOptimization = fileContent.match(/name="vehicleModel"[\s\S]*?isMobile=/);
  results.push({
    check: 'Has mobile optimization',
    passed: !!hasMobileOptimization,
    details: hasMobileOptimization
      ? 'Mobile optimization prop is set'
      : 'Mobile optimization not found'
  });

  // Check 8: No old text input for model
  const hasOldTextInput = fileContent.match(/register\('vehicleModel'\)/);
  results.push({
    check: 'Old text input removed',
    passed: !hasOldTextInput,
    details: !hasOldTextInput
      ? 'Old text input has been removed'
      : 'Old text input still exists - should be removed'
  });

  // Print results
  console.log('📋 Verification Results:\n');
  let allPassed = true;
  
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.check}`);
    console.log(`   ${result.details}\n`);
    if (!result.passed) allPassed = false;
  });

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log('━'.repeat(60));
  console.log(`\n📊 Summary: ${passedCount}/${totalCount} checks passed\n`);
  
  if (allPassed) {
    console.log('🎉 SUCCESS! Task 7.2 implementation is complete and correct.\n');
    console.log('✨ The vehicle model field now uses VehicleAutocomplete with:');
    console.log('   • Connection to /api/valuations/models endpoint');
    console.log('   • Make query parameter for filtering');
    console.log('   • Disabled state until make is selected');
    console.log('   • Automatic year clearing on model change');
    console.log('   • Preserved validation rules');
    console.log('   • Mobile optimization');
    process.exit(0);
  } else {
    console.log('⚠️  Some checks failed. Please review the implementation.\n');
    process.exit(1);
  }
}

// Run verification
verify();
