/**
 * Check Damage Deductions
 * 
 * Checks what damage deductions are currently in the database
 */

import { db } from '@/lib/db/drizzle';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';

async function checkDamageDeductions() {
  console.log('🔍 Checking damage deductions in database...\n');

  try {
    const deductions = await db.select().from(damageDeductions);
    
    console.log(`Total damage deductions: ${deductions.length}\n`);
    
    if (deductions.length === 0) {
      console.log('❌ No damage deductions found in database');
      console.log('   Run: npx tsx scripts/seed-damage-deductions.ts');
      return;
    }
    
    // Group by component
    const byComponent = deductions.reduce((acc, d) => {
      if (!acc[d.component]) {
        acc[d.component] = [];
      }
      acc[d.component].push(d);
      return acc;
    }, {} as Record<string, typeof deductions>);
    
    console.log('📊 Deductions by component:\n');
    
    Object.keys(byComponent).sort().forEach(component => {
      console.log(`\n🔧 ${component.toUpperCase()}`);
      byComponent[component]
        .sort((a, b) => {
          const order = { minor: 1, moderate: 2, severe: 3 };
          return order[a.damageLevel as keyof typeof order] - order[b.damageLevel as keyof typeof order];
        })
        .forEach(d => {
          console.log(`   ${d.damageLevel.padEnd(10)} | ${d.valuationDeductionPercent.toString().padEnd(6)} deduction | ₦${Number(d.repairCostEstimate).toLocaleString()} repair`);
          if (d.description) {
            console.log(`                  ${d.description}`);
          }
        });
    });
    
    console.log('\n✅ Check complete\n');
    
  } catch (error) {
    console.error('❌ Error checking damage deductions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkDamageDeductions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { checkDamageDeductions };
