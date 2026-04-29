import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('=== Diagnosing 0.0 Days Issue ===\n');

  // Get sample cases with processing time data
  const cases = await db
    .select({
      id: salvageCases.id,
      claimReference: salvageCases.claimReference,
      assetType: salvageCases.assetType,
      status: salvageCases.status,
      createdAt: salvageCases.createdAt,
      approvedAt: salvageCases.approvedAt,
      marketValue: salvageCases.marketValue,
      estimatedSalvageValue: salvageCases.estimatedSalvageValue,
    })
    .from(salvageCases)
    .where(sql`${salvageCases.status} != 'draft'`)
    .limit(10);

  console.log(`Found ${cases.length} non-draft cases\n`);

  for (const c of cases) {
    const processingTimeMs = c.approvedAt && c.createdAt 
      ? c.approvedAt.getTime() - c.createdAt.getTime()
      : null;
    
    const processingTimeHours = processingTimeMs ? processingTimeMs / (1000 * 60 * 60) : null;
    const processingTimeDays = processingTimeHours ? processingTimeHours / 24 : null;

    console.log(`Case: ${c.claimReference}`);
    console.log(`  Asset Type: ${c.assetType}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  Created: ${c.createdAt?.toISOString()}`);
    console.log(`  Approved: ${c.approvedAt?.toISOString() || 'NOT APPROVED'}`);
    console.log(`  Processing Time: ${processingTimeDays?.toFixed(2) || 'N/A'} days`);
    console.log(`  Market Value: ₦${parseFloat(c.marketValue || '0').toLocaleString()}`);
    console.log(`  Salvage Value: ₦${parseFloat(c.estimatedSalvageValue || '0').toLocaleString()}`);
    console.log('');
  }

  // Get stats by asset type
  console.log('\n=== Stats by Asset Type ===\n');
  
  const stats = await db.execute(sql`
    SELECT 
      asset_type,
      COUNT(*) as total_cases,
      COUNT(approved_at) as approved_cases,
      AVG(
        CASE 
          WHEN approved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400.0
          ELSE NULL
        END
      ) as avg_days,
      SUM(CAST(market_value AS NUMERIC)) as total_market_value,
      SUM(CAST(estimated_salvage_value AS NUMERIC)) as total_salvage_value
    FROM salvage_cases
    WHERE status != 'draft'
    GROUP BY asset_type
    ORDER BY asset_type
  `);

  for (const row of stats as any[]) {
    console.log(`${row.asset_type}:`);
    console.log(`  Total Cases: ${row.total_cases}`);
    console.log(`  Approved Cases: ${row.approved_cases}`);
    console.log(`  Avg Processing Days: ${parseFloat(row.avg_days || '0').toFixed(2)}`);
    console.log(`  Total Market Value: ₦${parseFloat(row.total_market_value || '0').toLocaleString()}`);
    console.log(`  Total Salvage Value: ₦${parseFloat(row.total_salvage_value || '0').toLocaleString()}`);
    console.log('');
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
