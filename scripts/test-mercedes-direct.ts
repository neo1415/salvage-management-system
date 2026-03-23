import { db } from '../src/lib/db/drizzle.ts';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations.ts';
import { eq } from 'drizzle-orm';

async function testMercedesDirect() {
  console.log('🔍 DIRECT DATABASE TEST');
  console.log('='.repeat(50));
  
  // Get all makes
  const allMakes = await db.selectDistinct({ make: vehicleValuations.make })
    .from(vehicleValuations)
    .orderBy(vehicleValuations.make);
  
  console.log('All makes in database:', allMakes.map(m => m.make));
  
  // Test Mercedes specifically
  const mercedesModels = await db.selectDistinct({ model: vehicleValuations.model })
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Mercedes-Benz'))
    .orderBy(vehicleValuations.model);
  
  console.log(`Mercedes models found: ${mercedesModels.length}`);
  console.log('Mercedes models:', mercedesModels.map(m => m.model));
  
  // Test GLE 350 specifically
  const gle350 = await db.select()
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Mercedes-Benz'))
    .limit(5);
  
  console.log(`Mercedes records: ${gle350.length}`);
  gle350.forEach(record => {
    console.log(`${record.year} ${record.make} ${record.model} (${record.conditionCategory}): ₦${record.averagePrice}`);
  });
}

testMercedesDirect().catch(console.error);