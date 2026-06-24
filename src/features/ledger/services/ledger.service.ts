/**
 * Double-Entry Ledger Service
 *
 * Audit-only mirror of wallet movements — never charges Paystack or users twice.
 * Every wallet operation should record matching ledger entries in the same DB transaction.
 */

import { db } from '@/lib/db';
import { ledgerAccounts, ledgerEntries, ledgerTransactionSummary } from '@/lib/db/schema/ledger';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/** DB client or transaction — both support ledger inserts */
export type LedgerDbExecutor = Pick<typeof db, 'select' | 'insert'>;

export interface LedgerEntry {
  accountType: 'vendor_wallet' | 'nem_paystack' | 'nem_bank';
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

export interface LedgerTransaction {
  transactionId: string;
  entries: LedgerEntry[];
  reference?: string;
  metadata?: Record<string, unknown>;
}

export class LedgerService {
  async hasLedgerReference(executor: LedgerDbExecutor, reference: string): Promise<boolean> {
    if (!reference?.trim()) return false;
    const existing = await executor
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.reference, reference))
      .limit(1);
    return existing.length > 0;
  }

  private async getOrCreateAccount(
    executor: LedgerDbExecutor,
    accountType: 'vendor_wallet' | 'nem_paystack' | 'nem_bank',
    accountId: string,
    name: string
  ) {
    const existing = await executor
      .select()
      .from(ledgerAccounts)
      .where(
        and(
          eq(ledgerAccounts.accountType, accountType),
          eq(ledgerAccounts.accountId, accountId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [newAccount] = await executor
      .insert(ledgerAccounts)
      .values({
        accountType,
        accountId,
        name,
      })
      .returning();

    return newAccount;
  }

  /**
   * Record a double-entry transaction. Skips insert if reference already exists (idempotent).
   */
  async recordTransaction(
    executor: LedgerDbExecutor,
    transaction: LedgerTransaction
  ): Promise<void> {
    const { transactionId, entries, reference, metadata } = transaction;

    if (reference && await this.hasLedgerReference(executor, reference)) {
      return;
    }

    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
    const discrepancy = Math.abs(totalDebit - totalCredit);

    if (discrepancy >= 0.01) {
      throw new Error(
        `Ledger transaction ${transactionId} is unbalanced: ` +
          `debit=${totalDebit}, credit=${totalCredit}, discrepancy=${discrepancy}`
      );
    }

    const accounts = await Promise.all(
      entries.map((entry) =>
        this.getOrCreateAccount(
          executor,
          entry.accountType,
          entry.accountId,
          `${entry.accountType}:${entry.accountId}`
        )
      )
    );

    const ledgerEntryValues = entries.map((entry, index) => ({
      transactionId,
      accountId: accounts[index].id,
      debit: entry.debit.toFixed(2),
      credit: entry.credit.toFixed(2),
      description: entry.description,
      reference: reference || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }));

    await executor.insert(ledgerEntries).values(ledgerEntryValues);
  }

  async recordWalletFunding(
    executor: LedgerDbExecutor,
    vendorId: string,
    amount: number,
    reference: string,
    description: string
  ): Promise<void> {
    await this.recordTransaction(executor, {
      transactionId: randomUUID(),
      reference,
      entries: [
        {
          accountType: 'vendor_wallet',
          accountId: vendorId,
          debit: amount,
          credit: 0,
          description: `${description} (Vendor)`,
        },
        {
          accountType: 'nem_paystack',
          accountId: 'nem',
          debit: 0,
          credit: amount,
          description: `${description} (NEM Paystack)`,
        },
      ],
      metadata: {
        type: 'wallet_funding',
        vendorId,
        amount,
      },
    });
  }

  async recordDepositFreeze(
    executor: LedgerDbExecutor,
    vendorId: string,
    amount: number,
    auctionId: string,
    description: string,
    reference?: string
  ): Promise<void> {
    await this.recordTransaction(executor, {
      transactionId: randomUUID(),
      reference: reference ?? `FREEZE_${auctionId}`,
      entries: [
        {
          accountType: 'vendor_wallet',
          accountId: `${vendorId}:frozen`,
          debit: amount,
          credit: 0,
          description: `${description} (Frozen)`,
        },
        {
          accountType: 'vendor_wallet',
          accountId: `${vendorId}:available`,
          debit: 0,
          credit: amount,
          description: `${description} (Available)`,
        },
      ],
      metadata: {
        type: 'deposit_freeze',
        vendorId,
        auctionId,
        amount,
      },
    });
  }

  async recordDepositUnfreeze(
    executor: LedgerDbExecutor,
    vendorId: string,
    amount: number,
    auctionId: string,
    description: string,
    reference?: string
  ): Promise<void> {
    await this.recordTransaction(executor, {
      transactionId: randomUUID(),
      reference: reference ?? `UNFREEZE_${auctionId}`,
      entries: [
        {
          accountType: 'vendor_wallet',
          accountId: `${vendorId}:available`,
          debit: amount,
          credit: 0,
          description: `${description} (Available)`,
        },
        {
          accountType: 'vendor_wallet',
          accountId: `${vendorId}:frozen`,
          debit: 0,
          credit: amount,
          description: `${description} (Frozen)`,
        },
      ],
      metadata: {
        type: 'deposit_unfreeze',
        vendorId,
        auctionId,
        amount,
      },
    });
  }

  async recordPaymentDebit(
    executor: LedgerDbExecutor,
    vendorId: string,
    amount: number,
    auctionId: string,
    reference: string,
    description: string
  ): Promise<void> {
    await this.recordTransaction(executor, {
      transactionId: randomUUID(),
      reference,
      entries: [
        {
          accountType: 'nem_paystack',
          accountId: 'nem',
          debit: amount,
          credit: 0,
          description: `${description} (NEM Paystack)`,
        },
        {
          accountType: 'vendor_wallet',
          accountId: vendorId,
          debit: 0,
          credit: amount,
          description: `${description} (Vendor)`,
        },
      ],
      metadata: {
        type: 'payment_debit',
        vendorId,
        auctionId,
        amount,
      },
    });
  }

  async recordFundRelease(
    executor: LedgerDbExecutor,
    amount: number,
    auctionId: string,
    reference: string,
    description: string
  ): Promise<void> {
    await this.recordTransaction(executor, {
      transactionId: randomUUID(),
      reference,
      entries: [
        {
          accountType: 'nem_bank',
          accountId: 'nem',
          debit: amount,
          credit: 0,
          description: `${description} (NEM Bank)`,
        },
        {
          accountType: 'nem_paystack',
          accountId: 'nem',
          debit: 0,
          credit: amount,
          description: `${description} (NEM Paystack)`,
        },
      ],
      metadata: {
        type: 'fund_release',
        auctionId,
        amount,
      },
    });
  }

  /**
   * Bring a vendor's main ledger account in line with the wallet balance (historical repair only).
   * Wallet balance is the source of truth for what vendors can spend.
   */
  async recordReconciliationAdjustment(
    executor: LedgerDbExecutor,
    vendorId: string,
    walletBalance: number,
    ledgerBalance: number,
    reference: string,
    description: string
  ): Promise<void> {
    const diff = walletBalance - ledgerBalance;
    if (Math.abs(diff) < 0.01) return;

    const amount = Math.abs(diff);

    if (diff > 0) {
      await this.recordTransaction(executor, {
        transactionId: randomUUID(),
        reference,
        entries: [
          {
            accountType: 'vendor_wallet',
            accountId: vendorId,
            debit: amount,
            credit: 0,
            description: `${description} (Vendor)`,
          },
          {
            accountType: 'nem_paystack',
            accountId: 'nem',
            debit: 0,
            credit: amount,
            description: `${description} (NEM Paystack)`,
          },
        ],
        metadata: { type: 'reconciliation_adjustment', vendorId, walletBalance, ledgerBalance },
      });
    } else {
      await this.recordTransaction(executor, {
        transactionId: randomUUID(),
        reference,
        entries: [
          {
            accountType: 'nem_paystack',
            accountId: 'nem',
            debit: amount,
            credit: 0,
            description: `${description} (NEM Paystack)`,
          },
          {
            accountType: 'vendor_wallet',
            accountId: vendorId,
            debit: 0,
            credit: amount,
            description: `${description} (Vendor)`,
          },
        ],
        metadata: { type: 'reconciliation_adjustment', vendorId, walletBalance, ledgerBalance },
      });
    }
  }

  async getAccountBalance(
    accountType: 'vendor_wallet' | 'nem_paystack' | 'nem_bank',
    accountId: string
  ): Promise<number> {
    const account = await db
      .select()
      .from(ledgerAccounts)
      .where(
        and(
          eq(ledgerAccounts.accountType, accountType),
          eq(ledgerAccounts.accountId, accountId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return 0;
    }

    const result = await db
      .select({
        balance: sql<string>`COALESCE(SUM(${ledgerEntries.debit}) - SUM(${ledgerEntries.credit}), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, account[0].id));

    return parseFloat(result[0].balance);
  }

  async validateTransactionBalance(transactionId: string): Promise<boolean> {
    const result = await db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${ledgerEntries.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${ledgerEntries.credit}), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.transactionId, transactionId));

    const totalDebit = parseFloat(result[0].totalDebit);
    const totalCredit = parseFloat(result[0].totalCredit);
    const discrepancy = Math.abs(totalDebit - totalCredit);

    return discrepancy < 0.01;
  }

  async getUnbalancedTransactions(): Promise<typeof ledgerTransactionSummary.$inferSelect[]> {
    return await db
      .select()
      .from(ledgerTransactionSummary)
      .where(eq(ledgerTransactionSummary.isBalanced, 'false'));
  }

  async refreshTransactionSummary(): Promise<void> {
    await db.execute(sql`SELECT refresh_ledger_transaction_summary()`);
  }
}

export const ledgerService = new LedgerService();
