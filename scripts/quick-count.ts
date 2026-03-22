import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations';
import { sql, eq } from 'drizzle-orm';

async function quickCount() {
  const total = await db.select({ count: sql`count(*)` }).from(vehicleValuations);
  console.log('Total vehicle valuations:', total[0].count);
  
  const byMake = await db.select({ 
    make: vehicleValuations.make, 
    count: sql`count(*)` 
  })
  .from(vehicleValuations)
  .groupBy(vehicleValuations.make);
  
  console.log('\nBy make:');
  byMake.forEach(row => console.log(`  ${row.make}: ${row.count}`));
  
  process.exit(0);
}

quickCount();
