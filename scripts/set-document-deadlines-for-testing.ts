import { db } from '../src/lib/db/drizzle';
import { releaseForms } from '../src/lib/db/schema/release-forms';
import { eq, and } from 'drizzle-orm';

async function setDeadlines() {
  const auctionId = process.argv[2];
  
  if (!auctionId) {
    console.error('❌ Please provide auction ID as argument');
    console.error('Usage: npx tsx scripts/set-document-deadlines-for-testing.ts <auction-id>');
    process.exit(1);
  }

  console.log('============================================================');
  console.log(`Setting Document Deadlines for Auction: ${auctionId}`);
  console.log('============================================================\n');

  // Check testing mode
  const testingMode = process.env.TESTING_MODE === 'true';
  const validityMinutes = parseInt(process.env.TESTING_DOCUMENT_VALIDITY_MINUTES || '0');
  
  if (!testingMode || !validityMinutes) {
    console.error('❌ TESTING_MODE must be true and TESTING_DOCUMENT_VALIDITY_MINUTES must be set');
    console.error('Current values:');
    console.error(`  TESTING_MODE: ${process.env.TESTING_MODE}`);
    console.error(`  TESTING_DOCUMENT_VALIDITY_MINUTES: ${process.env.TESTING_DOCUMENT_VALIDITY_MINUTES}`);
    process.exit(1);
  }

  console.log(`🧪 Testing Mode: ENABLED`);
  console.log(`⏰ Document Validity: ${validityMinutes} minutes\n`);

  // Get documents
  const docs = await db
    .select()
    .from(releaseForms)
    .where(eq(releaseForms.auctionId, auctionId));

  if (docs.length === 0) {
    console.error('❌ No documents found for this auction');
    process.exit(1);
  }

  console.log(`📄 Found ${docs.length} documents\n`);

  // Calculate validity deadline
  const now = new Date();
  const validityDeadline = new Date(now.getTime() + (validityMinutes * 60 * 1000));

  console.log(`Setting deadlines:`);
  console.log(`  Current Time: ${now.toISOString()}`);
  console.log(`  Validity Deadline: ${validityDeadline.toISOString()}`);
  console.log(`  (${validityMinutes} minutes from now)\n`);

  // Update all documents for this auction
  const result = await db
    .update(releaseForms)
    .set({
      validityDeadline,
      originalDeadline: validityDeadline,
      extensionCount: 0,
      updatedAt: new Date()
    })
    .where(eq(releaseForms.auctionId, auctionId))
    .returning();

  console.log(`✅ Updated ${result.length} documents:`);
  result.forEach(d => {
    console.log(`  - ${d.documentType} (${d.vendorId})`);
  });

  console.log(`\n⏰ Documents will expire in ${validityMinutes} minutes`);
  console.log(`📅 Expiry time: ${validityDeadline.toISOString()}`);
  console.log(`\n🔄 After expiry + buffer (${process.env.TESTING_BUFFER_MINUTES} min), run:`);
  console.log(`   curl -X GET http://localhost:3000/api/cron/check-document-deadlines -H "Authorization: Bearer ${process.env.CRON_SECRET}"`);

  process.exit(0);
}

setDeadlines().catch(console.error);
