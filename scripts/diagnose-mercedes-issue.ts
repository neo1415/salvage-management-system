import { db } from '../src/lib/db/drizzle.ts';
import { vehicleValuations } from '../src/lib/db/schema/vehicle-valuations.ts';
import { damageDeductions } from '../src/lib/db/schema/vehicle-valuations.ts';
import { eq } from 'drizzle-orm';

async function diagnoseMercedesIssue() {
  console.log('🔍 MERCEDES DIAGNOSTIC');
  console.log('='.repeat(50));
  
  // Check Mercedes in valuations
  const mercedesValuations = await db.select().from(vehicleValuations)
    .where(eq(vehicleValuations.make, 'Mercedes-Benz')).limit(3);
  
  console.log(`Mercedes valuations found: ${mercedesValuations.length}`);
  if (mercedesValuations.length > 0) {
    console.log('Sample Mercedes valuation:', mercedesValuations[0]);
  }
  
  // Check Mercedes in damage deductions
  const mercedesDamage = await db.select().from(damageDeductions)
    .where(eq(damageDeductions.make, 'Mercedes-Benz')).limit(3);
  
  console.log(`Mercedes damage deductions found: ${mercedesDamage.length}`);
  if (mercedesDamage.length > 0) {
    console.log('Sample Mercedes damage:', mercedesDamage[0]);
  }
  
  // Check all makes in valuations
  const allMakes = await db.selectDistinct({ make: vehicleValuations.make }).from(vehicleValuations);
  console.log('All makes in valuations table:', allMakes.map(m => m.make).sort());
  
  // Check price formatting issue
  const sampleWithPrices = await db.select().from(vehicleValuations).limit(5);
  console.log('Sample records with prices:');
  sampleWithPrices.forEach((record, i) => {
    console.log(`${i+1}. ${record.make} ${record.model} ${record.year} - excellent: ${record.excellentPrice}, good: ${record.goodPrice}, fair: ${record.fairPrice}`);
  });
}

diagnoseMercedesIssue().catch(console.error);