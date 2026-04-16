import { db } from '@/lib/db';

async function testAnalyticsEndpoint() {
  console.log('🔍 Testing Analytics API Endpoint Validation\n');

  // Test the date format that the frontend is sending
  const testDate = '2026-03-07T23:12:52.484Z';
  console.log('Test date from frontend:', testDate);
  console.log('Is valid ISO string:', !isNaN(Date.parse(testDate)));
  console.log('Parsed date:', new Date(testDate));

  // Check if there's any data in the analytics tables
  console.log('\n📊 Checking analytics tables for data...\n');

  try {
    const assetPerf = await db.execute(sql`SELECT COUNT(*) as count FROM asset_performance_analytics`);
    console.log('asset_performance_analytics:', assetPerf[0]);

    const attrPerf = await db.execute(sql`SELECT COUNT(*) as count FROM attribute_performance_analytics`);
    console.log('attribute_performance_analytics:', attrPerf[0]);

    const temporal = await db.execute(sql`SELECT COUNT(*) as count FROM temporal_patterns_analytics`);
    console.log('temporal_patterns_analytics:', temporal[0]);

    const geo = await db.execute(sql`SELECT COUNT(*) as count FROM geographic_patterns_analytics`);
    console.log('geographic_patterns_analytics:', geo[0]);

    const vendors = await db.execute(sql`SELECT COUNT(*) as count FROM vendor_segments`);
    console.log('vendor_segments:', vendors[0]);

    const funnel = await db.execute(sql`SELECT COUNT(*) as count FROM conversion_funnel_analytics`);
    console.log('conversion_funnel_analytics:', funnel[0]);

    const sessions = await db.execute(sql`SELECT COUNT(*) as count FROM session_analytics`);
    console.log('session_analytics:', sessions[0]);

  } catch (error) {
    console.error('Error checking tables:', error);
  }

  await db.$client.end();
}

testAnalyticsEndpoint();
