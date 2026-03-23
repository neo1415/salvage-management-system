/**
 * Verification script for Task 7.1: Vehicle Make Autocomplete Integration
 * 
 * This script verifies that:
 * 1. VehicleAutocomplete component is imported
 * 2. Vehicle make input is replaced with VehicleAutocomplete
 * 3. onChange handler clears dependent fields (model and year)
 * 4. Required validation is preserved
 * 5. Endpoint is correctly set to /api/valuations/makes
 */

import fs from 'fs';
import path from 'path';

const CASE_CREATION_PAGE_PATH = path.join(
  process.cwd(),
  'src/app/(dashboard)/adjuster/cases/new/page.tsx'
);

function verifyIntegration() {
  console.log('🔍 Verifying Vehicle Make Autocomplete Integration...\n');

  // Read the file
  const content = fs.readFileSync(CASE_CREATION_PAGE_PATH, 'utf-8');

  // Check 1: VehicleAutocomplete import
  const hasImport = content.includes("import { VehicleAutocomplete } from '@/components/ui/vehicle-autocomplete'");
  console.log(`✓ Check 1: VehicleAutocomplete imported: ${hasImport ? '✅' : '❌'}`);

  // Check 2: VehicleAutocomplete component usage
  const hasComponent = content.includes('<VehicleAutocomplete');
  console.log(`✓ Check 2: VehicleAutocomplete component used: ${hasComponent ? '✅' : '❌'}`);

  // Check 3: Correct endpoint
  const hasEndpoint = content.includes('endpoint="/api/valuations/makes"');
  console.log(`✓ Check 3: Correct endpoint (/api/valuations/makes): ${hasEndpoint ? '✅' : '❌'}`);

  // Check 4: onChange handler clears dependent fields
  const hasOnChange = content.includes("setValue('vehicleModel', '')") && 
                      content.includes("setValue('vehicleYear', undefined)");
  console.log(`✓ Check 4: onChange clears model and year: ${hasOnChange ? '✅' : '❌'}`);

  // Check 5: Required prop is set
  const hasRequired = content.match(/name="vehicleMake"[\s\S]*?required/);
  console.log(`✓ Check 5: Required validation preserved: ${hasRequired ? '✅' : '❌'}`);

  // Check 6: Old text input is removed
  const hasOldInput = content.includes('register(\'vehicleMake\')');
  console.log(`✓ Check 6: Old text input removed: ${!hasOldInput ? '✅' : '❌'}`);

  // Check 7: Mobile responsiveness
  const hasMobileCheck = content.includes('isMobile={typeof window !== \'undefined\' && window.innerWidth < 768}');
  console.log(`✓ Check 7: Mobile responsiveness added: ${hasMobileCheck ? '✅' : '❌'}`);

  // Summary
  const allChecks = [
    hasImport,
    hasComponent,
    hasEndpoint,
    hasOnChange,
    hasRequired,
    !hasOldInput,
    hasMobileCheck
  ];

  const passedChecks = allChecks.filter(Boolean).length;
  const totalChecks = allChecks.length;

  console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed`);

  if (passedChecks === totalChecks) {
    console.log('\n✅ All verification checks passed! Task 7.1 is complete.');
    process.exit(0);
  } else {
    console.log('\n❌ Some verification checks failed. Please review the implementation.');
    process.exit(1);
  }
}

verifyIntegration();
