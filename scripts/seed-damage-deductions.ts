/**
 * Seed Damage Deductions
 * 
 * Populates the damage_deductions table with standard deduction values
 * for common vehicle components and damage levels.
 */

import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const STANDARD_DEDUCTIONS = [
  // Engine
  { component: 'engine', damageLevel: 'minor' as const, repairCost: '200000', deduction: '0.05', description: 'Minor engine issues (oil leaks, minor wear)' },
  { component: 'engine', damageLevel: 'moderate' as const, repairCost: '500000', deduction: '0.15', description: 'Moderate engine damage (timing issues, compression loss)' },
  { component: 'engine', damageLevel: 'severe' as const, repairCost: '1500000', deduction: '0.30', description: 'Severe engine damage (requires rebuild or replacement)' },

  // Transmission
  { component: 'transmission', damageLevel: 'minor' as const, repairCost: '150000', deduction: '0.05', description: 'Minor transmission issues (fluid leaks, minor slipping)' },
  { component: 'transmission', damageLevel: 'moderate' as const, repairCost: '400000', deduction: '0.15', description: 'Moderate transmission damage (gear issues, significant slipping)' },
  { component: 'transmission', damageLevel: 'severe' as const, repairCost: '1200000', deduction: '0.30', description: 'Severe transmission damage (requires rebuild or replacement)' },

  // Body
  { component: 'body', damageLevel: 'minor' as const, repairCost: '100000', deduction: '0.03', description: 'Minor body damage (small dents, scratches)' },
  { component: 'body', damageLevel: 'moderate' as const, repairCost: '300000', deduction: '0.10', description: 'Moderate body damage (large dents, panel replacement needed)' },
  { component: 'body', damageLevel: 'severe' as const, repairCost: '800000', deduction: '0.25', description: 'Severe body damage (multiple panels, extensive repair)' },

  // Structure/Frame
  { component: 'structure', damageLevel: 'minor' as const, repairCost: '200000', deduction: '0.10', description: 'Minor structural issues (minor frame bending)' },
  { component: 'structure', damageLevel: 'moderate' as const, repairCost: '600000', deduction: '0.25', description: 'Moderate structural damage (frame straightening required)' },
  { component: 'structure', damageLevel: 'severe' as const, repairCost: '2000000', deduction: '0.40', description: 'Severe structural damage (frame replacement, total loss risk)' },

  // Suspension
  { component: 'suspension', damageLevel: 'minor' as const, repairCost: '80000', deduction: '0.03', description: 'Minor suspension issues (worn bushings, minor alignment)' },
  { component: 'suspension', damageLevel: 'moderate' as const, repairCost: '250000', deduction: '0.08', description: 'Moderate suspension damage (strut replacement, major alignment)' },
  { component: 'suspension', damageLevel: 'severe' as const, repairCost: '600000', deduction: '0.20', description: 'Severe suspension damage (complete system replacement)' },

  // Brakes
  { component: 'brakes', damageLevel: 'minor' as const, repairCost: '50000', deduction: '0.02', description: 'Minor brake issues (pad replacement, minor rotor wear)' },
  { component: 'brakes', damageLevel: 'moderate' as const, repairCost: '150000', deduction: '0.05', description: 'Moderate brake damage (rotor replacement, caliper issues)' },
  { component: 'brakes', damageLevel: 'severe' as const, repairCost: '400000', deduction: '0.15', description: 'Severe brake damage (complete system replacement, ABS issues)' },

  // Electrical
  { component: 'electrical', damageLevel: 'minor' as const, repairCost: '60000', deduction: '0.03', description: 'Minor electrical issues (battery, alternator, minor wiring)' },
  { component: 'electrical', damageLevel: 'moderate' as const, repairCost: '200000', deduction: '0.08', description: 'Moderate electrical damage (ECU issues, major wiring problems)' },
  { component: 'electrical', damageLevel: 'severe' as const, repairCost: '500000', deduction: '0.20', description: 'Severe electrical damage (complete rewiring, multiple system failures)' },

  // Interior
  { component: 'interior', damageLevel: 'minor' as const, repairCost: '40000', deduction: '0.02', description: 'Minor interior damage (worn seats, minor stains)' },
  { component: 'interior', damageLevel: 'moderate' as const, repairCost: '150000', deduction: '0.05', description: 'Moderate interior damage (seat replacement, dashboard issues)' },
  { component: 'interior', damageLevel: 'severe' as const, repairCost: '400000', deduction: '0.15', description: 'Severe interior damage (complete interior replacement)' },

  // Exhaust
  { component: 'exhaust', damageLevel: 'minor' as const, repairCost: '30000', deduction: '0.02', description: 'Minor exhaust issues (muffler repair, minor leaks)' },
  { component: 'exhaust', damageLevel: 'moderate' as const, repairCost: '100000', deduction: '0.04', description: 'Moderate exhaust damage (catalytic converter, major leaks)' },
  { component: 'exhaust', damageLevel: 'severe' as const, repairCost: '250000', deduction: '0.10', description: 'Severe exhaust damage (complete system replacement)' },
];

async function seedDamageDeductions() {
  console.log('🌱 Seeding damage deductions...');

  try {
    // Check if deductions already exist
    const existing = await db.select().from(damageDeductions).limit(1);
    
    if (existing.length > 0) {
      console.log('⚠️  Damage deductions already exist. Skipping seed.');
      console.log('   Run with --force to overwrite existing data.');
      return;
    }

    // Insert all deductions
    let inserted = 0;
    for (const deduction of STANDARD_DEDUCTIONS) {
      try {
        await db.insert(damageDeductions).values({
          component: deduction.component,
          damageLevel: deduction.damageLevel,
          repairCostEstimate: deduction.repairCost,
          valuationDeductionPercent: deduction.deduction,
          description: deduction.description,
          createdBy: SYSTEM_USER_ID,
        });
        inserted++;
      } catch (error: any) {
        // Skip if already exists (unique constraint violation)
        if (error.code === '23505') {
          console.log(`   ⏭️  Skipping ${deduction.component} (${deduction.damageLevel}) - already exists`);
        } else {
          throw error;
        }
      }
    }

    console.log(`✅ Successfully seeded ${inserted} damage deductions`);
    console.log('');
    console.log('📊 Deductions by component:');
    console.log('   - Engine: 3 levels (minor, moderate, severe)');
    console.log('   - Transmission: 3 levels');
    console.log('   - Body: 3 levels');
    console.log('   - Structure: 3 levels');
    console.log('   - Suspension: 3 levels');
    console.log('   - Brakes: 3 levels');
    console.log('   - Electrical: 3 levels');
    console.log('   - Interior: 3 levels');
    console.log('   - Exhaust: 3 levels');
    console.log('');
    console.log('💡 These deductions will be used by the damage calculation service');
    console.log('   when assessing vehicle salvage values.');

  } catch (error) {
    console.error('❌ Error seeding damage deductions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDamageDeductions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDamageDeductions };
