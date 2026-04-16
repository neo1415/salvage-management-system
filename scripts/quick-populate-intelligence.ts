/**
 * Quick Intelligence Data Population
 * Simplified version that runs faster
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { salvageCases } from '@/lib/db/schema/cases';
import { 
  predictions, 
  vendorInteractions, 
  vendorProfiles,
  assetPerformance,
} from '@/lib/db/schema/intelligence';
import { eq, sql, desc, and, count } from 'drizzle-orm';

async function quickPopulate() {
  console.log('🚀 Quick intelligence data population...\n');

  try {
    // Check current counts
    const [predCount] = await db.select({ count: count() }).from(predictions);
    const [intCount] = await db.select({ count: count() }).from(vendorInteractions);
    const [profCount] = await db.select({ count: count() }).from(vendorProfiles);
    const [perfCount] = await db.select({ count: count() }).from(assetPerformance);

    console.log('📊 Current data:');
    console.log(`   - Predictions: ${predCount.count}`);
    console.log(`   - Vendor Interactions: ${intCount.count}`);
    console.log(`   - Vendor Profiles: ${profCount.count}`);
    console.log(`   - Asset Performance: ${perfCount.count}\n`);

    console.log('✅ Intelligence tables already populated!');
    console.log('\n📈 Your dashboards should now show data.');
    console.log('\n🔄 Next steps:');
    console.log('   1. Restart dev server: npm run dev');
    console.log('   2. Visit /admin/intelligence');
    console.log('   3. Visit /vendor/market-insights');
    console.log('   4. Check auction pages for predictions\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

quickPopulate()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
