/**
 * Double-Entry Ledger Service
 * 
 * Provides true accounting integrity by ensuring every transaction has two sides.
 * 
 * CRITICAL RULES:
 * 1. Every transaction MUST have balanced debits and credits
 * 2. Never modify existing payment flows - only ADD ledger entries
 * 3. Ledger writes happen AFTER existing operations succeed
 * 4. If ledger write fails, log error but don't block payment
 * 
 * Example: Vendor funds wallet with ₦100k
 * - Debit: vendor_wallet account (increases vendor balance)
 * - Credit: nem_paystack account (increases NEM Paystack balance)
 */

import { db } from '@/lib/db';
import { ledgerAccounts, ledgerEntries, ledgerTransactionSummary } from '@/lib/db/schema/ledger';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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
  metadata?: Record<string, any>;
}

export class LedgerService {
  /**
   * Get or create a ledger account
   */
  private async getOrCreateAccount(
    accountType: 'vendor_wallet' | 'nem_paystack' | 'nem_bank',
    accountId: string,
    name: string
  ) {
    // Try to find existing account
    const existing = await db
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

    // Create new account
    const [newAccount] = await db
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
   * Record a double-entry transaction
   * 
   * CRITICAL: This validates that debits = credits before inserting
   */
  async recordTransaction(transaction: LedgerTransaction): Promise<void> {
    const { transactionId, entries, reference, metadata } = transaction;

    // Validate: Calculate total debits and credits
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
    const discrepancy = Math.abs(totalDebit - totalCredit);

    // Allow small rounding errors (< 1 kobo)
    if (discrepancy >= 0.01) {
      throw new Error(
        `Ledger transaction ${transactionId} is unbalanced: ` +
        `debit=${totalDebit}, credit=${totalCredit}, discrepancy=${discrepancy}`
      );
    }

    // Get or create accounts for all entries
    const accountPromises = entries.map(entry =>
      this.getOrCreateAccount(
        entry.accountType,
        entry.accountId,
        `${entry.accountType}:${entry.accountId}`
      )
    );
    const accounts = await Promise.all(accountPromises);

    // Create ledger entries
    const ledgerEntryValues = entries.map((entry, index) => ({
      transactionId,
      accountId: accounts[index].id,
      debit: entry.debit.toFixed(2),
      credit: entry.credit.toFixed(2),
      description: entry.description,
      reference: reference || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }));

    // Insert all entries in a single transaction
    await db.insert(ledgerEntries).values(ledgerEntryValues);

    console.log(`[Ledger] Recorded transaction ${transactionId} with ${entries.length} entries`);
  }

  /**
   * Record wallet funding transaction
   * 
   * Example: Vendor funds wallet with ₦100k
   * - Debit: vendor_wallet (vendor balance increases)
   * - Credit: nem_paystack (NEM Paystack balance increases)
   */
  async recordWalletFunding(
    vendorId: string,
    amount: number,
    reference: string,
    description: string
  ): Promise<void> {
    const transactionId = randomUUID();

    await this.recordTransaction({
      transactionId,
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

  /**
   * Record deposit freeze transaction
   * 
   * Note: This is an internal transfer within vendor_wallet
   * - Debit: vendor_wallet:frozen
   * - Credit: vendor_wallet:available
   */
  async recordDepositFreeze(
    vendorId: string,
    amount: number,
    auctionId: string,
    description: string
  ): Promise<void> {
    const transactionId = randomUUID();

    await this.recordTransaction({
      transactionId,
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

  /**
   * Record deposit unfreeze transaction
   * 
   * Reverse of freeze:
   * - Debit: vendor_wallet:available
   * - Credit: vendor_wallet:frozen
   */
  async recordDepositUnfreeze(
    vendorId: string,
    amount: number,
    auctionId: string,
    description: string
  ): Promise<void> {
    const transactionId = randomUUID();

    await this.recordTransaction({
      transactionId,
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

  /**
   * Record payment debit transaction
   * 
   * Example: Vendor pays ₦120k for auction
   * - Debit: nem_paystack (NEM receives payment)
   * - Credit: vendor_wallet (vendor balance decreases)
   */
  async recordPaymentDebit(
    vendorId: string,
    amount: number,
    auctionId: string,
    reference: string,
    description: string
  ): Promise<void> {
    const transactionId = randomUUID();

    await this.recordTransaction({
      transactionId,
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

  /**
   * Record fund release to finance
   * 
   * Example: Release ₦120k to NEM bank account
   * - Debit: nem_bank (NEM bank balance increases)
   * - Credit: nem_paystack (NEM Paystack balance decreases)
   */
  async recordFundRelease(
    amount: number,
    auctionId: string,
    reference: string,
    description: string
  ): Promise<void> {
    const transactionId = randomUUID();

    await this.recordTransaction({
      transactionId,
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
   * Get account balance from ledger
   * 
   * Balance = SUM(debits) - SUM(credits)
   */
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

  /**
   * Validate transaction balance
   * 
   * Returns true if transaction is balanced (debits = credits)
   */
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

    return discrepancy < 0.01; // Allow 1 kobo rounding error
  }

  /**
   * Get unbalanced transactions
   * 
   * Returns all transactions where debits != credits
   */
  async getUnbalancedTransactions(): Promise<any[]> {
    const result = await db
      .select()
      .from(ledgerTransactionSummary)
      .where(eq(ledgerTransactionSummary.isBalanced, 'false'));

    return result;
  }

  /**
   * Refresh ledger transaction summary materialized view
   */
  async refreshTransactionSummary(): Promise<void> {
    await db.execute(sql`SELECT refresh_ledger_transaction_summary()`);
    console.log('[Ledger] Refreshed transaction summary materialized view');
  }
}

export const ledgerService = new LedgerService();
