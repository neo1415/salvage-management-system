/**
 * Test Similarity Query
 * 
 * This script tests the actual similarity query used by the prediction service
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { eq, sql } from 'drizzle-orm';

async function testSimilarityQuery() {
  console.log('🔬 Testing Similarity Query...\n');

  try {
    // Get a test auction
    const testAuction = await db
      .select({
        id: auctions.id,
        caseId: auctions.caseId,
      })
      .from(auctions)
      .where(eq(auctions.id, '41e76732-2aec-462d-9950-8a700546629c'))
      .limit(1);

    if (!testAuction[0]) {
      console.log('Test auction not found');
      return;
    }

    // Get case details
    const caseData = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, testAuction[0].caseId))
      .limit(1);

    if (!caseData[0]) {
      console.log('Case data not found');
      return;
    }

    const assetType = caseData[0].assetType;
    const assetDetails = caseData[0].assetDetails || {};
    const targetMake = assetDetails.make || '';
    const targetModel = assetDetails.model || '';
    const targetYear = assetDetails.year ? parseInt(assetDetails.year) : 0;
    const targetDamage = caseData[0].damageSeverity;
    const targetMarketValue = caseData[0].marketValue ? parseFloat(caseData[0].marketValue) : 0;
    const targetColor = assetDetails.color;
    const targetTrim = assetDetails.trim;

    console.log('Test Auction Details:');
    console.log(`  Asset Type: ${assetType}`);
    console.log(`  Make: ${targetMake}`);
    console.log(`  Model: ${targetModel}`);
    console.log(`  Year: ${targetYear}`);
    console.log(`  Damage: ${targetDamage}`);
    console.log(`  Market Value: ${targetMarketValue}`);
    console.log(`  Color: ${targetColor}`);
    console.log(`  Trim: ${targetTrim}\n`);

    // Calculate date threshold
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoISO = twelveMonthsAgo.toISOString();

    const marketValueNumeric = Number(targetMarketValue) || 0;
    const similarityThreshold = 60;
    const timeDecayMonths = 6;

    // Build the exact query used by prediction service
    const query = sql`
      WITH similar_auctions AS (
        SELECT 
          a.id AS auction_id,
          a.current_bid AS final_price,
          sc.asset_details,
          sc.damage_severity,
          sc.market_value,
          a.end_time,
          COUNT(b.id) AS bid_count,
          (
            CASE 
              WHEN sc.asset_details->>'make' = ${targetMake} 
               AND sc.asset_details->>'model' = ${targetModel} THEN 100
              WHEN sc.asset_details->>'make' = ${targetMake} THEN 50
              ELSE 0
            END +
            CASE 
              WHEN (sc.asset_details->>'year')::int = ${targetYear} THEN 20
              WHEN ABS((sc.asset_details->>'year')::int - ${targetYear}) = 1 THEN 15
              WHEN ABS((sc.asset_details->>'year')::int - ${targetYear}) = 2 THEN 10
              ELSE 0
            END +
            CASE 
              WHEN sc.damage_severity = ${targetDamage} THEN 30
              WHEN (
                (sc.damage_severity = 'minor' AND ${targetDamage} = 'moderate') OR
                (sc.damage_severity = 'moderate' AND ${targetDamage} IN ('minor', 'severe')) OR
                (sc.damage_severity = 'severe' AND ${targetDamage} = 'moderate')
              ) THEN 15
              ELSE 0
            END +
            CASE 
              WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 10
              ELSE 0
            END +
            CASE 
              WHEN ${targetColor ? sql`sc.asset_details->>'color' = ${targetColor}` : sql`FALSE`} THEN 5
              ELSE 0
            END +
            CASE 
              WHEN ${targetTrim ? sql`sc.asset_details->>'trim' = ${targetTrim}` : sql`FALSE`} THEN 8
              ELSE 0
            END
          ) AS similarity_score,
          EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (${timeDecayMonths} * 30 * 24 * 60 * 60)) AS time_weight
        FROM ${auctions} a
        INNER JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE 
          a.status = 'closed'
          AND a.current_bid IS NOT NULL
          AND sc.asset_type = ${assetType}
          AND a.end_time > ${twelveMonthsAgoISO}
          AND a.id != ${testAuction[0].id}
        GROUP BY a.id, sc.id
      )
      SELECT 
        auction_id,
        final_price,
        similarity_score,
        time_weight,
        damage_severity
      FROM similar_auctions
      ORDER BY similarity_score DESC, time_weight DESC
      LIMIT 20
    `;

    console.log('Running similarity query...\n');
    const results: any = await db.execute(query);

    console.log(`Found ${results.length} auctions (before threshold filter)\n`);

    if (results.length > 0) {
      console.log('Top matches:');
      for (const row of results.slice(0, 10)) {
        const score = parseFloat(row.similarity_score);
        const meetsThreshold = score >= similarityThreshold;
        console.log(`  Score: ${score.toFixed(1)} ${meetsThreshold ? '✅' : '❌'} - Price: ₦${row.final_price} - Damage: ${row.damage_severity}`);
      }

      const aboveThreshold = results.filter((r: any) => parseFloat(r.similarity_score) >= similarityThreshold);
      console.log(`\n${aboveThreshold.length} auctions meet threshold of ${similarityThreshold}`);
    } else {
      console.log('No similar auctions found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
testSimilarityQuery()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
