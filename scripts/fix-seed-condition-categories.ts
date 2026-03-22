/**
 * Fix Seed Scripts Condition Categories
 * 
 * Updates all seed scripts to use correct condition categories:
 * - nig_used_low -> fair
 * - tokunbo_low -> good
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

async function fixSeedConditionCategories() {
  console.log('🔧 FIXING SEED CONDITION CATEGORIES');
  console.log('='.repeat(60));
  
  try {
    // Find all valuation seed scripts
    const seedFiles = await glob('scripts/seeds/**/*-valuations.seed.ts');
    console.log(`Found ${seedFiles.length} seed files to update:`);
    
    for (const file of seedFiles) {
      console.log(`\n📝 Updating ${file}...`);
      
      let content = readFileSync(file, 'utf8');
      let updated = false;
      
      // Replace nig_used_low with fair
      if (content.includes("conditionCategory: 'nig_used_low'")) {
        content = content.replace(/conditionCategory: 'nig_used_low'/g, "conditionCategory: 'fair'");
        updated = true;
        console.log('   ✅ Updated nig_used_low -> fair');
      }
      
      // Replace tokunbo_low with good
      if (content.includes("conditionCategory: 'tokunbo_low'")) {
        content = content.replace(/conditionCategory: 'tokunbo_low'/g, "conditionCategory: 'good'");
        updated = true;
        console.log('   ✅ Updated tokunbo_low -> good');
      }
      
      if (updated) {
        writeFileSync(file, content);
        console.log('   💾 File saved');
      } else {
        console.log('   ⏭️  No changes needed');
      }
    }
    
    console.log('\n✅ All seed files updated!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSeedConditionCategories();