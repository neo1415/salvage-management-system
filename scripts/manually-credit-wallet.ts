/**
 * Manually Credit Wallet Script
 * 
 * This script manually credits a vendor's wallet for testing purposes
 * when Paystack webhooks can't reach localhost in development.
 * 
 * Usage: npx tsx scripts/manually-credit-wallet.ts
 */

import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  try {
    console.log('\n🔧 Manual Wallet Credit Tool\n');
    console.log('This tool manually credits a vendor wallet for testing.\n');

    // Get user email
    const email = await question('Enter vendor email: ');

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim()))
      .limit(1);

    if (!user) {
      console.error('❌ User not found');
      rl.close();
      return;
    }

    // Find vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      console.error('❌ Vendor profile not found');
      rl.close();
      return;
    }

    // Find or create wallet
    let [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendor.id))
      .limit(1);

    if (!wallet) {
      console.log('📝 Creating wallet...');
      [wallet] = await db
        .insert(escrowWallets)
        .values({
          vendorId: vendor.id,
          balance: '0',
          availableBalance: '0',
          frozenAmount: '0',
        })
        .returning();
    }

    console.log(`\n✅ Found wallet for ${user.fullName}`);
    console.log(`Current Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
    console.log(`Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
    console.log(`Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}\n`);

    // Get amount to credit
    const amountStr = await question('Enter amount to credit (e.g., 60000): ');
    const amount = parseFloat(amountStr.trim());

    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid amount');
      rl.close();
      return;
    }

    // Confirm
    const confirm = await question(`\nCredit ₦${amount.toLocaleString()} to ${user.fullName}'s wallet? (yes/no): `);
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled');
      rl.close();
      return;
    }

    // Calculate new balances
    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);
    const newBalance = currentBalance + amount;
    const newAvailable = currentAvailable + amount;

    // Generate reference
    const reference = `MANUAL_CREDIT_${Date.now()}`;

    // Update wallet
    await db
      .update(escrowWallets)
      .set({
        balance: newBalance.toString(),
        availableBalance: newAvailable.toString(),
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, wallet.id));

    // Create transaction record
    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'credit',
      amount: amount.toString(),
      balanceAfter: newBalance.toString(),
      reference,
      description: `Manual wallet credit for testing - ${new Date().toLocaleString()}`,
    });

    console.log('\n✅ Wallet credited successfully!');
    console.log(`New Balance: ₦${newBalance.toLocaleString()}`);
    console.log(`New Available: ₦${newAvailable.toLocaleString()}`);
    console.log(`Reference: ${reference}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
