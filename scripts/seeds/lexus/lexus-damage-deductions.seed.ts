/**
 * Lexus Damage Deduction Seed Script
 * 
 * Source: Lexus Nigeria Comprehensive Price & Valuation Guide (Feb 2026) - Section 8
 * Extracted from: scripts/import-lexus-damage-deductions.ts
 * 
 * Usage:
 * - Test with --dry-run: tsx scripts/seeds/lexus/lexus-damage-deductions.seed.ts --dry-run
 * - Run: tsx scripts/seeds/lexus/lexus-damage-deductions.seed.ts
 * - Force re-run: tsx scripts/seeds/lexus/lexus-damage-deductions.seed.ts --force
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { batchProcessor, type BatchResult } from '@/features/seeds/services/batch-processor.service';
import { validationService, type DeductionRecord } from '@/features/seeds/services/validation.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = 'lexus-damage-deductions';
const BATCH_SIZE = 50;
const lexusDamageDeductions = [
  // Front Bumper
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 35000,
    repairCostHigh: 80000,
    valuationDeductionLow: 100000,
    valuationDeductionHigh: 250000,
    notes: 'Respray + minor repair. Lexus bumper paint match harder than Toyota â€” metallic finishes common. Workshop: â‚¦50â€“80k.',
  },
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 220000,
    valuationDeductionLow: 250000,
    valuationDeductionHigh: 600000,
    notes: 'Genuine Lexus bumper â‚¦120â€“300k. Local copy â‚¦50â€“100k. Parking sensors embedded â€” verify function after repair.',
  },
  {
    make: 'Lexus',
    component: 'Front Bumper',
    damageLevel: 'severe',
    repairCostLow: 200000,
    repairCostHigh: 500000,
    valuationDeductionLow: 550000,
    valuationDeductionHigh: 1300000,
    notes: 'Full replacement. Airbag/pre-collision sensors check. Lexus Spindle Grille replacement â‚¦80â€“250k extra.',
  },
  
  // Rear Bumper
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 70000,
    valuationDeductionLow: 80000,
    valuationDeductionHigh: 200000,
    notes: 'Touch-up. Rear camera/sensor check â€” common failure point on Lexus after impact. Recalibration â‚¦30â€“60k.',
  },
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'moderate',
    repairCostLow: 70000,
    repairCostHigh: 180000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 500000,
    notes: 'Full panel. Boot alignment check. Genuine Lexus rear sensors: â‚¦20â€“50k each.',
  },
  {
    make: 'Lexus',
    component: 'Rear Bumper',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 420000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1200000,
    notes: 'Full replacement. Exhaust/tow hitch check. LX/GX tow bars: â‚¦80â€“200k replacement.',
  },
  
  // Bonnet/Hood
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'minor',
    repairCostLow: 25000,
    repairCostHigh: 65000,
    valuationDeductionLow: 70000,
    valuationDeductionHigh: 180000,
    notes: 'Panel beating + respray. Lexus hood metallic paint: colour matching critical. Allow 2â€“3 days.',
  },
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'moderate',
    repairCostLow: 65000,
    repairCostHigh: 180000,
    valuationDeductionLow: 180000,
    valuationDeductionHigh: 500000,
    notes: 'Multiple dents or hinge damage. New hood from Toyota network: â‚¦100â€“200k.',
  },
  {
    make: 'Lexus',
    component: 'Bonnet/Hood',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 450000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1400000,
    notes: 'Full replacement. Radiator/intercooler check on RX350/LX570.',
  },
  
  // Front Wing/Fender
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 55000,
    valuationDeductionLow: 60000,
    valuationDeductionHigh: 160000,
    notes: 'Pull + paint. Lexus fenders share Toyota platform â€” widely available at Berger/Apapa.',
  },
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'moderate',
    repairCostLow: 55000,
    repairCostHigh: 150000,
    valuationDeductionLow: 160000,
    valuationDeductionHigh: 420000,
    notes: 'Panel replacement. Camera in fender mirror (on some GX/LX) â€” verify function.',
  },
  {
    make: 'Lexus',
    component: 'Front Wing/Fender',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 380000,
    valuationDeductionLow: 420000,
    valuationDeductionHigh: 1100000,
    notes: 'Chassis rail check critical. GX/LX body-on-frame check frame straightness.',
  },
  
  // Door Panel (per door)
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 50000,
    valuationDeductionLow: 55000,
    valuationDeductionHigh: 150000,
    notes: 'Dent pull + spot repair. Lexus door panels share Toyota platforms â€” repair routine for good workshops.',
  },
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 160000,
    valuationDeductionLow: 170000,
    valuationDeductionHigh: 420000,
    notes: 'Full respray. Soft-close door mechanism (on LS/LX): verify function â‚¦50â€“200k fix if damaged.',
  },
  {
    make: 'Lexus',
    component: 'Door Panel',
    damageLevel: 'severe',
    repairCostLow: 180000,
    repairCostHigh: 500000,
    valuationDeductionLow: 500000,
    valuationDeductionHigh: 1400000,
    notes: 'Door replacement. Side curtain airbag sensor check. Lexus doors: â‚¦150â€“400k replacement.',
  },
  
  // Roof Panel
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'minor',
    repairCostLow: 45000,
    repairCostHigh: 120000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 300000,
    notes: 'PDR possible if no paint break. Panoramic roof alignment check (very common on Lexus ES/RX/GX).',
  },
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'moderate',
    repairCostLow: 120000,
    repairCostHigh: 320000,
    valuationDeductionLow: 340000,
    valuationDeductionHigh: 850000,
    notes: 'Body filler + full respray. Panoramic sunroof: seal + motor check after any roof repair.',
  },
  {
    make: 'Lexus',
    component: 'Roof Panel',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 1800000,
    valuationDeductionLow: 2000000,
    valuationDeductionHigh: 6000000,
    notes: 'Major structural. A-pillar inspection essential. Write-off territory for older models.',
  },
  
  // Windscreen
  {
    make: 'Lexus',
    component: 'Windscreen',
    damageLevel: 'minor',
    repairCostLow: 15000,
    repairCostHigh: 40000,
    valuationDeductionLow: 40000,
    valuationDeductionHigh: 100000,
    notes: 'Resin injection. ADAS/Pre-Collision System recalibration required on 2016+ Lexus: â‚¦50â€“100k.',
  },
  {
    make: 'Lexus',
    component: 'Windscreen',
    damageLevel: 'severe',
    repairCostLow: 80000,
    repairCostHigh: 300000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 750000,
    notes: 'Genuine Lexus glass: â‚¦150â€“350k. ADAS recalibration adds â‚¦50â€“120k. Higher deduction for newer models.',
  },
  
  // Side Windows
  {
    make: 'Lexus',
    component: 'Side Windows',
    damageLevel: 'moderate',
    repairCostLow: 25000,
    repairCostHigh: 100000,
    valuationDeductionLow: 65000,
    valuationDeductionHigh: 250000,
    notes: 'Per window. Power regulator check. Lexus windows: power close function common â€” verify operation.',
  },
  
  // Headlights (LED/HID)
  {
    make: 'Lexus',
    component: 'Headlights',
    damageLevel: 'minor',
    repairCostLow: 20000,
    repairCostHigh: 60000,
    valuationDeductionLow: 50000,
    valuationDeductionHigh: 160000,
    notes: 'Polish/restore. Lexus LED headlights sharper than Toyota â€” lens replacement â‚¦60â€“120k (local).',
  },
  {
    make: 'Lexus',
    component: 'Headlights',
    damageLevel: 'severe',
    repairCostLow: 150000,
    repairCostHigh: 900000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 2500000,
    notes: 'Genuine Lexus LED adaptive unit: â‚¦500kâ€“1.5M. Used from Cotonou: â‚¦200â€“600k. Very expensive on LX/GX.',
  },
  
  // Tail Lights
  {
    make: 'Lexus',
    component: 'Tail Lights',
    damageLevel: 'moderate',
    repairCostLow: 50000,
    repairCostHigh: 400000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 1000000,
    notes: 'Lexus sequential LED tail lights (RX350, ES): â‚¦150â€“500k replacement. Very visual â€” deduction reflects perception.',
  },
  
  // Spindle Grille
  {
    make: 'Lexus',
    component: 'Radiator Grille',
    damageLevel: 'moderate',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 600000,
    notes: 'Unique to Lexus. Replacement grille â‚¦80â€“300k. Parking/radar sensors embedded in some â€” verify.',
  },
  
  // Engine (Oil leak)
  {
    make: 'Lexus',
    component: 'Engine',
    damageLevel: 'minor',
    repairCostLow: 30000,
    repairCostHigh: 100000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 600000,
    notes: 'Valve cover gasket: â‚¦15â€“40k part + labour. Lexus engines Toyota-grade reliability â€” higher deduction still signals neglect.',
  },
  {
    make: 'Lexus',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 600000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 2500000,
    valuationDeductionHigh: 8000000,
    notes: 'Toyota-based engine from Apapa: â‚¦400kâ€“1.5M (RX/ES). LX570 5.7L used engine: â‚¦800kâ€“2.5M. Skilled mechanics available.',
  },
  
  // Gearbox/Transmission
  {
    make: 'Lexus',
    component: 'Gearbox/Transmission',
    damageLevel: 'moderate',
    repairCostLow: 300000,
    repairCostHigh: 1200000,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 3000000,
    notes: 'Lexus auto trans Toyota-grade. If failing: service â‚¦100â€“250k or rebuild â‚¦400kâ€“1.2M. GX/LX transfer case extra.',
  },
  {
    make: 'Lexus',
    component: 'Gearbox/Transmission',
    damageLevel: 'severe',
    repairCostLow: 700000,
    repairCostHigh: 2500000,
    valuationDeductionLow: 2500000,
    valuationDeductionHigh: 6000000,
    notes: 'Replacement from Apapa: â‚¦500kâ€“1.8M (RX/ES); â‚¦1Mâ€“2.5M (LX570 V8). More available than Audi/BMW.',
  },
  
  // Suspension (per axle)
  {
    make: 'Lexus',
    component: 'Suspension',
    damageLevel: 'minor',
    repairCostLow: 60000,
    repairCostHigh: 250000,
    valuationDeductionLow: 150000,
    valuationDeductionHigh: 600000,
    notes: 'Lexus hydraulic/air suspension (LS460, GX460): air strut â‚¦200â€“600k per corner. Toyota coil-spring models cheaper.',
  },
  {
    make: 'Lexus',
    component: 'Suspension',
    damageLevel: 'moderate',
    repairCostLow: 150000,
    repairCostHigh: 500000,
    valuationDeductionLow: 400000,
    valuationDeductionHigh: 1200000,
    notes: 'GX/LX body-on-frame: robust but KDSS (Kinetic Dynamic Suspension) check needed after hard impacts.',
  },
  
  // Interior â€” Mark Levinson
  {
    make: 'Lexus',
    component: 'Interior Dashboard',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 600000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 1200000,
    notes: 'Lexus infotainment screen: â‚¦200â€“500k. Dashboard crack repair: â‚¦80â€“200k. Dual-screen (LX600): extremely expensive.',
  },
  
  // Interior â€” Seats
  {
    make: 'Lexus',
    component: 'Interior Seats',
    damageLevel: 'moderate',
    repairCostLow: 100000,
    repairCostHigh: 500000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 1000000,
    notes: 'Lexus leather re-trim â‚¦250â€“600k (full). Heated/cooled seat element repair: â‚¦50â€“150k. Semi-aniline leather on LS: deduct more.',
  },
  
  // AC System
  {
    make: 'Lexus',
    component: 'AC System',
    damageLevel: 'moderate',
    repairCostLow: 80000,
    repairCostHigh: 350000,
    valuationDeductionLow: 200000,
    valuationDeductionHigh: 800000,
    notes: 'Compressor: â‚¦120â€“350k. Condenser: â‚¦100â€“250k. 4-zone climate control (LS/LX) more complex â€” add â‚¦50â€“150k.',
  },
  
  // Frame/Chassis
  {
    make: 'Lexus',
    component: 'Frame/Chassis',
    damageLevel: 'severe',
    repairCostLow: 500000,
    repairCostHigh: 3000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 12000000,
    notes: 'Body-on-frame (GX/LX): frame rails straightening required. Certified shops: Lagos Island, Surulere, Wuse Abuja.',
  },
  
  // Mileage Tampering
  {
    make: 'Lexus',
    component: 'Mileage Tampering',
    damageLevel: 'severe',
    repairCostLow: 0,
    repairCostHigh: 0,
    valuationDeductionLow: 1000000,
    valuationDeductionHigh: 6000000,
    notes: 'Common on imported Lexus. Deduct per verified mileage. Carfax/VIN history check essential for all Lexus buys.',
  },
];


// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function transformToDbRecords(rawData: any[]): DeductionRecord[] {
  const records: DeductionRecord[] = [];
  
  for (const item of rawData) {
    if (!item.make || !item.component || !item.damageLevel) {
      console.warn('⚠️  Skipping invalid record (missing make, component, or damageLevel):', item);
      continue;
    }

    if (!['minor', 'moderate', 'severe'].includes(item.damageLevel)) {
      console.warn(`⚠️  Skipping invalid record (damageLevel must be minor, moderate, or severe):`, item);
      continue;
    }

    records.push({
      make: item.make,
      component: item.component,
      damageLevel: item.damageLevel as 'minor' | 'moderate' | 'severe',
      repairCostLow: item.repairCostLow,
      repairCostHigh: item.repairCostHigh,
      valuationDeductionLow: item.valuationDeductionLow,
      valuationDeductionHigh: item.valuationDeductionHigh,
      notes: item.notes,
    });
  }
  
  return records;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function executeSeed() {
  const startTime = Date.now();
  const scriptName = SCRIPT_NAME;
  
  console.log('\n' + '='.repeat(60));
  console.log('🌱 SEED SCRIPT: ' + scriptName);
  console.log('='.repeat(60));
  console.log(`📊 Total raw records: ${lexusDamageDeductions.length}\n`);
  
  const forceRun = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  
  if (!forceRun && !dryRun) {
    const hasRun = await seedRegistryService.hasBeenExecuted(scriptName);
    if (hasRun) {
      console.log('⏭️  Seed already executed. Use --force to re-run.');
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    }
  }
  
  if (dryRun) console.log('🔍 DRY RUN MODE - No changes will be made\n');
  if (forceRun) console.log('🔄 FORCE MODE - Re-running seed\n');
  
  let registryId: string | null = null;
  if (!dryRun) {
    registryId = await seedRegistryService.recordStart(scriptName);
    console.log(`📝 Registry entry created: ${registryId}\n`);
  }
  
  try {
    console.log('🔄 Transforming raw data...');
    const records = transformToDbRecords(lexusDamageDeductions);
    console.log(`✅ Transformed ${records.length} records\n`);
    
    if (records.length === 0) {
      console.log('⚠️  No records to process. Check rawData array.');
      if (!dryRun && registryId) {
        await seedRegistryService.recordSuccess(registryId, {
          recordsImported: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          executionTimeMs: Date.now() - startTime,
        });
      }
      process.exit(0);
    }
    
    console.log('📦 Processing records in batches...\n');
    const stats = await batchProcessor.processBatch(
      records,
      BATCH_SIZE,
      async (batch) => {
        const result: BatchResult = {
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [],
        };
        
        for (const record of batch) {
          try {
            const validation = validationService.validateDeduction(record);
            if (!validation.valid) {
              console.error(`   ⚠️  Validation failed for ${record.make} ${record.component} (${record.damageLevel}):`);
              validation.errors.forEach(err => {
                console.error(`      - ${err.field}: ${err.message}`);
              });
              result.errors.push({
                record,
                error: new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`),
              });
              result.skipped++;
              continue;
            }
            
            if (dryRun) {
              console.log(`   [DRY RUN] Would upsert: ${record.make} ${record.component} (${record.damageLevel})`);
              result.imported++;
            } else {
              const upsertResult = await idempotentUpsert.upsertDeduction(record);
              
              if (upsertResult.error) {
                console.error(`   ❌ Error upserting ${record.make} ${record.component} (${record.damageLevel}):`, upsertResult.error.message);
                result.errors.push({ record, error: upsertResult.error });
                result.skipped++;
              } else {
                if (upsertResult.action === 'inserted') result.imported++;
                if (upsertResult.action === 'updated') result.updated++;
                if (upsertResult.action === 'skipped') result.skipped++;
              }
            }
          } catch (error) {
            console.error(`   ❌ Unexpected error processing ${record.make} ${record.component} (${record.damageLevel}):`, error);
            result.errors.push({
              record,
              error: error instanceof Error ? error : new Error(String(error)),
            });
            result.skipped++;
          }
        }
        
        return result;
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    if (!dryRun && registryId) {
      await seedRegistryService.recordSuccess(registryId, {
        recordsImported: stats.totalImported,
        recordsUpdated: stats.totalUpdated,
        recordsSkipped: stats.totalSkipped,
        executionTimeMs: executionTime,
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 SEED EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Script:           ${scriptName}`);
    console.log(`Mode:             ${dryRun ? 'DRY RUN' : forceRun ? 'FORCE' : 'NORMAL'}`);
    console.log(`Total Records:    ${stats.totalRecords}`);
    console.log(`✅ Imported:      ${stats.totalImported}`);
    console.log(`🔄 Updated:       ${stats.totalUpdated}`);
    console.log(`⏭️  Skipped:       ${stats.totalSkipped}`);
    console.log(`❌ Errors:        ${stats.totalErrors}`);
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));
    
    if (stats.errors.length > 0) {
      console.log('\n❌ ERROR DETAILS:');
      console.log('-'.repeat(60));
      stats.errors.forEach(({ record, error }, index) => {
        console.log(`${index + 1}. ${record.make} ${record.component} (${record.damageLevel})`);
        console.log(`   Error: ${error.message}`);
      });
      console.log('-'.repeat(60));
    }
    
    console.log('\n✅ Seed execution completed successfully\n');
    process.exit(0);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    if (!dryRun && registryId) {
      await seedRegistryService.recordFailure(
        registryId,
        error as Error,
        executionTime
      );
    }
    
    console.error('\n' + '='.repeat(60));
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(60));
    console.error(error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

executeSeed();
