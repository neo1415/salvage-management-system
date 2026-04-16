/**
 * Payment Transactions List API Route
 * Finance Officer dashboard for managing auction payments
 * 
 * Requirements:
 * - Requirement 17: Finance Officer Payment Details Interface
 * 
 * SECURITY: Role-based access control (Finance Officer only)
 * PERFORMANCE: Batch-optimized queries, pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, auctionWinners, vendors, escrowWallets, depositForfeitures } from '@/lib/db/schema';
import { eq, inArray, desc, and, or } from 'drizzle-orm';

/**
 * GET /api/finance/payment-transactions
 * Get payment transactions grouped by status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // RBAC: Verify user is Finance Officer
    const authorizedRoles = ['finance_officer', 'manager', 'admin'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - Finance Officer role required' 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build status filter
    let statusFilter;
    switch (status) {
      case 'awaiting_documents':
        statusFilter = eq(auctions.status, 'awaiting_documents');
        break;
      case 'awaiting_payment':
        statusFilter = eq(auctions.status, 'awaiting_payment');
        break;
      case 'deposit_forfeited':
        statusFilter = eq(auctions.status, 'deposit_forfeited');
        break;
      case 'failed_all_fallbacks':
        statusFilter = eq(auctions.status, 'failed_all_fallbacks');
        break;
      case 'paid':
        statusFilter = eq(auctions.status, 'paid');
        break;
      case 'all':
      default:
        statusFilter = inArray(auctions.status, [
          'awaiting_documents',
          'awaiting_payment',
          'deposit_forfeited',
          'failed_all_fallbacks',
          'paid',
        ]);
    }

    // Get auctions with winners
    const auctionsWithWinners = await db
      .select({
        auction: auctions,
        winner: auctionWinners,
      })
      .from(auctions)
      .innerJoin(
        auctionWinners,
        and(
          eq(auctionWinners.auctionId, auctions.id),
          eq(auctionWinners.status, 'active')
        )
      )
      .where(statusFilter)
      .orderBy(desc(auctions.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get vendor IDs for batch query
    const vendorIds = [...new Set(auctionsWithWinners.map(a => a.winner.vendorId))];

    // Batch fetch vendors
    const vendorsMap = new Map();
    if (vendorIds.length > 0) {
      const vendorsList = await db
        .select()
        .from(vendors)
        .where(inArray(vendors.id, vendorIds));
      
      vendorsList.forEach(v => vendorsMap.set(v.id, v));
    }

    // Batch fetch escrow wallets
    const walletsMap = new Map();
    if (vendorIds.length > 0) {
      const walletsList = await db
        .select()
        .from(escrowWallets)
        .where(inArray(escrowWallets.vendorId, vendorIds));
      
      walletsList.forEach(w => walletsMap.set(w.vendorId, w));
    }

    // Batch fetch forfeitures for forfeited auctions
    const forfeitedAuctionIds = auctionsWithWinners
      .filter(a => a.auction.status === 'deposit_forfeited')
      .map(a => a.auction.id);
    
    const forfeituresMap = new Map();
    if (forfeitedAuctionIds.length > 0) {
      const forfeituresList = await db
        .select()
        .from(depositForfeitures)
        .where(inArray(depositForfeitures.auctionId, forfeitedAuctionIds));
      
      forfeituresList.forEach(f => forfeituresMap.set(f.auctionId, f));
    }

    // Format response
    const transactions = auctionsWithWinners.map(({ auction, winner }) => {
      const vendor = vendorsMap.get(winner.vendorId);
      const wallet = walletsMap.get(winner.vendorId);
      const forfeiture = forfeituresMap.get(auction.id);

      return {
        auction: {
          id: auction.id,
          assetName: auction.assetName,
          status: auction.status,
          currentBid: parseFloat(auction.currentBid || '0'),
          createdAt: auction.createdAt,
          updatedAt: auction.updatedAt,
        },
        winner: {
          id: winner.id,
          vendorId: winner.vendorId,
          vendorName: vendor?.businessName || 'Unknown',
          bidAmount: parseFloat(winner.bidAmount),
          depositAmount: parseFloat(winner.depositAmount),
          rank: winner.rank,
          documentsSignedAt: winner.documentsSignedAt,
          paymentDeadline: winner.paymentDeadline,
          extensionCount: winner.extensionCount,
        },
        wallet: wallet ? {
          balance: parseFloat(wallet.balance),
          availableBalance: parseFloat(wallet.availableBalance),
          frozenAmount: parseFloat(wallet.frozenAmount),
          forfeitedAmount: parseFloat(wallet.forfeitedAmount || '0'),
        } : null,
        forfeiture: forfeiture ? {
          id: forfeiture.id,
          forfeitedAmount: parseFloat(forfeiture.forfeitedAmount),
          transferred: forfeiture.transferred,
          transferredAt: forfeiture.transferredAt,
        } : null,
        actions: {
          canGrantExtension: auction.status === 'awaiting_documents' && 
                             (winner.extensionCount || 0) < 2,
          canTransferForfeiture: auction.status === 'deposit_forfeited' && 
                                 forfeiture && !forfeiture.transferred,
          requiresManualIntervention: auction.status === 'failed_all_fallbacks',
        },
      };
    });

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: auctions.id })
      .from(auctions)
      .innerJoin(
        auctionWinners,
        and(
          eq(auctionWinners.auctionId, auctions.id),
          eq(auctionWinners.status, 'active')
        )
      )
      .where(statusFilter);

    const totalCount = typeof count === 'number' ? count : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
      summary: {
        awaitingDocuments: transactions.filter(t => t.auction.status === 'awaiting_documents').length,
        awaitingPayment: transactions.filter(t => t.auction.status === 'awaiting_payment').length,
        depositForfeited: transactions.filter(t => t.auction.status === 'deposit_forfeited').length,
        failedAllFallbacks: transactions.filter(t => t.auction.status === 'failed_all_fallbacks').length,
        paid: transactions.filter(t => t.auction.status === 'paid').length,
      },
    });
  } catch (error) {
    console.error('Get payment transactions error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve payment transactions. Please try again.'
      },
      { status: 500 }
    );
  }
}
