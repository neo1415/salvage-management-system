import { db } from '../src/lib/db/index.js';
import { assetPerformanceAnalytics } from '../src/lib/db/schema/analytics.js';

async function checkDates() {
  const result = await db.select().from(assetPerformanceAnalytics).limit(3);
  console.log('Sample analytics data:');
  result.forEach((row: any) => {
    console.log(`  Asset: ${row.assetType}, Period: ${row.periodStart} to ${row.periodEnd}`);
  });
  process.exit(0);
}

checkDates();
