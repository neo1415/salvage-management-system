/**
 * Simple Revenue Check
 * Quick check of revenue data
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkRevenue() {
  console.log('REVENUE INVESTIGATION\n');
  
  // 1. Sold cases
  const soldCases = await db.select().from(salvageCases).where(eq(salvageCases.status, 'sold'));
  const totalMarketValue = soldCases.reduce((sum, c) => sum + parseFloat(c.marketValue || '0'), 0);
  
  console.log(`Sold Cases: ${soldCases.length}`);
  console.log(`Total Market Value: ₦${totalMarketValue.toLocaleString()}\n`);
  
  // 2. All payments
  const allPayments = await db.select().from(payments);
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  const totalVerified = verifiedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  console.log(`Total Payments: ${allPayments.length}`);
  console.log(`Verified Payments: ${verifiedPayments.length}`);
  console.log(`Total Verified Amount: ₦${totalVerified.toLocaleString()}\n`);
  
  // 3. Payments by status
  const byStatus = allPayments.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Payments by Status:');
  for (const [status, count] of Object.entries(byStatus)) {
    const total = allPayments
      .filter(p => p.status === status)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    console.log(`  ${status}: ${count} (₦${total.toLocaleString()})`);
  }
  
  // 4. Check if page is refreshing issue
  console.log('\n\nPAGE REFRESHING ISSUE:');
  console.log('The page might be refreshing due to:');
  console.log('1. React state updates causing re-renders');
  console.log('2. useEffect dependencies triggering refetches');
  console.log('3. Chart.js re-initialization');
  console.log('4. Date filter changes');
  
  console.log('\nCheck the My Performance page component for:');
  console.log('- useEffect with missing dependencies');
  console.log('- State updates in render');
  console.log('- Chart data recreation on every render');
}

checkRevenue()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
