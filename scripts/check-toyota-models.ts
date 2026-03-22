import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations';
import { eq, sql } from 'drizzle-orm';

async function checkToyotaModels() {
  const result = await db
    .select({ 
      model: vehicleValuations.model, 
      count: sql`count(*)` 
    })
    .from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Toyota'))
    .groupBy(vehicleValuations.model);
  
  console.log('Toyota models in database:');
  result.forEach(row => console.log(`  ${row.model}: ${row.count}`));
  
  const total = result.reduce((sum, row) => sum + Number(row.count), 0);
  console.log(`\nTotal Toyota records: ${total}`);
  console.log('\nMissing models: Highlander, RAV4, Sienna, Land Cruiser, Prado, Venza, Avalon');
  
  process.exit(0);
}

checkToyotaModels();
