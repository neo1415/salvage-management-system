/**
 * Diagnose Analytics 400 Error - Test Zod validation directly
 */

import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// Test with exact parameters from browser
const testParams = {
  assetType: null,
  make: null,
  model: null,
  startDate: '2026-03-07T23:40:16.150Z',
  endDate: '2026-04-06T23:40:16.150Z',
  limit: null,
};

console.log('🧪 Testing Zod validation with browser parameters...\n');
console.log('Input:', JSON.stringify(testParams, null, 2));

const result = querySchema.safeParse(testParams);

console.log('\n📊 Validation Result:');
console.log('Success:', result.success);

if (result.success) {
  console.log('\n✅ Validation PASSED');
  console.log('Parsed data:', JSON.stringify(result.data, null, 2));
} else {
  console.log('\n❌ Validation FAILED');
  console.log('Errors:', JSON.stringify(result.error.issues, null, 2));
}

// Test with undefined values (how searchParams.get() returns)
console.log('\n\n🧪 Testing with undefined values (searchParams.get() behavior)...\n');

const testParams2 = {
  assetType: undefined,
  make: undefined,
  model: undefined,
  startDate: '2026-03-07T23:40:16.150Z',
  endDate: '2026-04-06T23:40:16.150Z',
  limit: undefined,
};

console.log('Input:', JSON.stringify(testParams2, null, 2));

const result2 = querySchema.safeParse(testParams2);

console.log('\n📊 Validation Result:');
console.log('Success:', result2.success);

if (result2.success) {
  console.log('\n✅ Validation PASSED');
  console.log('Parsed data:', JSON.stringify(result2.data, null, 2));
} else {
  console.log('\n❌ Validation FAILED');
  console.log('Errors:', JSON.stringify(result2.error.issues, null, 2));
}
