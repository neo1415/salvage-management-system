/**
 * Test script to verify the scanner works
 * Run with: tsx src/features/documentation/scanner/test-scanner.ts
 */

import { scanCodebase, printInventorySummary } from './index';

async function main() {
  try {
    console.log('Testing Codebase Scanner...\n');

    // Scan the codebase
    const inventory = await scanCodebase(process.cwd());

    // Print summary
    printInventorySummary(inventory);

    // Print some example files
    console.log('\n=== Example Entry Points ===\n');
    const entryPoints = [
      ...inventory.categorizedFiles.apiRoutes,
      ...inventory.categorizedFiles.components,
    ]
      .filter((f) => f.isActive && f.importedBy.length === 0)
      .slice(0, 5);

    for (const file of entryPoints) {
      console.log(`${file.path}`);
      console.log(`  Type: ${file.type}`);
      console.log(`  Active: ${file.isActive}`);
      console.log(`  Imports: ${file.imports.length} files`);
      console.log(`  Imported by: ${file.importedBy.length} files`);
      console.log('');
    }

    // Print potentially abandoned files
    console.log('\n=== Potentially Abandoned Files (first 10) ===\n');
    const abandonedFiles = Object.entries(inventory.activeCodeMap)
      .filter(([_, info]) => !info.isActive && info.confidence === 'low')
      .slice(0, 10);

    for (const [path, info] of abandonedFiles) {
      console.log(`${path}`);
      console.log(`  Reason: ${info.reason}`);
      console.log('');
    }

    console.log('\nScanner test complete!');
  } catch (error) {
    console.error('Error testing scanner:', error);
    process.exit(1);
  }
}

main();
