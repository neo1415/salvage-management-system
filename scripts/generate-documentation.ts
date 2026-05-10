#!/usr/bin/env ts-node
/**
 * CLI Script to Generate Comprehensive Application Documentation
 * 
 * Usage:
 *   npm run generate-docs
 *   or
 *   npx ts-node scripts/generate-documentation.ts
 */

import { generateDocumentation } from '../src/features/documentation/generator/documentation-generator';
import * as path from 'path';

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Comprehensive Application Documentation Generator            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const rootPath = path.resolve(__dirname, '..');
    const outputPath = path.join(rootPath, 'docs', 'COMPREHENSIVE_APPLICATION_DOCUMENTATION.md');

    const documentation = await generateDocumentation({
      rootPath,
      outputPath,
      scanOptions: {
        includePatterns: [
          'src/**/*.ts',
          'src/**/*.tsx',
        ],
        excludePatterns: [
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/tests/**',
        ],
        followImports: true,
      },
    });

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ Documentation Generation Complete!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📊 Size: ${(documentation.length / 1024).toFixed(2)} KB`);
    console.log(`📝 Lines: ${documentation.split('\n').length}`);
    console.log('\n✨ Your comprehensive application documentation is ready!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating documentation:', error);
    process.exit(1);
  }
}

main();
