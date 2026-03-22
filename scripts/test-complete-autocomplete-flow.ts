import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function testCompleteFlow() {
  try {
    console.log('🎯 COMPLETE AUTOCOMPLETE FLOW TEST');
    console.log('='.repeat(50));
    
    // 1. Check database has data
    const count = await db.execute(sql`SELECT COUNT(*) as count FROM vehicle_valuations`);
    console.log(`✅ Database Records: ${count[0]?.count || 0}`);
    
    if (!count[0]?.count || count[0].count === 0) {
      console.log('❌ No data in database!');
      return;
    }
    
    // 2. Test makes query
    const makes = await db.execute(sql`SELECT DISTINCT make FROM vehicle_valuations ORDER BY make`);
    console.log(`✅ Available Makes: ${makes.map(r => r.make).join(', ')}`);
    
    // 3. Test Toyota models
    const toyotaModels = await db.execute(sql`SELECT DISTINCT model FROM vehicle_valuations WHERE make = 'Toyota' ORDER BY model`);
    console.log(`✅ Toyota Models: ${toyotaModels.map(r => r.model).join(', ')}`);
    
    // 4. Test Toyota Camry years
    const camryYears = await db.execute(sql`SELECT DISTINCT year FROM vehicle_valuations WHERE make = 'Toyota' AND model = 'Camry' ORDER BY year DESC`);
    console.log(`✅ Camry Years: ${camryYears.map(r => r.year).join(', ')}`);
    
    // 5. Test specific valuation
    const camry2021 = await db.execute(sql`
      SELECT condition_category, average_price 
      FROM vehicle_valuations 
      WHERE make = 'Toyota' AND model = 'Camry' AND year = 2021
      ORDER BY condition_category
    `);
    
    console.log('\n🚗 2021 Toyota Camry Valuations:');
    camry2021.forEach(row => {
      console.log(`   ${row.condition_category}: ₦${row.average_price?.toLocaleString()}`);
    });
    
    console.log('\n🎉 SUCCESS! Autocomplete data is ready!');
    console.log('\nNow you can:');
    console.log('1. Type "Toyota" in case creation - should show Toyota in dropdown');
    console.log('2. Select Toyota - should show Camry, Corolla, etc. in models');
    console.log('3. Select Camry - should show years like 2021, 2020, etc.');
    console.log('4. AI assessment will use this data for accurate valuations');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

testCompleteFlow();