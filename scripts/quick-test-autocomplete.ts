import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function quickTest() {
  try {
    console.log('🧪 Quick Autocomplete Test');
    
    // Check vehicle valuations count
    const count = await db.execute(sql`SELECT COUNT(*) as count FROM vehicle_valuations`);
    console.log(`📊 Vehicle Valuations: ${count[0]?.count || 0}`);
    
    // Check makes
    const makes = await db.execute(sql`SELECT DISTINCT make FROM vehicle_valuations ORDER BY make`);
    console.log(`🚗 Makes: ${makes.map(r => r.make).join(', ')}`);
    
    // Check Toyota models
    const toyotaModels = await db.execute(sql`SELECT DISTINCT model FROM vehicle_valuations WHERE make = 'Toyota' ORDER BY model`);
    console.log(`🚙 Toyota Models: ${toyotaModels.map(r => r.model).join(', ')}`);
    
    // Test a specific query
    const camryData = await db.execute(sql`
      SELECT year, condition_category, average_price 
      FROM vehicle_valuations 
      WHERE make = 'Toyota' AND model = 'Camry' 
      ORDER BY year DESC, condition_category
      LIMIT 5
    `);
    
    console.log('\n🔍 Sample Toyota Camry Data:');
    camryData.forEach(row => {
      console.log(`   ${row.year} Camry (${row.condition_category}): ₦${row.average_price?.toLocaleString()}`);
    });
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

quickTest();