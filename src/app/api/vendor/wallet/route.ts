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

    // Get wallet transactions (last 50)
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.vendorId, vendor.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    // Get escrow wallet for deposit information
    const escrowWallet = await db.query.escrowWallets.findFirst({
      where: eq(escrowWallets.vendorId, vendor.id),
    });

    // Calculate wallet balance breakdown
    const balance = parseFloat(vendor.walletBalance || '0');
    const availableBalance = escrowWallet ? parseFloat(escrowWallet.availableBalance) : balance;
    const frozenAmount = escrowWallet ? parseFloat(escrowWallet.frozenAmount) : 0;
    const forfeitedAmount = escrowWallet ? parseFloat(escrowWallet.forfeitedAmount || '0') : 0;

    return NextResponse.json({
      balance,
      availableBalance,
      frozenAmount,
      forfeitedAmount,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        status: tx.status,
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
