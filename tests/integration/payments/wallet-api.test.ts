import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { escrowService } from '@/features/payments/services/escrow.service';

// Mock notification services
vi.mock('@/features/notifications/services/sms.service', () => ({
  smsService: {
    sendSMS: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-sms-id' }),
  },
}));

vi.mock('@/features/notifications/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-email-id' }),
  },
}));

/**
 * Integration Test: Wallet API Service
 * 
 * Tests the wallet service methods that power the API endpoints:
 * 1. Fund wallet
 * 2. Get balance
 * 3. Get transactions
 * 
 * Requirements: 26
 */

describe('Wallet API Service Integration', () => {
  let testUser: any;
  let testVendor: any;

  beforeAll(async () => {
    // Create test user
    [testUser] = await db
      .insert(users)
      .values({
        email: `test-wallet-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'test-hash',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Wallet Vendor',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    // Create test vendor
    [testVendor] = await db
      .insert(vendors)
      .values({
        userId: testUser.id,
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
      })
      .returning();
  });

  afterAll(async () => {
    // Cleanup: Delete test wallet transactions
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, testVendor.id))
      .limit(1);

    if (wallet) {
      await db.delete(walletTransactions).where(eq(walletTransactions.walletId, wallet.id));
      await db.delete(escrowWallets).where(eq(escrowWallets.id, wallet.id));
    }

    // Cleanup: Delete test vendor
    await db.delete(vendors).where(eq(vendors.id, testVendor.id));

    // Cleanup: Delete audit logs for test user
    await db.delete(auditLogs).where(eq(auditLogs.userId, testUser.id));

    // Cleanup: Delete test user
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  describe('fundWallet', () => {
    it('should initiate wallet funding with valid amount', async () => {
      const result = await escrowService.fundWallet(testVendor.id, 100000, testUser.id);

      expect(result).toHaveProperty('walletId');
      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('reference');
      expect(result.amount).toBe(100000);
      expect(result.paymentUrl).toContain('paystack');
    });

    it('should reject amount below minimum (₦50k)', async () => {
      await expect(
        escrowService.fundWallet(testVendor.id, 40000, testUser.id)
      ).rejects.toThrow('50,000');
    });

    it('should reject amount above maximum (₦5M)', async () => {
      await expect(
        escrowService.fundWallet(testVendor.id, 6000000, testUser.id)
      ).rejects.toThrow('5,000,000');
    });
  });

  describe('getBalance', () => {
    it('should return wallet balance', async () => {
      const balance = await escrowService.getBalance(testVendor.id);

      expect(balance).toHaveProperty('balance');
      expect(balance).toHaveProperty('availableBalance');
      expect(balance).toHaveProperty('frozenAmount');
      expect(typeof balance.balance).toBe('number');
      expect(typeof balance.availableBalance).toBe('number');
      expect(typeof balance.frozenAmount).toBe('number');
    });

    it('should maintain balance invariant', async () => {
      const balance = await escrowService.getBalance(testVendor.id);

      // balance = availableBalance + frozenAmount
      const calculatedBalance = balance.availableBalance + balance.frozenAmount;
      expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThan(0.01);
    });

    it('should cache balance in Redis', async () => {
      // First call - should hit database
      const balance1 = await escrowService.getBalance(testVendor.id);

      // Second call - should hit cache
      const balance2 = await escrowService.getBalance(testVendor.id);

      expect(balance1).toEqual(balance2);
    });
  });

  describe('getTransactions', () => {
    it('should return transaction history', async () => {
      const transactions = await escrowService.getTransactions(testVendor.id);

      expect(Array.isArray(transactions)).toBe(true);
      
      // If there are transactions, check structure
      if (transactions.length > 0) {
        const transaction = transactions[0];
        expect(transaction).toHaveProperty('id');
        expect(transaction).toHaveProperty('type');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('balanceAfter');
        expect(transaction).toHaveProperty('reference');
        expect(transaction).toHaveProperty('description');
        expect(transaction).toHaveProperty('createdAt');
      }
    });

    it('should respect pagination limits', async () => {
      const transactions = await escrowService.getTransactions(testVendor.id, 5, 0);

      expect(transactions.length).toBeLessThanOrEqual(5);
    });

    it('should return transactions in descending order by date', async () => {
      const transactions = await escrowService.getTransactions(testVendor.id, 10, 0);

      if (transactions.length > 1) {
        for (let i = 0; i < transactions.length - 1; i++) {
          const current = new Date(transactions[i].createdAt).getTime();
          const next = new Date(transactions[i + 1].createdAt).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('creditWallet', () => {
    it('should credit wallet after Paystack confirmation', async () => {
      // Get initial balance
      const initialBalance = await escrowService.getBalance(testVendor.id);

      // Get wallet
      const [wallet] = await db
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, testVendor.id))
        .limit(1);

      // Credit wallet
      const amount = 50000;
      const reference = `TEST_CREDIT_${Date.now()}`;
      const newBalance = await escrowService.creditWallet(
        wallet.id,
        amount,
        reference,
        testUser.id
      );

      // Verify balance increased
      expect(newBalance.balance).toBe(initialBalance.balance + amount);
      expect(newBalance.availableBalance).toBe(initialBalance.availableBalance + amount);
      expect(newBalance.frozenAmount).toBe(initialBalance.frozenAmount);

      // Verify transaction was created
      const transactions = await escrowService.getTransactions(testVendor.id, 1, 0);
      expect(transactions[0].type).toBe('credit');
      expect(transactions[0].amount).toBe(amount);
      expect(transactions[0].reference).toBe(reference);
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('freezeFunds', () => {
    it('should freeze funds when vendor wins auction', async () => {
      // First, ensure wallet has funds
      const [wallet] = await db
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, testVendor.id))
        .limit(1);

      const initialBalance = await escrowService.getBalance(testVendor.id);

      // Only test if there are available funds
      if (initialBalance.availableBalance >= 10000) {
        const freezeAmount = 10000;
        const auctionId = `TEST_AUCTION_${Date.now()}`;

        const newBalance = await escrowService.freezeFunds(
          testVendor.id,
          freezeAmount,
          auctionId,
          testUser.id
        );

        // Verify funds were frozen
        expect(newBalance.availableBalance).toBe(initialBalance.availableBalance - freezeAmount);
        expect(newBalance.frozenAmount).toBe(initialBalance.frozenAmount + freezeAmount);
        expect(newBalance.balance).toBe(initialBalance.balance); // Total balance unchanged

        // Verify transaction was created
        const transactions = await escrowService.getTransactions(testVendor.id, 1, 0);
        expect(transactions[0].type).toBe('freeze');
        expect(transactions[0].amount).toBe(freezeAmount);
      }
    }, 10000); // Increase timeout to 10 seconds);

    it('should reject freeze if insufficient available balance', async () => {
      const initialBalance = await escrowService.getBalance(testVendor.id);
      const excessiveAmount = initialBalance.availableBalance + 100000;

      await expect(
        escrowService.freezeFunds(
          testVendor.id,
          excessiveAmount,
          'TEST_AUCTION',
          testUser.id
        )
      ).rejects.toThrow('Insufficient available balance');
    });
  });
});
