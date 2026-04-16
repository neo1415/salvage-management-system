#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@/lib/db';
import { systemConfig } from '@/lib/db/schema/auction-deposit';

async function checkConfig() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Deposit Configuration Check');
  console.log('═══════════════════════════════════════════════════════\n');

  const configs = await db.select().from(systemConfig).orderBy(systemConfig.updatedAt);

  console.log(`Found ${configs.length} config record(s)\n`);

  for (const config of configs) {
    console.log('Config Record:');
    console.log(`  ID: ${config.id}`);
    console.log(`  Parameter: ${config.parameter}`);
    console.log(`  Value: ${config.value}`);
    console.log(`  Data Type: ${config.dataType}`);
    console.log(`  Created: N/A`);
    console.log(`  Updated: ${config.updatedAt}`);
    console.log('');
  }

  // Check parsed config
  const { configService } = await import('@/features/auction-deposit/services/config.service');
  const parsedConfig = await configService.getConfig();

  console.log('Parsed Configuration:');
  console.log(`  depositRate: ${parsedConfig.depositRate}% (should be 10)`);
  console.log(`  minimumDepositFloor: ₦${parsedConfig.minimumDepositFloor.toLocaleString()}`);
  console.log(`  tier1Limit: ₦${parsedConfig.tier1Limit.toLocaleString()}`);
  console.log(`  tier1DepositCap: ₦${parsedConfig.tier1DepositCap.toLocaleString()}`);
  console.log(`  paymentDeadlineHours: ${parsedConfig.paymentDeadlineHours}h`);
  console.log(`  documentDeadlineHours: ${parsedConfig.documentDeadlineHours}h`);
  console.log(`  extensionCostPercentage: ${parsedConfig.extensionCostPercentage}%`);
  console.log(`  maxExtensions: ${parsedConfig.maxExtensions}`);
  console.log(`  depositSystemEnabled: ${parsedConfig.depositSystemEnabled}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Calculation Test');
  console.log('═══════════════════════════════════════════════════════\n');

  const bidAmount = 230000;
  const depositRateDecimal = parsedConfig.depositRate / 100;
  const calculatedDeposit = Math.max(
    Math.ceil(bidAmount * depositRateDecimal),
    parsedConfig.minimumDepositFloor
  );

  console.log(`Bid Amount: ₦${bidAmount.toLocaleString()}`);
  console.log(`Deposit Rate: ${parsedConfig.depositRate}% = ${depositRateDecimal}`);
  console.log(`Calculated: ₦${bidAmount.toLocaleString()} × ${depositRateDecimal} = ₦${(bidAmount * depositRateDecimal).toLocaleString()}`);
  console.log(`Minimum Floor: ₦${parsedConfig.minimumDepositFloor.toLocaleString()}`);
  console.log(`Final Deposit: ₦${calculatedDeposit.toLocaleString()}`);

  if (calculatedDeposit === 2300000) {
    console.log('\n❌ ERROR: Deposit rate is 1000% instead of 10%!');
    console.log('   This means depositRate in config is 1000 instead of 10');
  } else if (calculatedDeposit === 100000) {
    console.log('\n✅ CORRECT: Deposit is minimum floor (₦100k)');
  } else if (calculatedDeposit === 23000) {
    console.log('\n✅ CORRECT: Deposit is 10% of bid (₦23k)');
  }

  process.exit(0);
}

checkConfig().catch(console.error);
