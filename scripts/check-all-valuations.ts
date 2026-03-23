/**
 * Check all valuations in the database
 */

import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';

async function checkAllValuations() {
  console.log('🔍 Checking all valuations in database...\n');
  
  try {
    const valuations = await db
      .select()
      .from(vehicleValuations)
      .orderBy(vehicleValuations.make, vehicleValuations.model, vehicleValuations.year);
    
    console.log(`📊 Total valuations: ${valuations.length}\n`);
    
    if (valuations.length === 0) {
      console.log('❌ Database is empty!');
      return;
    }
    
    console.log('='.repeat(100));
    
    for (const val of valuations) {
      console.log(`\n🚗 ${val.make} ${val.model} ${val.year} (${val.conditionCategory})`);
      console.log(`   Low:     ₦${parseFloat(val.lowPrice).toLocaleString()}`);
      console.log(`   Average: ₦${parseFloat(val.averagePrice).toLocaleString()}`);
      console.log(`   High:    ₦${parseFloat(val.highPrice).toLocaleString()}`);
      console.log(`   Source:  ${val.dataSource}`);
      if (val.mileageLow || val.mileageHigh) {
        console.log(`   Mileage: ${val.mileageLow?.toLocaleString() || 'N/A'} - ${val.mileageHigh?.toLocaleString() || 'N/A'} km`);
      }
      if (val.marketNotes) {
        console.log(`   Notes:   ${val.marketNotes}`);
      }
    }
    
    console.log('\n' + '='.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllValuations()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
