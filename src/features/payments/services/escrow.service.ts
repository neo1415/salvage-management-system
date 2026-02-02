import { db } from '@/lib/db/drizzle';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const WALLET_CACHE_TTL = 300; // 5 minutes in seconds

export interface WalletBalance {
  balance: number;
  availableBalance: number;
  frozenAmount: number;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'freeze' | 'unfreeze';
  amount: number;
  balanceAfter: number;
  reference: string;
  description: string;
  createdAt: Date;
}

export interface FundWalletResult {
  walletId: string;
  transactionId: string;
  amount: number;
  newBalance: number;
  paymentUrl: string;
  reference: string;
}

/**
 * Get or create escrow wallet for a vendor
 */
async function getOrCreateWallet(vendorId: string): Promise<typeof escrowWallets.$inferSelect> {
  // Check if wallet exists
  const existingWallet = await db.query.escrowWallets.findFirst({
    where: eq(escrowWallets.vendorId, vendorId),
  });

  if (existingWallet) {
    return existingWallet;
  }

  // Create new wallet
  const [newWallet] = await db
    .insert(escrowWallets)
    .values({
      vendorId,
      balance: '0.00',
      availableBalance: '0.00',
      frozenAmount: '0.00',
    })
    .returning();

  return newWallet;
}

/**
 * Fund wallet via Paystack integration
 * Accepts amounts between ₦50k - ₦5M
 */
export async function fundWallet(
  vendorId: string,
  amount: number,
  userId: string
): Promise<FundWalletResult> {
  try {
    // Validate amount range (₦50k - ₦5M)
    if (amount < 50000 || amount > 5000000) {
      throw new Error('Amount must be between ₦50,000 and ₦5,000,000');
    }

    // Get or create wallet
    const wallet = await getOrCreateWallet(vendorId);

    // Get vendor and user details
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const [user] = await db.select().from(users).where(eq(users.id, vendor.userId)).limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate unique reference
    const reference = `WALLET_${wallet.id.substring(0, 8)}_${Date.now()}`;

    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(amount * 100);

    // Initialize Paystack transaction
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountInKobo,
        reference,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/wallet?status=success`,
        metadata: {
          walletId: wallet.id,
          vendorId,
          type: 'wallet_funding',
          custom_fields: [
            {
              display_name: 'Wallet ID',
              variable_name: 'wallet_id',
              value: wallet.id,
            },
            {
              display_name: 'Vendor ID',
              variable_name: 'vendor_id',
              value: vendorId,
            },
          ],
        },
      }),
    });

    if (!paystackResponse.ok) {
      const error = await paystackResponse.json();
      throw new Error(`Paystack initialization failed: ${error.message || 'Unknown error'}`);
    }

    const paystackData = await paystackResponse.json();

    // Create pending transaction record
    const [transaction] = await db
      .insert(walletTransactions)
      .values({
        walletId: wallet.id,
        type: 'credit',
        amount: amount.toString(),
        balanceAfter: wallet.balance,
        reference,
        description: `Wallet funding via Paystack - Pending confirmation`,
      })
      .returning();

    // Log wallet funding initiation
    await logAction({
      userId,
      actionType: AuditActionType.WALLET_FUNDED,
      entityType: AuditEntityType.WALLET,
      entityId: wallet.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      afterState: {
        walletId: wallet.id,
        amount,
        reference,
        status: 'pending',
      },
    });

    return {
      walletId: wallet.id,
      transactionId: transaction.id,
      amount,
      newBalance: parseFloat(wallet.balance),
      paymentUrl: paystackData.data.authorization_url,
      reference,
    };
  } catch (error) {
    console.error('Error funding wallet:', error);
    throw error;
  }
}

/**
 * Credit wallet after Paystack confirmation
 * Called by webhook handler
 */
export async function creditWallet(
  walletId: string,
  amount: number,
  reference: string,
  userId: string
): Promise<WalletBalance> {
  try {
    // Get wallet
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Calculate new balances
    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);
    const newBalance = currentBalance + amount;
    const newAvailable = currentAvailable + amount;

    // Update wallet
    const [updatedWallet] = await db
      .update(escrowWallets)
      .set({
        balance: newBalance.toFixed(2),
        availableBalance: newAvailable.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, walletId))
      .returning();

    // Create transaction record
    await db.insert(walletTransactions).values({
      walletId,
      type: 'credit',
      amount: amount.toString(),
      balanceAfter: newBalance.toFixed(2),
      reference,
      description: `Wallet funded ₦${amount.toLocaleString()} via Paystack`,
    });

    // Invalidate cache
    await kv.del(`wallet:${walletId}`);

    // Log wallet funding
    await logAction({
      userId,
      actionType: AuditActionType.WALLET_FUNDED,
      entityType: AuditEntityType.WALLET,
      entityId: walletId,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      beforeState: {
        balance: currentBalance,
        availableBalance: currentAvailable,
      },
      afterState: {
        balance: newBalance,
        availableBalance: newAvailable,
        amount,
        reference,
      },
    });

    return {
      balance: parseFloat(updatedWallet.balance),
      availableBalance: parseFloat(updatedWallet.availableBalance),
      frozenAmount: parseFloat(updatedWallet.frozenAmount),
    };
  } catch (error) {
    console.error('Error crediting wallet:', error);
    throw error;
  }
}

/**
 * Freeze funds when vendor wins auction
 * Moves funds from available to frozen
 */
export async function freezeFunds(
  vendorId: string,
  amount: number,
  auctionId: string,
  userId: string
): Promise<WalletBalance> {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(vendorId);

    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);
    const currentFrozen = parseFloat(wallet.frozenAmount);

    // Check if sufficient available balance
    if (currentAvailable < amount) {
      throw new Error(
        `Insufficient available balance. Available: ₦${currentAvailable.toLocaleString()}, Required: ₦${amount.toLocaleString()}`
      );
    }

    // Calculate new balances
    const newAvailable = currentAvailable - amount;
    const newFrozen = currentFrozen + amount;

    // Verify invariant: balance = availableBalance + frozenAmount
    if (Math.abs(currentBalance - (newAvailable + newFrozen)) > 0.01) {
      throw new Error('Balance invariant violation detected');
    }

    // Update wallet
    const [updatedWallet] = await db
      .update(escrowWallets)
      .set({
        availableBalance: newAvailable.toFixed(2),
        frozenAmount: newFrozen.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, wallet.id))
      .returning();

    // Create transaction record
    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'freeze',
      amount: amount.toString(),
      balanceAfter: currentBalance.toFixed(2),
      reference: `FREEZE_${auctionId}`,
      description: `Funds frozen for auction ${auctionId.substring(0, 8)}`,
    });

    // Invalidate cache
    await kv.del(`wallet:${wallet.id}`);

    // Log funds frozen
    await logAction({
      userId,
      actionType: AuditActionType.FUNDS_FROZEN,
      entityType: AuditEntityType.WALLET,
      entityId: wallet.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      beforeState: {
        availableBalance: currentAvailable,
        frozenAmount: currentFrozen,
      },
      afterState: {
        availableBalance: newAvailable,
        frozenAmount: newFrozen,
        auctionId,
        amount,
      },
    });

    return {
      balance: parseFloat(updatedWallet.balance),
      availableBalance: parseFloat(updatedWallet.availableBalance),
      frozenAmount: parseFloat(updatedWallet.frozenAmount),
    };
  } catch (error) {
    console.error('Error freezing funds:', error);
    throw error;
  }
}

/**
 * Release funds after pickup confirmation
 * Debits frozen amount and transfers to NEM Insurance via Paystack Transfers API
 */
export async function releaseFunds(
  vendorId: string,
  amount: number,
  auctionId: string,
  userId: string
): Promise<WalletBalance> {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(vendorId);

    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);
    const currentFrozen = parseFloat(wallet.frozenAmount);

    // Check if sufficient frozen balance
    if (currentFrozen < amount) {
      throw new Error(
        `Insufficient frozen balance. Frozen: ₦${currentFrozen.toLocaleString()}, Required: ₦${amount.toLocaleString()}`
      );
    }

    // Calculate new balances
    const newBalance = currentBalance - amount;
    const newFrozen = currentFrozen - amount;

    // Verify invariant: balance = availableBalance + frozenAmount
    if (Math.abs(newBalance - (currentAvailable + newFrozen)) > 0.01) {
      throw new Error('Balance invariant violation detected');
    }

    // Generate transfer reference
    const transferReference = `TRANSFER_${auctionId.substring(0, 8)}_${Date.now()}`;

    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(amount * 100);

    // Get NEM Insurance transfer recipient code from environment
    const nemRecipientCode = process.env.PAYSTACK_NEM_RECIPIENT_CODE;

    if (!nemRecipientCode) {
      console.warn('PAYSTACK_NEM_RECIPIENT_CODE not configured. Skipping actual transfer in development mode.');
    } else {
      // Initiate transfer to NEM Insurance via Paystack Transfers API
      const transferResponse = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: amountInKobo,
          recipient: nemRecipientCode,
          reason: `Auction payment for auction ${auctionId.substring(0, 8)}`,
          reference: transferReference,
        }),
      });

      if (!transferResponse.ok) {
        const error = await transferResponse.json();
        throw new Error(`Paystack transfer failed: ${error.message || 'Unknown error'}`);
      }

      const transferData = await transferResponse.json();
      console.log('Paystack transfer initiated:', transferData);
    }

    // Update wallet
    const [updatedWallet] = await db
      .update(escrowWallets)
      .set({
        balance: newBalance.toFixed(2),
        frozenAmount: newFrozen.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, wallet.id))
      .returning();

    // Create transaction record
    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'debit',
      amount: amount.toString(),
      balanceAfter: newBalance.toFixed(2),
      reference: transferReference,
      description: `Funds released for auction ${auctionId.substring(0, 8)} - Transferred to NEM Insurance via Paystack`,
    });

    // Invalidate cache
    await kv.del(`wallet:${wallet.id}`);

    // Log funds released
    await logAction({
      userId,
      actionType: AuditActionType.FUNDS_RELEASED,
      entityType: AuditEntityType.WALLET,
      entityId: wallet.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      beforeState: {
        balance: currentBalance,
        frozenAmount: currentFrozen,
      },
      afterState: {
        balance: newBalance,
        frozenAmount: newFrozen,
        auctionId,
        amount,
        transferReference,
      },
    });

    return {
      balance: parseFloat(updatedWallet.balance),
      availableBalance: parseFloat(updatedWallet.availableBalance),
      frozenAmount: parseFloat(updatedWallet.frozenAmount),
    };
  } catch (error) {
    console.error('Error releasing funds:', error);
    throw error;
  }
}

/**
 * Unfreeze funds (e.g., if auction is cancelled)
 * Moves funds from frozen back to available
 */
export async function unfreezeFunds(
  vendorId: string,
  amount: number,
  auctionId: string,
  userId: string
): Promise<WalletBalance> {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(vendorId);

    const currentBalance = parseFloat(wallet.balance);
    const currentAvailable = parseFloat(wallet.availableBalance);
    const currentFrozen = parseFloat(wallet.frozenAmount);

    // Check if sufficient frozen balance
    if (currentFrozen < amount) {
      throw new Error(
        `Insufficient frozen balance. Frozen: ₦${currentFrozen.toLocaleString()}, Required: ₦${amount.toLocaleString()}`
      );
    }

    // Calculate new balances
    const newAvailable = currentAvailable + amount;
    const newFrozen = currentFrozen - amount;

    // Verify invariant: balance = availableBalance + frozenAmount
    if (Math.abs(currentBalance - (newAvailable + newFrozen)) > 0.01) {
      throw new Error('Balance invariant violation detected');
    }

    // Update wallet
    const [updatedWallet] = await db
      .update(escrowWallets)
      .set({
        availableBalance: newAvailable.toFixed(2),
        frozenAmount: newFrozen.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, wallet.id))
      .returning();

    // Create transaction record
    await db.insert(walletTransactions).values({
      walletId: wallet.id,
      type: 'unfreeze',
      amount: amount.toString(),
      balanceAfter: currentBalance.toFixed(2),
      reference: `UNFREEZE_${auctionId}`,
      description: `Funds unfrozen for auction ${auctionId.substring(0, 8)}`,
    });

    // Invalidate cache
    await kv.del(`wallet:${wallet.id}`);

    // Log funds unfrozen
    await logAction({
      userId,
      actionType: AuditActionType.FUNDS_UNFROZEN,
      entityType: AuditEntityType.WALLET,
      entityId: wallet.id,
      ipAddress: '0.0.0.0',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'system',
      beforeState: {
        availableBalance: currentAvailable,
        frozenAmount: currentFrozen,
      },
      afterState: {
        availableBalance: newAvailable,
        frozenAmount: newFrozen,
        auctionId,
        amount,
      },
    });

    return {
      balance: parseFloat(updatedWallet.balance),
      availableBalance: parseFloat(updatedWallet.availableBalance),
      frozenAmount: parseFloat(updatedWallet.frozenAmount),
    };
  } catch (error) {
    console.error('Error unfreezing funds:', error);
    throw error;
  }
}

/**
 * Get wallet balance with Redis caching
 * Cache TTL: 5 minutes
 */
export async function getBalance(vendorId: string): Promise<WalletBalance> {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(vendorId);

    // Try to get from cache
    const cacheKey = `wallet:${wallet.id}`;
    const cached = await kv.get<WalletBalance>(cacheKey);

    if (cached) {
      return cached;
    }

    // Get from database
    const balance: WalletBalance = {
      balance: parseFloat(wallet.balance),
      availableBalance: parseFloat(wallet.availableBalance),
      frozenAmount: parseFloat(wallet.frozenAmount),
    };

    // Cache for 5 minutes
    await kv.set(cacheKey, balance, { ex: WALLET_CACHE_TTL });

    return balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

/**
 * Get wallet transactions with pagination
 */
export async function getTransactions(
  vendorId: string,
  limit: number = 50,
  offset: number = 0
): Promise<WalletTransaction[]> {
  try {
    // Get wallet
    const wallet = await getOrCreateWallet(vendorId);

    // Get transactions
    const transactions = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.walletId, wallet.id),
      orderBy: (walletTransactions, { desc }) => [desc(walletTransactions.createdAt)],
      limit,
      offset,
    });

    return transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      balanceAfter: parseFloat(t.balanceAfter),
      reference: t.reference,
      description: t.description,
      createdAt: t.createdAt,
    }));
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
}

export const escrowService = {
  fundWallet,
  creditWallet,
  freezeFunds,
  releaseFunds,
  unfreezeFunds,
  getBalance,
  getTransactions,
};
