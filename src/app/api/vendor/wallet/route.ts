/**
 * Vendor Wallet API Route
 * GET /api/vendor/wallet
 * 
 * Returns wallet balance and transaction history for the authenticated vendor
 * Includes deposit system information (availableBalance, frozenAmount, forfeitedAmount)
 * 
 * Requirements:
 * - Requirement 23.1: Display balance breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors, escrowWallets } from '@/lib/db/schema';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a vendor
    if (session.user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Access denied. Vendor role required.' },
        { status: 403 }
      );
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Get escrow wallet for deposit information
    const escrowWallet = await db.query.escrowWallets.findFirst({
      where: eq(escrowWallets.vendorId, vendor.id),
    });

    if (!escrowWallet) {
      return NextResponse.json({
        balance: 0,
        availableBalance: 0,
        frozenAmount: 0,
        forfeitedAmount: 0,
        transactions: [],
      });
    }

    // Get wallet transactions (last 50)
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, escrowWallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    // Calculate wallet balance breakdown
    const balance = parseFloat(escrowWallet.balance || '0');
    const availableBalance = parseFloat(escrowWallet.availableBalance || '0');
    const frozenAmount = parseFloat(escrowWallet.frozenAmount || '0');
    const forfeitedAmount = parseFloat(escrowWallet.forfeitedAmount || '0');

    return NextResponse.json({
      balance,
      availableBalance,
      frozenAmount,
      forfeitedAmount,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: 'completed',
        description: tx.description,
        reference: tx.reference,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching vendor wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
}
