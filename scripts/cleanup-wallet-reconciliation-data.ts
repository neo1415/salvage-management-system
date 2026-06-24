/**
 * One-time cleanup: zero automated test wallet balances and repair operational ledger drift.
 *
 * Usage:
 *   npx tsx scripts/cleanup-wallet-reconciliation-data.ts          # dry run
 *   npx tsx scripts/cleanup-wallet-reconciliation-data.ts --execute
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { isAutomatedTestWalletEmail } from '@/features/reconciliation/utils/paystack-reference';
import { ledgerService } from '@/features/ledger/services/ledger.service';
import {
  compareWalletVsLedgerBalances,
  getLedgerVendorBalances,
} from '@/features/reconciliation/services/reconciliation.service';

const EXECUTE = process.argv.includes('--execute');

async function zeroTestWallets() {
  const rows = await db
    .select({
      walletId: escrowWallets.id,
      vendorId: escrowWallets.vendorId,
      balance: escrowWallets.balance,
      available: escrowWallets.availableBalance,
      frozen: escrowWallets.frozenAmount,
      forfeited: escrowWallets.forfeitedAmount,
      email: users.email,
    })
    .from(escrowWallets)
    .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id))
    .leftJoin(users, eq(vendors.userId, users.id));

  const ledgerBalances = await getLedgerVendorBalances();
  let zeroed = 0;
  let ledgerAdjusted = 0;

  for (const row of rows) {
    if (!isAutomatedTestWalletEmail(row.email)) continue;

    const balance = parseFloat(row.balance);
    const available = parseFloat(row.available);
    const frozen = parseFloat(row.frozen);
    const forfeited = parseFloat(row.forfeited ?? '0');
    if (balance === 0 && available === 0 && frozen === 0 && forfeited === 0) continue;

    const ledgerBalance =
      ledgerBalances.byVendor.find((v) => v.vendorId === row.vendorId)?.balance ?? 0;

    console.log(
      `[test zero] ${row.email} wallet=₦${balance.toLocaleString()} ledger=₦${ledgerBalance.toLocaleString()}`
    );

    if (EXECUTE) {
      await db.transaction(async (tx) => {
        await tx
          .update(escrowWallets)
          .set({
            balance: '0.00',
            availableBalance: '0.00',
            frozenAmount: '0.00',
            forfeitedAmount: '0.00',
            updatedAt: new Date(),
          })
          .where(eq(escrowWallets.id, row.walletId));

        if (balance > 0) {
          await tx.insert(walletTransactions).values({
            walletId: row.walletId,
            type: 'debit',
            amount: balance.toFixed(2),
            balanceAfter: '0.00',
            reference: `CLEANUP_TEST_${row.vendorId.substring(0, 8)}`,
            description: 'Automated test wallet balance cleared (system cleanup)',
          });
        }

        if (Math.abs(ledgerBalance) > 0.01) {
          const ref = `RECON_ZERO_TEST_${row.vendorId}`;
          await ledgerService.recordReconciliationAdjustment(
            tx,
            row.vendorId,
            0,
            ledgerBalance,
            ref,
            'Test wallet cleanup — ledger aligned to zero'
          );
        }
      });
    }

    zeroed += 1;
    if (Math.abs(ledgerBalance) > 0.01) ledgerAdjusted += 1;
  }

  return { zeroed, ledgerAdjusted };
}

async function repairOperationalLedger() {
  let comparison = await compareWalletVsLedgerBalances();
  let repaired = 0;

  for (const disc of comparison.discrepancies) {
    console.log(
      `[ledger repair] ${disc.vendorEmail ?? disc.vendorId} wallet=₦${disc.walletBalance.toLocaleString()} ledger=₦${disc.ledgerBalance.toLocaleString()} gap=₦${disc.discrepancy.toLocaleString()}`
    );

    if (EXECUTE) {
      const ref = `RECON_ADJ_${disc.vendorId.substring(0, 8)}_${Date.now()}`;
      await db.transaction(async (tx) => {
        await ledgerService.recordReconciliationAdjustment(
          tx,
          disc.vendorId,
          disc.walletBalance,
          disc.ledgerBalance,
          ref,
          'Historical ledger alignment to wallet balance'
        );
      });
    }
    repaired += 1;
  }

  if (EXECUTE && comparison.discrepancies.length > 0) {
    comparison = await compareWalletVsLedgerBalances();
    if (comparison.discrepancies.length > 0) {
      console.warn(
        `Warning: ${comparison.discrepancies.length} discrepancy(ies) remain — re-run script if needed`
      );
    }
  }

  return { repaired, remaining: comparison.discrepancies.length };
}

async function main() {
  console.log(`\n=== Wallet reconciliation cleanup (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===\n`);

  const testResult = await zeroTestWallets();
  console.log(
    `\nTest wallets to zero: ${testResult.zeroed} (${testResult.ledgerAdjusted} need ledger adjustment)\n`
  );

  const repairResult = await repairOperationalLedger();
  console.log(
    `\nOperational ledger repairs: ${repairResult.repaired} (${repairResult.remaining} remaining)\n`
  );

  if (!EXECUTE) {
    console.log('Dry run only. Re-run with --execute to apply changes.\n');
    return;
  }

  const after = await compareWalletVsLedgerBalances();
  const ledgerTotal = (await getLedgerVendorBalances()).total;

  console.log('After cleanup:');
  console.log(`  Ledger total (main accounts): ₦${ledgerTotal.toLocaleString()}`);
  console.log(`  Remaining discrepancies: ${after.discrepancies.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
