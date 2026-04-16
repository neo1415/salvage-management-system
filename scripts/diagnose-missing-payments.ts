/**
 * Diagnose Missing Payments
 * Why are 15 sold cases not showing payments?
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

async function diagnoseMissingPayments() {
  console.log('DIAGNOSING MISSING PAYMENTS\n');
  
  // Find Ademola
  const ademola = await db.select().from(users).where(eq(users.fullName, 'Ademola Dan'));
  const ademolaId = ademola[0].id;
  
  // Date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  // Get sold cases by Ademola in date range
  const soldCases = await db
    .select()
    .from(salvageCases)
    .where(
      and(
        eq(salvageCases.createdBy, ademolaId),
        eq(salvageCases.status, 'sold'),
        gte(salvageCases.createdAt, startDate),
        lte(salvageCases.createdAt, endDate)
      )
    );
  
  console.log(`Sold Cases by Ademola in Date Range: ${soldCases.length}\n`);
  
  // Check each case
  for (const caseItem of soldCases.slice(0, 5)) {
    console.log(`\nCase: ${caseItem.claimReference} (${caseItem.id.substring(0, 8)}...)`);
    console.log(`Created: ${new Date(caseItem.createdAt).toISOString().split('T')[0]}`);
    
    // Check if auction exists
    const auctionData = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, caseItem.id));
    
    if (auctionData.length === 0) {
      console.log('❌ NO AUCTION FOUND');
      continue;
    }
    
    console.log(`✅ Auction exists: ${auctionData[0].id.substring(0, 8)}...`);
    console.log(`   Status: ${auctionData[0].status}`);
    
    // Check if payments exist
    const paymentData = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionData[0].id));
    
    if (paymentData.length === 0) {
      console.log('❌ NO PAYMENTS FOUND');
      continue;
    }
    
    console.log(`✅ Payments found: ${paymentData.length}`);
    for (const p of paymentData) {
      console.log(`   - ₦${parseFloat(p.amount).toLocaleString()} (${p.status})`);
    }
    
    // Check verified payments
    const verified = paymentData.filter(p => p.status === 'verified');
    if (verified.length === 0) {
      console.log('⚠️  NO VERIFIED PAYMENTS');
    } else {
      console.log(`✅ Verified: ${verified.length} payments`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  // Check all sold cases
  let casesWithAuction = 0;
  let casesWithPayments = 0;
  let casesWithVerified = 0;
  
  for (const caseItem of soldCases) {
    const auctionData = await db.select().from(auctions).where(eq(auctions.caseId, caseItem.id));
    if (auctionData.length > 0) {
      casesWithAuction++;
      
      const paymentData = await db.select().from(payments).where(eq(payments.auctionId, auctionData[0].id));
      if (paymentData.length > 0) {
        casesWithPayments++;
        
        const verified = paymentData.filter(p => p.status === 'verified');
        if (verified.length > 0) {
          casesWithVerified++;
        }
      }
    }
  }
  
  console.log(`\nSold Cases: ${soldCases.length}`);
  console.log(`With Auction: ${casesWithAuction}`);
  console.log(`With Payments: ${casesWithPayments}`);
  console.log(`With Verified Payments: ${casesWithVerified}`);
  
  console.log('\n❌ PROBLEM IDENTIFIED:');
  console.log(`${soldCases.length - casesWithVerified} sold cases don't have verified payments!`);
}

diagnoseMissingPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
