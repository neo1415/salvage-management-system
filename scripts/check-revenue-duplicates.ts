/**
 * Check for duplicate claim references in revenue data
 */

import { FinancialDataRepository } from '@/features/reports/financial/repositories/financial-data.repository';

async function checkDuplicates() {
  console.log('=== Checking for Duplicate Claim References ===\n');

  const data = await FinancialDataRepository.getRevenueData({
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });

  const refs = data.map(d => d.claimReference);
  const uniqueRefs = new Set(refs);
  
  console.log(`Total items: ${refs.length}`);
  console.log(`Unique items: ${uniqueRefs.size}`);
  
  if (refs.length === uniqueRefs.size) {
    console.log('✅ No duplicates found!\n');
  } else {
    console.log(`❌ Found ${refs.length - uniqueRefs.size} duplicate(s)\n`);
    
    // Find which ones are duplicated
    const duplicates = refs.filter((r, i) => refs.indexOf(r) !== i);
    const uniqueDuplicates = [...new Set(duplicates)];
    
    console.log('Duplicate claim references:');
    uniqueDuplicates.forEach(ref => {
      const items = data.filter(d => d.claimReference === ref);
      console.log(`\n  ${ref}:`);
      items.forEach((item, i) => {
        console.log(`    ${i + 1}. Salvage Recovery: ₦${item.salvageRecovery}, Date: ${item.createdAt}`);
      });
    });
  }

  // Check for HTU-7282 specifically (the one mentioned in the error)
  const htu7282 = data.filter(d => d.claimReference === 'HTU-7282');
  if (htu7282.length > 0) {
    console.log(`\n=== HTU-7282 Check ===`);
    console.log(`Found ${htu7282.length} instance(s) of HTU-7282:`);
    htu7282.forEach((item, i) => {
      console.log(`  ${i + 1}. Salvage Recovery: ₦${item.salvageRecovery}, Date: ${item.createdAt}`);
    });
    
    if (htu7282.length === 1) {
      console.log('✅ HTU-7282 appears only once (duplicate fixed!)');
    } else {
      console.log('❌ HTU-7282 still appears multiple times');
    }
  } else {
    console.log('\n⚠️  HTU-7282 not found in current date range');
  }
}

checkDuplicates()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
