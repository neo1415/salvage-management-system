/**
 * Populate Ledger from Existing Wallet Transactions
 * 
 * This script migrates historical wallet_transactions into the double-entry ledger system.
 * It creates balanced ledger entries for all existing transactions.
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { walletTransactions, escrowWallets } from '@/lib/db/schema/escrow';
import { ledgerAccounts, ledgerEntries } from '@/lib/db/schema/ledger';
import { eq, sql } from 'drizzle-orm';

async function populateLedger() {
  console.log('🚀 Starting ledger population from wallet transactions...\n');

  try {
    // 1. Get all wallet transactions
    console.log('📊 Fetching wallet transactions...');
    const transactions = await db
      .select()
      .from(walletTransactions)
      .orderBy(walletTransactions.createdAt);

    console.log(`✅ Found ${transactions.length} wallet transactions\n`);

    if (transactions.length === 0) {
      console.log('⚠️  No transactions to migrate');
      return;
    }

    // 2. Get or create NEM accounts
    console.log('🏦 Ensuring NEM accounts exist...');
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

    // 3. Get or create vendor ledger accounts
    console.log('👥 Creating vendor ledger accounts...');
    const vendors = await db.select().from(escrowWallets);
    const vendorAccountMap = new Map<string, string>();

    for (const wallet of vendors) {
      // Check if account exists
      const existing = await db
        .select()
        .from(ledgerAccounts)
        .where(
          sql`${ledgerAccounts.accountType} = 'vendor_wallet' AND ${ledgerAccounts.accountId} = ${wallet.vendorId}`
        )
        .limit(1);

      if (existing.length > 0) {
        vendorAccountMap.set(wallet.vendorId, existing[0].id);
      } else {
        // Create new account
        const [newAccount] = await db
          .insert(ledgerAccounts)
          .values({
            accountType: 'vendor_wallet',
            accountId: wallet.vendorId,
            name: `Vendor ${wallet.vendorId} Wallet`,
          })
          .returning();

        vendorAccountMap.set(wallet.vendorId, newAccount.id);
      }
    }

    console.log(`✅ Created/verified ${vendorAccountMap.size} vendor accounts\n`);

    // 4. Migrate transactions to ledger
    console.log('💰 Migrating transactions to ledger...');
    let migratedCount = 0;
    let skippedCount = 0;

    for (const txn of transactions) {
      // Check if already migrated
      const existing = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.reference, txn.reference))
        .limit(1);

      if (existing.length > 0) {
        skippedCount++;
        continue;
      }

      const vendorAccountId = vendorAccountMap.get(txn.vendorId);
      if (!vendorAccountId) {
        console.log(`⚠️  Skipping transaction ${txn.reference}: vendor account not found`);
        skippedCount++;
        continue;
      }

      const amount = parseFloat(txn.amount);
      const transactionId = crypto.randomUUID();

      // Create double-entry based on transaction type
      if (txn.type === 'credit') {
        // CREDIT: Money coming into vendor wallet
        // Debit: Vendor Wallet (increase)
        // Credit: NEM Paystack (decrease)
        await db.insert(ledgerEntries).values([
          {
            transactionId,
            accountId: vendorAccountId,
            debit: amount,
            credit: 0,
            description: txn.description || `Credit: ${txn.type}`,
            reference: txn.reference,
            metadata: JSON.stringify({
              originalType: txn.type,
              status: txn.status,
              vendorId: txn.vendorId,
            }),
            createdAt: txn.createdAt,
          },
          {
            transactionId,
            accountId: nemAccountId,
            debit: 0,
            credit: amount,
            description: txn.description || `Credit to vendor: ${txn.type}`,
            reference: txn.reference,
            metadata: JSON.stringify({
              originalType: txn.type,
              status: txn.status,
              vendorId: txn.vendorId,
            }),
            createdAt: txn.createdAt,
          },
        ]);
      } else if (txn.type === 'debit') {
        // DEBIT: Money leaving vendor wallet
        // Debit: NEM Paystack (increase)
        // Credit: Vendor Wallet (decrease)
        await db.insert(ledgerEntries).values([
          {
            transactionId,
            accountId: nemAccountId,
            debit: amount,
            credit: 0,
            description: txn.description || `Debit from vendor: ${txn.type}`,
            reference: txn.reference,
            metadata: JSON.stringify({
              originalType: txn.type,
              status: txn.status,
              vendorId: txn.vendorId,
            }),
            createdAt: txn.createdAt,
          },
          {
            transactionId,
            accountId: vendorAccountId,
            debit: 0,
            credit: amount,
            description: txn.description || `Debit: ${txn.type}`,
            reference: txn.reference,
            metadata: JSON.stringify({
              originalType: txn.type,
              status: txn.status,
              vendorId: txn.vendorId,
            }),
            createdAt: txn.createdAt,
          },
        ]);
      }

      migratedCount++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Migrated: ${migratedCount} transactions`);
    console.log(`   - Skipped: ${skippedCount} transactions (already in ledger)`);

    // 5. Verify ledger balance matches wallet balance
    console.log('\n🔍 Verifying ledger balances...');
    
    for (const [vendorId, accountId] of vendorAccountMap.entries()) {
      // Get wallet balance
      const [wallet] = await db
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendorId))
        .limit(1);

      if (!wallet) continue;

      // Calculate ledger balance
      const entries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, accountId));

      const ledgerBalance = entries.reduce((sum, entry) => {
        return sum + parseFloat(entry.debit.toString()) - parseFloat(entry.credit.toString());
      }, 0);

      const walletBalance = parseFloat(wallet.availableBalance) + parseFloat(wallet.frozenAmount);

      const discrepancy = Math.abs(ledgerBalance - walletBalance);

      if (discrepancy > 0.01) {
        console.log(`⚠️  Vendor ${vendorId}:`);
        console.log(`   Wallet: ₦${walletBalance.toFixed(2)}`);
        console.log(`   Ledger: ₦${ledgerBalance.toFixed(2)}`);
        console.log(`   Discrepancy: ₦${discrepancy.toFixed(2)}`);
      } else {
        console.log(`✅ Vendor ${vendorId}: Balanced (₦${walletBalance.toFixed(2)})`);
      }
    }

    console.log('\n✅ Ledger population complete!');
  } catch (error) {
    console.error('❌ Error populating ledger:', error);
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
