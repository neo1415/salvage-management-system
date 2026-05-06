/**
 * Simple Ledger Population Script
 * 
 * Populates the ledger by calculating net balances from escrow wallets
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { ledgerAccounts, ledgerEntries } from '@/lib/db/schema/ledger';
import { sql } from 'drizzle-orm';

async function populateLedger() {
  console.log('🚀 Starting simple ledger population...\n');

  try {
    // 1. Get NEM Paystack account
    console.log('🏦 Getting NEM Paystack account...');
    const nemPaystackAccount = await db
      .select()
      .from(ledgerAccounts)
      .where(
        sql`${ledgerAccounts.accountType} = 'nem_paystack' AND ${ledgerAccounts.accountId} = 'nem'`
      )
      .limit(1);

    if (nemPaystackAccount.length === 0) {
      console.log('❌ NEM Paystack account not found. Run ledger migration first.');
      return;
    }

    const nemAccountId = nemPaystackAccount[0].id;
    console.log(`✅ NEM Paystack account: ${nemAccountId}\n`);

    // 2. Get all escrow wallets
    console.log('👥 Fetching escrow wallets...');
    const wallets = await db.select().from(escrowWallets);
    console.log(`✅ Found ${wallets.length} wallets\n`);

    let createdCount = 0;
    let totalBalance = 0;

    // 3. For each wallet, create ledger account and initial balance entry
    console.log('💰 Creating ledger entries...');
    for (const wallet of wallets) {
      // Check if vendor ledger account exists
      const existing = await db
        .select()
        .from(ledgerAccounts)
        .where(
          sql`${ledgerAccounts.accountType} = 'vendor_wallet' AND ${ledgerAccounts.accountId} = ${wallet.vendorId}`
        )
        .limit(1);

      let vendorAccountId: string;

      if (existing.length > 0) {
        vendorAccountId = existing[0].id;
      } else {
        // Create vendor ledger account
        const [newAccount] = await db
          .insert(ledgerAccounts)
          .values({
            accountType: 'vendor_wallet',
            accountId: wallet.vendorId,
            name: `Vendor ${wallet.vendorId} Wallet`,
          })
          .returning();

        vendorAccountId = newAccount.id;
      }

      // Calculate total balance (available + frozen)
      const totalWalletBalance =
        parseFloat(wallet.availableBalance) + parseFloat(wallet.frozenAmount);

      if (totalWalletBalance > 0) {
        // Check if entry already exists
        const existingEntry = await db
          .select()
          .from(ledgerEntries)
          .where(
            sql`${ledgerEntries.reference} = ${'INITIAL_BALANCE_' + wallet.vendorId}`
          )
          .limit(1);

        if (existingEntry.length === 0) {
          const transactionId = crypto.randomUUID();

          // Create double-entry for initial balance
          // Debit: Vendor Wallet (increase)
          // Credit: NEM Paystack (decrease - money came from NEM)
          await db.insert(ledgerEntries).values([
            {
              transactionId,
              accountId: vendorAccountId,
              debit: totalWalletBalance,
              credit: 0,
              description: `Initial balance migration`,
              reference: `INITIAL_BALANCE_${wallet.vendorId}`,
              metadata: JSON.stringify({
                availableBalance: wallet.availableBalance,
                frozenAmount: wallet.frozenAmount,
                migratedAt: new Date().toISOString(),
              }),
              createdAt: wallet.createdAt,
            },
            {
              transactionId,
              accountId: nemAccountId,
              debit: 0,
              credit: totalWalletBalance,
              description: `Initial balance migration for vendor ${wallet.vendorId}`,
              reference: `INITIAL_BALANCE_${wallet.vendorId}`,
              metadata: JSON.stringify({
                availableBalance: wallet.availableBalance,
                frozenAmount: wallet.frozenAmount,
                migratedAt: new Date().toISOString(),
              }),
              createdAt: wallet.createdAt,
            },
          ]);

          createdCount++;
          totalBalance += totalWalletBalance;
        }
      }
    }

    console.log(`\n✅ Ledger population complete!`);
    console.log(`   - Created: ${createdCount} ledger entries`);
    console.log(`   - Total balance: ₦${totalBalance.toFixed(2)}`);

    // 4. Verify balances
    console.log('\n🔍 Verifying ledger balances...');
    
    for (const wallet of wallets) {
      const vendorAccount = await db
        .select()
        .from(ledgerAccounts)
        .where(
          sql`${ledgerAccounts.accountType} = 'vendor_wallet' AND ${ledgerAccounts.accountId} = ${wallet.vendorId}`
        )
        .limit(1);

      if (vendorAccount.length === 0) continue;

      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(sql`${ledgerEntries.accountId} = ${vendorAccount[0].id}`);

      const ledgerBalance = entries.reduce((sum, entry) => {
        return sum + parseFloat(entry.debit.toString()) - parseFloat(entry.credit.toString());
      }, 0);

      const walletBalance = parseFloat(wallet.availableBalance) + parseFloat(wallet.frozenAmount);
      const discrepancy = Math.abs(ledgerBalance - walletBalance);

      if (discrepancy > 0.01) {
        console.log(`⚠️  Vendor ${wallet.vendorId}:`);
        console.log(`   Wallet: ₦${walletBalance.toFixed(2)}`);
        console.log(`   Ledger: ₦${ledgerBalance.toFixed(2)}`);
        console.log(`   Discrepancy: ₦${discrepancy.toFixed(2)}`);
      } else {
        console.log(`✅ Vendor ${wallet.vendorId}: Balanced (₦${walletBalance.toFixed(2)})`);
      }
    }

    console.log('\n✅ All done!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

populateLedger()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
