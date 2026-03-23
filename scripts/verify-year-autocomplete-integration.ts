/**
 * Verification Script: Year Autocomplete Integration
 * 
 * This script verifies that the vehicle year input has been successfully
 * replaced with VehicleAutocomplete component in the case creation form.
 * 
 * Checks:
 * 1. VehicleAutocomplete component is imported
 * 2. Year field uses VehicleAutocomplete instead of text input
 * 3. Component is connected to /api/valuations/years endpoint
 * 4. Component is disabled until make and model are selected
 * 5. Component passes make and model as query parameters
 * 6. Component preserves existing validation rules
 */

import fs from 'fs';
import path from 'path';

const CASE_CREATION_FORM_PATH = path.join(
  process.cwd(),
  'src/app/(dashboard)/adjuster/cases/new/page.tsx'
);

interface VerificationResult {
  check: string;
  passed: boolean;
  details?: string;
}

const results: VerificationResult[] = [];

console.log('🔍 Verifying Year Autocomplete Integration...\n');

// Read the case creation form file
const fileContent = fs.readFileSync(CASE_CREATION_FORM_PATH, 'utf-8');

// Check 1: VehicleAutocomplete is imported
const importCheck = fileContent.includes("import { VehicleAutocomplete } from '@/components/ui/vehicle-autocomplete'");
results.push({
  check: 'VehicleAutocomplete component is imported',
  passed: importCheck,
  details: importCheck ? 'Found import statement' : 'Import statement not found',
});

// Check 2: Year field uses VehicleAutocomplete
const yearAutocompleteCheck = fileContent.includes('<VehicleAutocomplete') && 
                               fileContent.includes('name="vehicleYear"');
results.push({
  check: 'Year field uses VehicleAutocomplete component',
  passed: yearAutocompleteCheck,
  details: yearAutocompleteCheck ? 'Found VehicleAutocomplete with name="vehicleYear"' : 'VehicleAutocomplete not found for year field',
});

// Check 3: Connected to correct endpoint
const endpointCheck = fileContent.includes('endpoint="/api/valuations/years"');
results.push({
  check: 'Component connected to /api/valuations/years endpoint',
  passed: endpointCheck,
  details: endpointCheck ? 'Correct endpoint configured' : 'Endpoint not found or incorrect',
});

// Check 4: Disabled until make and model are selected
const disabledCheck = fileContent.includes("disabled={!watch('vehicleMake') || !watch('vehicleModel')}");
results.push({
  check: 'Component disabled until make and model are selected',
  passed: disabledCheck,
  details: disabledCheck ? 'Correct disabled logic found' : 'Disabled logic not found or incorrect',
});

// Check 5: Query parameters include make and model
const queryParamsCheck = fileContent.includes("make: watch('vehicleMake')") && 
                         fileContent.includes("model: watch('vehicleModel')");
results.push({
  check: 'Component passes make and model as query parameters',
  passed: queryParamsCheck,
  details: queryParamsCheck ? 'Query parameters correctly configured' : 'Query parameters not found or incorrect',
});

// Check 6: Required validation preserved
const requiredCheck = fileContent.match(/name="vehicleYear"[\s\S]*?required/);
results.push({
  check: 'Required validation preserved',
  passed: !!requiredCheck,
  details: requiredCheck ? 'Required prop found' : 'Required prop not found',
});

// Check 7: Mobile optimization
const mobileCheck = fileContent.includes('isMobile={typeof window !== \'undefined\' && window.innerWidth < 768}');
results.push({
  check: 'Mobile optimization enabled',
  passed: mobileCheck,
  details: mobileCheck ? 'isMobile prop configured' : 'isMobile prop not found',
});

// Check 8: Value conversion (string to number)
const valueConversionCheck = fileContent.includes("value={watch('vehicleYear')?.toString() || ''}") &&
                             fileContent.includes("onChange={(value) => setValue('vehicleYear', parseInt(value))}");
results.push({
  check: 'Value conversion (string ↔ number) implemented',
  passed: valueConversionCheck,
  details: valueConversionCheck ? 'Correct value conversion logic' : 'Value conversion logic not found or incorrect',
});

// Check 9: Old text input removed (check specifically for vehicleYear with register)
const oldInputCheck = !fileContent.match(/register\(['"]vehicleYear['"]/);
results.push({
  check: 'Old text input removed (no register for vehicleYear)',
  passed: oldInputCheck,
  details: oldInputCheck ? 'No old register-based input found for vehicleYear' : 'Old register-based input still present for vehicleYear',
});

// Print results
console.log('📊 Verification Results:\n');
let allPassed = true;

results.forEach((result, index) => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${index + 1}. ${result.check}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
  if (!result.passed) {
    allPassed = false;
  }
  console.log('');
});

// Summary
console.log('━'.repeat(60));
if (allPassed) {
  console.log('✅ All checks passed! Year autocomplete integration is complete.');
  console.log('\n📝 Summary:');
  console.log('   - VehicleAutocomplete component is properly integrated');
  console.log('   - Connected to /api/valuations/years endpoint');
  console.log('   - Disabled until make and model are selected');
  console.log('   - Query parameters correctly configured');
  console.log('   - Validation rules preserved');
  console.log('   - Mobile optimization enabled');
  console.log('   - Value conversion implemented');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the implementation.');
  process.exit(1);
}
