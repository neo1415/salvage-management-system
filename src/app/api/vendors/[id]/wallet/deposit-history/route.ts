/**
 * Vendor Wallet Deposit History API Route
 * Returns deposit events history with pagination
 * 
 * Requirements:
 * - Requirement 23: Vendor Deposit History and Transparency
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { depositEvents, vendors, auctions, salvageCases } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/vendors/[id]/wallet/deposit-history
 * Get deposit events history for a vendor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+)
    const { id: vendorId } = await params;

    // Get session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify vendor ownership or authorized role
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, vendorId),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // IDOR Protection: Verify user owns this vendor or is authorized
    const isOwner = vendor.userId === session.user.id;
    const isAuthorized = ['admin', 'manager', 'finance_officer'].includes(session.user.role || '');

    if (!isOwner && !isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // CRITICAL FIX: Get BOTH deposit events AND wallet transactions (escrow wallet)
    // Deposit events: freeze/unfreeze from auction deposit system
    // Wallet transactions: credit/debit/freeze/unfreeze from escrow wallet system
    
    // Get deposit events with auction details
    const depositEventsData = await db
      .select({
        id: depositEvents.id,
        eventType: depositEvents.eventType,
        amount: depositEvents.amount,
        balanceBefore: depositEvents.balanceBefore,
        balanceAfter: depositEvents.balanceAfter,
        frozenBefore: depositEvents.frozenBefore,
        frozenAfter: depositEvents.frozenAfter,
        createdAt: depositEvents.createdAt,
        auctionId: depositEvents.auctionId,
        auction: {
          id: auctions.id,
          assetName: salvageCases.assetType,
          status: auctions.status,
        },
      })
      .from(depositEvents)
      .leftJoin(auctions, eq(depositEvents.auctionId, auctions.id))
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(depositEvents.vendorId, vendorId))
      .orderBy(desc(depositEvents.createdAt));

    // Get wallet transactions (escrow wallet) - includes debit/unfreeze events
    const { escrowWallets, walletTransactions } = await import('@/lib/db/schema/escrow');
    
    // First get the vendor's escrow wallet
    const [escrowWallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendorId))
      .limit(1);

    let walletTransactionsData: any[] = [];
    if (escrowWallet) {
      walletTransactionsData = await db
        .select({
          id: walletTransactions.id,
          type: walletTransactions.type,
          amount: walletTransactions.amount,
          balanceAfter: walletTransactions.balanceAfter,
          reference: walletTransactions.reference,
          description: walletTransactions.description,
          createdAt: walletTransactions.createdAt,
        })
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, escrowWallet.id))
        .orderBy(desc(walletTransactions.createdAt));
    }

    // Merge and sort all events by createdAt
    const allEvents = [
      ...depositEventsData.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        amount: parseFloat(event.amount),
        balanceBefore: event.balanceBefore ? parseFloat(event.balanceBefore) : null,
        balanceAfter: parseFloat(event.balanceAfter),
        frozenBefore: event.frozenBefore ? parseFloat(event.frozenBefore) : null,
        frozenAfter: parseFloat(event.frozenAfter),
        createdAt: event.createdAt,
        auction: event.auction ? {
          id: event.auction.id,
          assetName: event.auction.assetName,
          status: event.auction.status,
        } : null,
        reference: null,
        description: null,
        source: 'deposit_events' as const,
      })),
      ...walletTransactionsData.map((tx) => ({
        id: tx.id,
        eventType: tx.type,
        amount: parseFloat(tx.amount),
        balanceBefore: null,
        balanceAfter: parseFloat(tx.balanceAfter),
        frozenBefore: null,
        frozenAfter: null,
        createdAt: tx.createdAt,
        auction: null,
        reference: tx.reference,
        description: tx.description,
        source: 'wallet_transactions' as const,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination to merged results
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    const totalCount = allEvents.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Format events for response
    const formattedEvents = paginatedEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      amount: event.amount,
      balanceBefore: event.balanceBefore ?? null,
      balanceAfter: event.balanceAfter,
      frozenBefore: event.frozenBefore ?? null,
      frozenAfter: event.frozenAfter,
      createdAt: event.createdAt,
      auction: event.auction,
      reference: event.reference,
      description: event.description,
      source: event.source,
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Get deposit history error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve deposit history. Please try again.'
      },
      { status: 500 }
    );
  }
}
