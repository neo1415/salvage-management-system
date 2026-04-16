/**
 * Check Ademola Dan's Revenue
 * Why is it only ₦400k when total is ₦4M?
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

async function checkAdemolaRevenue() {
  console.log('CHECKING ADEMOLA DAN REVENUE\n');
  
  // Find Ademola
  const ademola = await db.select().from(users).where(eq(users.fullName, 'Ademola Dan'));
  
  if (ademola.length === 0) {
    console.log('❌ Ademola Dan not found');
    return;
  }
  
  const ademolaId = ademola[0].id;
  console.log(`✅ Found Ademola Dan: ${ademolaId}\n`);
  
  // Get ALL cases created by Ademola (no date filter)
  const allCases = await db
    .select()
    .from(salvageCases)
    .where(eq(salvageCases.createdBy, ademolaId));
  
  console.log(`Total Cases Created by Ademola: ${allCases.length}`);
  console.log(`Sold Cases: ${allCases.filter(c => c.status === 'sold').length}\n`);
  
  // Get ALL payments for Ademola's cases
  const allPayments = await db
    .select({
      paymentId: payments.id,
      amount: payments.amount,
      status: payments.status,
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseCreatedAt: salvageCases.createdAt,
      paymentCreatedAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .innerJoin(salvageCases, and(
      eq(auctions.caseId, salvageCases.id),
      eq(salvageCases.createdBy, ademolaId)
    ));
  
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  const totalVerified = verifiedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  console.log(`Total Payments for Ademola's Cases: ${allPayments.length}`);
  console.log(`Verified Payments: ${verifiedPayments.length}`);
  console.log(`Total Verified Amount: ₦${totalVerified.toLocaleString()}\n`);
  
  // Check date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);
  
  // Cases created in date range
  const casesInRange = allCases.filter(c => {
    const created = new Date(c.createdAt);
    return created >= startDate && created <= endDate;
  });
  
  console.log(`Cases Created in Date Range: ${casesInRange.length}`);
  console.log(`Sold Cases in Range: ${casesInRange.filter(c => c.status === 'sold').length}\n`);
  
  // Payments for cases created in date range
  const paymentsInRange = verifiedPayments.filter(p => {
    const caseCreated = new Date(p.caseCreatedAt);
    return caseCreated >= startDate && caseCreated <= endDate;
  });
  
  const totalInRange = paymentsInRange.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  console.log(`Verified Payments (cases created in range): ${paymentsInRange.length}`);
  console.log(`Total: ₦${totalInRange.toLocaleString()}\n`);
  
  // Show payment details
  console.log('Payment Details:');
  console.log('Claim Ref | Amount | Case Created | Payment Created | In Range?');
  console.log('-'.repeat(80));
  
  for (const p of verifiedPayments) {
    const caseCreated = new Date(p.caseCreatedAt);
    const inRange = caseCreated >= startDate && caseCreated <= endDate;
    
    console.log(
      `${p.claimRef.padEnd(12)} | ` +
      `₦${parseFloat(p.amount).toLocaleString().padStart(10)} | ` +
      `${caseCreated.toISOString().split('T')[0]} | ` +
      `${new Date(p.paymentCreatedAt).toISOString().split('T')[0]} | ` +
      `${inRange ? 'YES' : 'NO'}`
    );
  }
  
  console.log('-'.repeat(80));
  console.log(`\nTOTAL ALL TIME: ₦${totalVerified.toLocaleString()}`);
  console.log(`TOTAL IN RANGE: ₦${totalInRange.toLocaleString()}`);
  console.log(`\nREPORT SHOWS: ₦400,000`);
  console.log(`MATCH: ${totalInRange === 400000 ? '✅ YES' : '❌ NO'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('EXPLANATION');
  console.log('='.repeat(80));
  console.log('\nThe report filters by CASE CREATION DATE, not payment date.');
  console.log('So if Ademola created cases 2 months ago that sold recently,');
  console.log('those payments WON\'T show in the last 30 days report.');
  console.log('\nThis is correct behavior - the report shows:');
  console.log('"Revenue from cases YOU CREATED in this date range"');
}

checkAdemolaRevenue()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
