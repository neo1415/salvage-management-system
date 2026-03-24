/**
 * Test Missing Documents Cron Job
 * 
 * Purpose: Test the missing documents checker cron job locally
 * 
 * Usage:
 *   npx tsx scripts/test-missing-documents-cron.ts
 */

import { checkMissingDocuments } from '@/lib/cron/check-missing-documents';

async function testMissingDocumentsCron() {
  console.log('='.repeat(80));
  console.log('TEST MISSING DOCUMENTS CRON JOB');
  console.log('='.repeat(80));
  console.log('');

  try {
    const result = await checkMissingDocuments();

    console.log('');
    console.log('='.repeat(80));
    console.log('TEST RESULTS');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary:');
    console.log(`  - Auctions checked: ${result.checked}`);
    console.log(`  - Documents regenerated: ${result.fixed}`);
    console.log(`  - Documents failed: ${result.failed}`);
    console.log(`  - Auctions with missing docs: ${result.results.length}`);
    console.log('');

    if (result.results.length > 0) {
      console.log('Details:');
      for (const item of result.results) {
        console.log(`  Auction ${item.auctionId}:`);
        console.log(`    - Winner: ${item.winnerId}`);
        console.log(`    - Missing: ${item.missingDocuments.join(', ')}`);
        console.log(`    - Regenerated: ${item.regenerated.join(', ') || 'none'}`);
        console.log(`    - Failed: ${item.failed.join(', ') || 'none'}`);
        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED:');
    console.error('-'.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testMissingDocumentsCron();
