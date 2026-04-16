/**
 * Find ALL Verified Payments and Their Source Cases
 * Where are the ₦3.7M payments coming from if not from Feb+ cases?
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function findAllPaymentSources() {
  console.log('FINDING ALL VERIFIED PAYMENTS AND THEIR SOURCE CASES\n');
  console.log('='.repeat(100));
  
  // Get ALL verified payments with their case info
  const allVerifiedPayments = await db
    .select({
      paymentId: payments.id,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
      paymentCreated: payments.createdAt,
      paymentReference: payments.reference,
      auctionId: payments.auctionId,
    })
    .from(payments)
    .where(eq(payments.status, 'verified'));
  
  console.log(`Total Verified Payments: ${allVerifiedPayments.length}\n`);
  
  const totalAmount = allVerifiedPayments.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0);
  console.log(`Total Amount: ₦${totalAmount.toLocaleString()}\n`);
  
  // Now get case info for each payment
  const paymentsWithCases = [];
  for (const payment of allVerifiedPayments) {
    if (!payment.auctionId) {
      paymentsWithCases.push({
        ...payment,
        caseId: null,
        claimRef: null,
        caseStatus: null,
        caseCreatedAt: null,
        createdBy: null,
        adjusterName: null,
      });
      continue;
    }
    
    const auction = await db.select().from(auctions).where(eq(auctions.id, payment.auctionId)).limit(1);
    if (auction.length === 0 || !auction[0].caseId) {
      paymentsWithCases.push({
        ...payment,
        caseId: null,
        claimRef: null,
        caseStatus: null,
        caseCreatedAt: null,
        createdBy: null,
        adjusterName: null,
      });
      continue;
    }
    
    const caseData = await db.select().from(salvageCases).where(eq(salvageCases.id, auction[0].caseId)).limit(1);
    if (caseData.length === 0) {
      paymentsWithCases.push({
        ...payment,
        caseId: auction[0].caseId,
        claimRef: null,
        caseStatus: null,
        caseCreatedAt: null,
        createdBy: null,
        adjusterName: null,
      });
      continue;
    }
    
    const adjuster = await db.select().from(users).where(eq(users.id, caseData[0].createdBy)).limit(1);
    
    paymentsWithCases.push({
      ...payment,
      caseId: caseData[0].id,
      claimRef: caseData[0].claimReference,
      caseStatus: caseData[0].status,
      caseCreatedAt: caseData[0].createdAt,
      createdBy: caseData[0].createdBy,
      adjusterName: adjuster.length > 0 ? adjuster[0].fullName : null,
    });
  }
  
  // Group by case creation date
  const feb1 = new Date('2026-02-01');
  const paymentsBeforeFeb = paymentsWithCases.filter(p => p.caseCreatedAt && new Date(p.caseCreatedAt) < feb1);
  const paymentsAfterFeb = paymentsWithCases.filter(p => p.caseCreatedAt && new Date(p.caseCreatedAt) >= feb1);
  const paymentsNoCase = paymentsWithCases.filter(p => !p.caseId);
  
  console.log('='.repeat(100));
  console.log('BREAKDOWN BY CASE CREATION DATE:');
  console.log('='.repeat(100));
  console.log(`Payments from cases created BEFORE Feb 1: ${paymentsBeforeFeb.length}`);
  console.log(`Amount: ₦${paymentsBeforeFeb.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}\n`);
  
  console.log(`Payments from cases created AFTER Feb 1: ${paymentsAfterFeb.length}`);
  console.log(`Amount: ₦${paymentsAfterFeb.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}\n`);
  
  console.log(`Payments with NO case link: ${paymentsNoCase.length}`);
  console.log(`Amount: ₦${paymentsNoCase.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}\n`);
  
  // Show ALL payments in detail
  console.log('='.repeat(100));
  console.log('ALL VERIFIED PAYMENTS (DETAILED):');
  console.log('='.repeat(100));
  console.log('Claim Ref | Adjuster | Case Created | Payment Created | Amount | Has Case?');
  console.log('-'.repeat(100));
  
  for (const p of paymentsWithCases) {
    const caseCreated = p.caseCreatedAt ? new Date(p.caseCreatedAt).toISOString().split('T')[0] : 'NO CASE';
    const paymentCreated = new Date(p.paymentCreated).toISOString().split('T')[0];
    const beforeFeb = p.caseCreatedAt && new Date(p.caseCreatedAt) < feb1 ? '⚠️ BEFORE FEB' : '';
    
    console.log(
      `${(p.claimRef || 'NO CASE').padEnd(12)} | ` +
      `${(p.adjusterName || 'NO ADJUSTER').substring(0, 15).padEnd(15)} | ` +
      `${caseCreated.padEnd(12)} | ` +
      `${paymentCreated} | ` +
      `₦${parseFloat(p.paymentAmount).toLocaleString().padStart(10)} | ` +
      `${p.caseId ? 'YES' : 'NO'} ${beforeFeb}`
    );
  }
  
  console.log('-'.repeat(100));
  console.log(`TOTAL: ₦${totalAmount.toLocaleString()}\n`);
  
  // Check if there are payments with NO auction link
  const paymentsNoAuction = paymentsWithCases.filter(p => !p.auctionId);
  if (paymentsNoAuction.length > 0) {
    console.log('='.repeat(100));
    console.log(`⚠️  WARNING: ${paymentsNoAuction.length} payments have NO auction link!`);
    console.log('='.repeat(100));
    console.log('These payments are orphaned - not linked to any auction:');
    for (const p of paymentsNoAuction) {
      console.log(`  Payment ${p.paymentId.substring(0, 8)}... - ₦${parseFloat(p.paymentAmount).toLocaleString()} - ${p.paymentReference}`);
    }
    console.log('');
  }
  
  // Find Ademola's payments specifically
  const ademolaPayments = paymentsWithCases.filter(p => p.adjusterName === 'Ademola Dan');
  console.log('='.repeat(100));
  console.log(`ADEMOLA DAN'S PAYMENTS: ${ademolaPayments.length}`);
  console.log('='.repeat(100));
  
  const ademolaBeforeFeb = ademolaPayments.filter(p => p.caseCreatedAt && new Date(p.caseCreatedAt) < feb1);
  const ademolaAfterFeb = ademolaPayments.filter(p => p.caseCreatedAt && new Date(p.caseCreatedAt) >= feb1);
  
  console.log(`Cases created BEFORE Feb 1: ${ademolaBeforeFeb.length}`);
  console.log(`Amount: ₦${ademolaBeforeFeb.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}\n`);
  
  console.log(`Cases created AFTER Feb 1: ${ademolaAfterFeb.length}`);
  console.log(`Amount: ₦${ademolaAfterFeb.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}\n`);
  
  const ademolaTotal = ademolaPayments.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0);
  console.log(`TOTAL ADEMOLA: ₦${ademolaTotal.toLocaleString()}\n`);
  
  // Check earliest case creation date
  const casesWithDates = paymentsWithCases.filter(p => p.caseCreatedAt);
  if (casesWithDates.length > 0) {
    const sortedByDate = [...casesWithDates].sort((a, b) => 
      new Date(a.caseCreatedAt!).getTime() - new Date(b.caseCreatedAt!).getTime()
    );
    
    const earliest = sortedByDate[0];
    const latest = sortedByDate[sortedByDate.length - 1];
    
    console.log('='.repeat(100));
    console.log('CASE CREATION DATE RANGE:');
    console.log('='.repeat(100));
    console.log(`Earliest case: ${new Date(earliest.caseCreatedAt!).toISOString().split('T')[0]} (${earliest.claimRef})`);
    console.log(`Latest case: ${new Date(latest.caseCreatedAt!).toISOString().split('T')[0]} (${latest.claimRef})`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('CONCLUSION:');
  console.log('='.repeat(100));
  
  if (paymentsBeforeFeb.length > 0) {
    console.log(`❌ FOUND ${paymentsBeforeFeb.length} payments from cases created BEFORE Feb 1, 2026`);
    console.log(`   Amount: ₦${paymentsBeforeFeb.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}`);
    console.log(`   This contradicts the claim that "first line of code was written after Feb 1"`);
  } else {
    console.log(`✅ NO payments from cases created before Feb 1, 2026`);
  }
  
  if (paymentsNoCase.length > 0) {
    console.log(`\n⚠️  ${paymentsNoCase.length} payments have NO case link (orphaned)`);
    console.log(`   Amount: ₦${paymentsNoCase.reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toLocaleString()}`);
    console.log(`   These payments are not being counted in the report!`);
  }
}

findAllPaymentSources()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
