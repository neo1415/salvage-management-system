/**
 * Fix Script: Market Intelligence Authorization
 * 
 * Adds vendor role to analytics API routes so vendors can access
 * the Market Intelligence dashboard
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixMarketIntelligenceAuth() {
  console.log('🔧 FIXING MARKET INTELLIGENCE AUTHORIZATION\n');
  console.log('=' .repeat(60));

  const apiRoutes = [
    'src/app/api/intelligence/analytics/asset-performance/route.ts',
    'src/app/api/intelligence/analytics/temporal-patterns/route.ts',
    'src/app/api/intelligence/analytics/geographic-patterns/route.ts',
  ];

  for (const routePath of apiRoutes) {
    console.log(`\n📝 Processing: ${routePath}`);
    console.log('-'.repeat(60));

    try {
      const fullPath = join(process.cwd(), routePath);
      let content = await readFile(fullPath, 'utf-8');

      // Check if vendor role is already included
      if (content.includes("'vendor'") && content.includes('allowedRoles')) {
        console.log('⏭️  Vendor role already included, skipping');
        continue;
      }

      // Find and replace the allowedRoles array
      const oldPattern = /const allowedRoles = \['system_admin', 'salvage_manager', 'finance_officer'\];/;
      const newPattern = "const allowedRoles = ['system_admin', 'salvage_manager', 'finance_officer', 'vendor'];";

      if (oldPattern.test(content)) {
        content = content.replace(oldPattern, newPattern);
        await writeFile(fullPath, content, 'utf-8');
        console.log('✅ Added vendor role to allowedRoles');
      } else {
        console.log('⚠️  Could not find allowedRoles pattern, may need manual update');
      }
    } catch (error) {
      console.error(`❌ Error processing ${routePath}:`, error);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log('\nFixes Applied:');
  console.log('✅ Added vendor role to analytics API routes');
  console.log('\nNext Steps:');
  console.log('1. Test Market Intelligence dashboard as vendor user');
  console.log('2. Verify data is displayed in all sections');
}

fixMarketIntelligenceAuth()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
