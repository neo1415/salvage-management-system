/**
 * Diagnose Report Errors
 * 
 * Check what's causing the Object.entries errors in reports
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseReports() {
  console.log('=== Diagnosing Report Data Issues ===\n');

  // Check salvage cases
  const cases = await db.select().from(salvageCases).limit(5);
  console.log(`Total cases found: ${cases.length}`);
  if (cases.length > 0) {
    console.log('Sample case:', {
      id: cases[0].id,
      status: cases[0].status,
      marketValue: cases[0].marketValue,
      assetType: cases[0].assetType,
    });
  }

  // Check auctions
  const auctionsData = await db.select().from(auctions).limit(5);
  console.log(`\nTotal auctions found: ${auctionsData.length}`);
  if (auctionsData.length > 0) {
    console.log('Sample auction:', {
      id: auctionsData[0].id,
      status: auctionsData[0].status,
      currentBid: auctionsData[0].currentBid,
    });
  }

  // Check payments
  const paymentsData = await db.select().from(payments).limit(5);
  console.log(`\nTotal payments found: ${paymentsData.length}`);
  if (paymentsData.length > 0) {
    console.log('Sample payment:', {
      id: paymentsData[0].id,
      amount: paymentsData[0].amount,
      status: paymentsData[0].status,
      vendorId: paymentsData[0].vendorId,
    });
  }

  // Check vendors
  const vendorsData = await db.select().from(vendors).limit(5);
  console.log(`\nTotal vendors found: ${vendorsData.length}`);
  if (vendorsData.length > 0) {
    console.log('Sample vendor:', {
      id: vendorsData[0].id,
      businessName: vendorsData[0].businessName,
      tier: vendorsData[0].tier,
    });
  }

  // Check for verified payments
  const verifiedPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'verified'))
    .limit(5);
  console.log(`\nVerified payments found: ${verifiedPayments.length}`);

  // Check sold cases with payments
  const soldCases = await db
    .select({
      caseId: salvageCases.id,
      marketValue: salvageCases.marketValue,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
    .leftJoin(payments, eq(auctions.id, payments.auctionId))
    .where(eq(salvageCases.status, 'sold'))
    .limit(5);
  
  console.log(`\nSold cases with payment data: ${soldCases.length}`);
  if (soldCases.length > 0) {
    console.log('Sample sold case:', soldCases[0]);
  }

  console.log('\n=== Diagnosis Complete ===');
}

diagnoseReports()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
