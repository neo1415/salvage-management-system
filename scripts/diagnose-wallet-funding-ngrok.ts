import { db } from '@/lib/db/drizzle';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { desc } from 'drizzle-orm';

/**
 * Diagnostic script to check wallet funding flow with ngrok
 * 
 * This script checks:
 * 1. What NEXT_PUBLIC_APP_URL is actually being used
 * 2. Recent wallet funding transactions
 * 3. Paystack webhook configuration
 */

async function diagnoseWalletFundingNgrok() {
  console.log('🔍 Diagnosing Wallet Funding with ngrok\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
  console.log('PAYSTACK_SECRET_KEY:', process.env.PAYSTACK_SECRET_KEY ? '✅ Set' : '❌ Not set');
  console.log('');

  // Check recent wallet transactions
  console.log('💰 Recent Wallet Transactions (last 10):');
  const recentTransactions = await db
    .select()
    .from(walletTransactions)
    .orderBy(desc(walletTransactions.createdAt))
    .limit(10);

  if (recentTransactions.length === 0) {
    console.log('No wallet transactions found');
  } else {
    recentTransactions.forEach((tx) => {
      console.log(`- ${tx.type.toUpperCase()}: ₦${parseFloat(tx.amount).toLocaleString()}`);
      console.log(`  Reference: ${tx.reference}`);
      console.log(`  Description: ${tx.description}`);
      console.log(`  Created: ${tx.createdAt.toISOString()}`);
      console.log('');
    });
  }

  // Check if there are any pending wallet funding transactions
  const pendingTransactions = recentTransactions.filter(
    (tx) => tx.type === 'credit' && tx.description.includes('Pending confirmation')
  );

  if (pendingTransactions.length > 0) {
    console.log('⚠️  Found pending wallet funding transactions:');
    pendingTransactions.forEach((tx) => {
      console.log(`- Reference: ${tx.reference}`);
      console.log(`  Amount: ₦${parseFloat(tx.amount).toLocaleString()}`);
      console.log(`  Created: ${tx.createdAt.toISOString()}`);
    });
    console.log('');
  }

  // Instructions
  console.log('📝 Next Steps:');
  console.log('1. Make sure NEXT_PUBLIC_APP_URL in .env is set to your ngrok URL');
  console.log('2. RESTART your dev server (npm run dev) - NEXT_PUBLIC_* vars are baked at build time');
  console.log('3. Update Paystack webhook to: https://your-ngrok-url.ngrok-free.app/api/webhooks/paystack');
  console.log('4. Try wallet funding again');
  console.log('');
  console.log('🔍 To check if webhook is being called:');
  console.log('- Check your terminal for webhook logs');
  console.log('- Check ngrok dashboard at http://127.0.0.1:4040');
  console.log('- Look for POST requests to /api/webhooks/paystack');
}

diagnoseWalletFundingNgrok()
  .then(() => {
    console.log('✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
