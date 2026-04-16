/**
 * Simple check: Where are ALL verified payments coming from?
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function findPayments() {
  console.log('FINDING ALL VERIFIED PAYMENTS\n');
  
  const result = await db.execute(sql`
    SELECT 
      p.id as payment_id,
      p.amount,
      p.created_at as payment_created,
      p.payment_reference,
      a.id as auction_id,
      sc.id as case_id,
      sc.claim_reference,
      sc.status as case_status,
      sc.created_at as case_created,
      u.full_name as adjuster_name
    FROM payments p
    LEFT JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN users u ON sc.created_by = u.id
    WHERE p.status = 'verified'
    ORDER BY sc.created_at NULLS LAST
  `);
  
  const payments = Array.isArray(result) ? result : [];
  
  console.log(`Total Verified Payments: ${payments.length}\n`);
  
  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`Total Amount: ₦${total.toLocaleString()}\n`);
  
  // Group by date
  const feb1 = new Date('2026-02-01');
  const beforeFeb = payments.filter(p => p.case_created && new Date(p.case_created) < feb1);
  const afterFeb = payments.filter(p => p.case_created && new Date(p.case_created) >= feb1);
  const noCase = payments.filter(p => !p.case_id);
  
  console.log('='.repeat(80));
  console.log('BREAKDOWN:');
  console.log('='.repeat(80));
  console.log(`Before Feb 1: ${beforeFeb.length} payments - ₦${beforeFeb.reduce((s, p) => s + parseFloat(p.amount), 0).toLocaleString()}`);
  console.log(`After Feb 1: ${afterFeb.length} payments - ₦${afterFeb.reduce((s, p) => s + parseFloat(p.amount), 0).toLocaleString()}`);
  console.log(`No case link: ${noCase.length} payments - ₦${noCase.reduce((s, p) => s + parseFloat(p.amount), 0).toLocaleString()}\n`);
  
  // Show all payments
  console.log('ALL PAYMENTS:');
  console.log('Claim Ref | Adjuster | Case Created | Amount');
  console.log('-'.repeat(80));
  
  for (const p of payments) {
    const caseDate = p.case_created ? new Date(p.case_created).toISOString().split('T')[0] : 'NO CASE';
    const flag = p.case_created && new Date(p.case_created) < feb1 ? ' ⚠️ BEFORE FEB' : '';
    
    console.log(
      `${(p.claim_reference || 'NO CASE').padEnd(15)} | ` +
      `${(p.adjuster_name || 'NO ADJUSTER').substring(0, 20).padEnd(20)} | ` +
      `${caseDate.padEnd(12)} | ` +
      `₦${parseFloat(p.amount).toLocaleString()}${flag}`
    );
  }
  
  console.log('-'.repeat(80));
  console.log(`TOTAL: ₦${total.toLocaleString()}`);
  
  // Earliest case
  const withDates = payments.filter(p => p.case_created);
  if (withDates.length > 0) {
    const earliest = withDates[0];
    console.log(`\nEarliest case: ${new Date(earliest.case_created).toISOString().split('T')[0]} (${earliest.claim_reference})`);
  }
}

findPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
