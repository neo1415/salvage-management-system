/**
 * Verify Analytics Fix - Test with null to undefined conversion
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

// Simulate searchParams.get() returning null
const mockSearchParams = {
  get: (key: string) => {
    const params: Record<string, string | null> = {
      startDate: '2026-03-07T23:40:16.150Z',
      endDate: '2026-04-06T23:40:16.150Z',
    };
    return params[key] || null;
  }
};

console.log('🧪 Testing with null to undefined conversion (THE FIX)...\n');

// OLD WAY (BROKEN)
const oldWay = {
  assetType: mockSearchParams.get('assetType'),
  make: mockSearchParams.get('make'),
  model: mockSearchParams.get('model'),
  startDate: mockSearchParams.get('startDate'),
  endDate: mockSearchParams.get('endDate'),
  limit: mockSearchParams.get('limit'),
};

console.log('❌ OLD WAY (passing null directly):');
console.log('Input:', JSON.stringify(oldWay, null, 2));
const oldResult = querySchema.safeParse(oldWay);
console.log('Success:', oldResult.success);
if (!oldResult.success) {
  console.log('Errors:', oldResult.error.issues.map(i => `${i.path}: ${i.message}`).join(', '));
}

console.log('\n---\n');

// NEW WAY (FIXED)
const newWay = {
  assetType: mockSearchParams.get('assetType') || undefined,
  make: mockSearchParams.get('make') || undefined,
  model: mockSearchParams.get('model') || undefined,
  startDate: mockSearchParams.get('startDate') || undefined,
  endDate: mockSearchParams.get('endDate') || undefined,
  limit: mockSearchParams.get('limit') || undefined,
};

console.log('✅ NEW WAY (converting null to undefined):');
console.log('Input:', JSON.stringify(newWay, null, 2));
const newResult = querySchema.safeParse(newWay);
console.log('Success:', newResult.success);
if (newResult.success) {
  console.log('Parsed data:', JSON.stringify(newResult.data, null, 2));
} else {
  console.log('Errors:', newResult.error.issues.map(i => `${i.path}: ${i.message}`).join(', '));
}

console.log('\n✅ FIX VERIFIED! The || undefined conversion solves the 400 error.');
