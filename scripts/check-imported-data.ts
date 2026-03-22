/**
 * Check imported Toyota data
 */

import { config } from 'dotenv';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

config();

async function checkData() {
  try {
    // Count total valuations
    const allValuations = await db.select().from(vehicleValuations);
    console.log(`📊 Total vehicle valuations: ${allValuations.length}`);
    
    // Count by model
    const toyotaValuations = allValuations.filter(v => v.make === 'Toyota');
    console.log(`   Toyota valuations: ${toyotaValuations.length}`);
    
    const models = [...new Set(toyotaValuations.map(v => v.model))];
    console.log(`   Models: ${models.join(', ')}`);
    
    for (const model of models) {
      const count = toyotaValuations.filter(v => v.model === model).length;
      console.log(`     - ${model}: ${count} records`);
    }
    
    // Count deductions
    const allDeductions = await db.select().from(damageDeductions);
    console.log(`\n🔧 Total damage deductions: ${allDeductions.length}`);
    
    const byLevel = {
      minor: allDeductions.filter(d => d.damageLevel === 'minor').length,
      moderate: allDeductions.filter(d => d.damageLevel === 'moderate').length,
      severe: allDeductions.filter(d => d.damageLevel === 'severe').length,
    };
    console.log(`   By level: Minor=${byLevel.minor}, Moderate=${byLevel.moderate}, Severe=${byLevel.severe}`);
    
    console.log('\n✅ Data check complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkData();
