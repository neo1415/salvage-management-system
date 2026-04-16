/**
 * Script to fix all intelligence API test files
 * Replaces next-auth mocking with @/lib/auth mocking
 */

import { readFileSync, writeFileSync } from 'fs';

const testFiles = [
  'tests/integration/intelligence/api/recommendation.api.test.ts',
  'tests/integration/intelligence/api/interactions.api.test.ts',
  'tests/integration/intelligence/api/admin.api.test.ts',
  'tests/integration/intelligence/api/privacy.api.test.ts',
];

function fixTestFile(filePath: string): void {
  console.log(`\nFixing: ${filePath}`);
  let content = readFileSync(filePath, 'utf-8');
  
  // Replace next-auth mock with @/lib/auth mock
  content = content.replace(
    /\/\/ Mock next-auth[\s\S]*?vi\.mock\('next-auth'[\s\S]*?\}\);/,
    `// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));`
  );
  
  // Replace getServerSession imports with auth
  content = content.replace(
    /const { getServerSession } = await import\('next-auth'\);/g,
    `const { auth } = await import('@/lib/auth');`
  );
  
  // Replace getServerSession calls with auth calls
  content = content.replace(
    /vi\.mocked\(getServerSession\)/g,
    'vi.mocked(auth)'
  );
  
  // Fix service mocking to use proper class constructor
  content = content.replace(
    /vi\.fn\(\)\.mockImplementation\(\(\) => \(\{/g,
    'vi.fn(function(this: any) {'
  );
  
  content = content.replace(
    /\}\)\),/g,
    '} as any),'
  );
  
  // Fix inline mockImplementation calls
  content = content.replace(
    /\.mockImplementation\(\(\) => \(\{([^}]+)\}\) as any\);/g,
    '.mockImplementation(function(this: any) {$1} as any);'
  );
  
  writeFileSync(filePath, content, 'utf-8');
  console.log(`✓ Fixed: ${filePath}`);
}

console.log('Starting test file fixes...\n');

for (const file of testFiles) {
  try {
    fixTestFile(file);
  } catch (error) {
    console.error(`✗ Error fixing ${file}:`, error);
  }
}

console.log('\n✓ All test files fixed');
