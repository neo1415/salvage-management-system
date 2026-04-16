import { db } from '../src/lib/db/drizzle';
import { releaseForms } from '../src/lib/db/schema/release-forms';
import { auctionWinners } from '../src/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';

async function checkDocuments() {
  const auctionId = process.argv[2] || '69f40ad8-497d-4d6f-82b1-632fc82d95c7';

  console.log('============================================================');
  console.log(`Checking Documents for Auction: ${auctionId}`);
  console.log('============================================================\n');

  // Check documents
  const docs = await db
    .select()
    .from(releaseForms)
    .where(eq(releaseForms.auctionId, auctionId));

  console.log(`📄 Documents: ${docs.length}`);
  if (docs.length > 0) {
    docs.forEach(d => {
      console.log(`  - ${d.documentType}`);
      console.log(`    Status: ${d.status}`);
      console.log(`    Validity Deadline: ${d.validityDeadline?.toISOString() || 'Not set'}`);
      console.log(`    Payment Deadline: ${d.paymentDeadline?.toISOString() || 'Not set'}`);
      console.log(`    Signed: ${d.signedAt ? 'Yes (' + d.signedAt.toISOString() + ')' : 'No'}`);
      console.log(`    Vendor: ${d.vendorId}`);
      console.log('');
    });
  } else {
    console.log('  ⚠️  No documents found!\n');
  }

  // Check auction winners
  const winners = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, auctionId))
    .orderBy(auctionWinners.rank);

  console.log(`🏆 Auction Winners: ${winners.length}`);
  winners.forEach(w => {
    console.log(`  - Rank ${w.rank}: ${w.vendorId}`);
    console.log(`    Bid: ₦${parseFloat(w.bidAmount).toLocaleString()}`);
    console.log(`    Deposit: ₦${parseFloat(w.depositAmount).toLocaleString()}`);
    console.log(`    Status: ${w.status}`);
    console.log('');
  });

  // Calculate time until document deadline expires (if documents exist)
  if (docs.length > 0 && docs[0].validityDeadline) {
    const now = new Date();
    const deadline = new Date(docs[0].validityDeadline);
    const msRemaining = deadline.getTime() - now.getTime();
    const minutesRemaining = Math.floor(msRemaining / (1000 * 60));
    const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000);
    
    console.log('⏰ Time Until Document Deadline:');
    if (msRemaining > 0) {
      console.log(`   ${minutesRemaining} minutes, ${secondsRemaining} seconds`);
      console.log(`   Deadline: ${deadline.toISOString()}`);
      console.log(`   Current: ${now.toISOString()}`);
    } else {
      console.log(`   ⚠️  EXPIRED ${Math.abs(minutesRemaining)} minutes ago`);
      console.log(`   Deadline was: ${deadline.toISOString()}`);
      console.log(`   Current: ${now.toISOString()}`);
    }
  }

  process.exit(0);
}

checkDocuments().catch(console.error);
