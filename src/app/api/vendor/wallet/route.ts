/**
 * Vendor Wallet API Route
 * GET /api/vendor/wallet
 * 
 * Returns wallet balance and transaction history for the authenticated vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
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

    // Calculate wallet balance
    const balance = parseFloat(vendor.walletBalance || '0');

    return NextResponse.json({
      balance,
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
