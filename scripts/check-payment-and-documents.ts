import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and } from 'drizzle-orm';

const auctionId = '091f2626-5fbf-46ed-9641-a8d30fe0ffaa';

async function checkPaymentAndDocuments() {
  console.log(`\n🔍 Checking payment and documents for auction ${auctionId}...\n`);

  // Get auction
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.log('❌ Auction not found');
    return;
  }

  console.log(`📋 Auction Status: ${auction.status}`);
  console.log(`   Winner: ${auction.currentBidder}`);
  console.log(`   Winning Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}\n`);

  // Get all payments
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId));

  console.log(`💰 Payments (${allPayments.length}):`);
  for (const payment of allPayments) {
    console.log(`\n   Payment ID: ${payment.id}`);
    console.log(`   Method: ${payment.paymentMethod}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   Reference: ${payment.paymentReference}`);
    console.log(`   Created: ${payment.createdAt}`);
    console.log(`   Verified: ${payment.verifiedAt || 'Not verified'}`);
  }

  // Get all documents
  const documents = await db
    .select()
    .from(releaseForms)
    .where(eq(releaseForms.auctionId, auctionId));

  console.log(`\n\n📄 Documents (${documents.length}):`);
  for (const doc of documents) {
    console.log(`\n   Document ID: ${doc.id}`);
    console.log(`   Type: ${doc.documentType}`);
    console.log(`   Status: ${doc.status}`);
    console.log(`   Signed At: ${doc.signedAt || 'Not signed'}`);
    console.log(`   Created: ${doc.createdAt}`);
  }

  // Check if all documents signed
  const requiredTypes = ['bill_of_sale', 'liability_waiver'];
  const signedTypes = documents
    .filter(doc => doc.status === 'signed')
    .map(doc => doc.documentType);

  const allSigned = requiredTypes.every(type => signedTypes.includes(type));

  console.log(`\n\n📊 Document Signing Status:`);
  console.log(`   Required: ${requiredTypes.join(', ')}`);
  console.log(`   Signed: ${signedTypes.join(', ') || 'None'}`);
  console.log(`   All Signed: ${allSigned ? '✅ YES' : '❌ NO'}`);

  console.log(`\n\n💡 Analysis:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (allPayments.some(p => p.status === 'verified')) {
    console.log(`✅ Payment is VERIFIED`);
  } else {
    console.log(`❌ Payment is NOT verified`);
  }

  if (allSigned) {
    console.log(`✅ All documents are SIGNED`);
    console.log(`\n   → triggerFundReleaseOnDocumentCompletion SHOULD run`);
    console.log(`   → This should create "debit" event and send pickup authorization`);
  } else {
    console.log(`❌ Documents are NOT all signed`);
    console.log(`\n   → triggerFundReleaseOnDocumentCompletion will NOT run`);
    console.log(`   → This is why there's no "debit" event or pickup authorization`);
    console.log(`\n   🔧 FIX: The webhook should NOT call triggerFundReleaseOnDocumentCompletion`);
    console.log(`         It should only unfreeze the deposit.`);
    console.log(`         Fund release happens AFTER documents are signed.`);
  }

  console.log(`\n✅ Diagnostic completed\n`);
}

checkPaymentAndDocuments().catch(console.error);
