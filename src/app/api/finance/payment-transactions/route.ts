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
import { auctions, auctionWinners, vendors, escrowWallets, depositForfeitures, releaseForms, salvageCases } from '@/lib/db/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';

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
    const authorizedRoles = ['finance_officer', 'salvage_manager', 'system_admin'];
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
        statusFilter = eq(auctions.status, 'closed');
        break;
      case 'awaiting_payment':
        statusFilter = eq(auctions.status, 'awaiting_payment');
        break;
      case 'deposit_forfeited':
        statusFilter = eq(auctions.status, 'forfeited');
        break;
      case 'failed_all_fallbacks':
        statusFilter = eq(auctions.status, 'cancelled');
        break;
      case 'paid':
        statusFilter = eq(auctions.status, 'closed');
        break;
      case 'all':
      default:
        statusFilter = inArray(auctions.status, [
          'closed',
          'awaiting_payment',
          'forfeited',
          'cancelled',
        ] as const);
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
    const auctionIds = auctionsWithWinners.map(a => a.auction.id);
    const caseIds = [...new Set(auctionsWithWinners.map(a => a.auction.caseId))];

    // Batch fetch vendors
    const vendorsMap = new Map();
    if (vendorIds.length > 0) {
      const vendorsList = await db
        .select()
        .from(vendors)
        .where(inArray(vendors.id, vendorIds));
      
      vendorsList.forEach(v => vendorsMap.set(v.id, v));
    }

    const casesMap = new Map();
    if (caseIds.length > 0) {
      const casesList = await db
        .select()
        .from(salvageCases)
        .where(inArray(salvageCases.id, caseIds));

      casesList.forEach(c => casesMap.set(c.id, c));
    }

    const documentsMap = new Map();
    if (auctionIds.length > 0) {
      const documentsList = await db
        .select()
        .from(releaseForms)
        .where(inArray(releaseForms.auctionId, auctionIds))
        .orderBy(desc(releaseForms.createdAt));

      for (const document of documentsList) {
        const key = `${document.auctionId}:${document.vendorId}`;
        const current = documentsMap.get(key) as { signedAt: Date | null; paymentDeadline: Date | null; extensionCount: number } | undefined;
        documentsMap.set(key, {
          signedAt: current?.signedAt || document.signedAt,
          paymentDeadline: current?.paymentDeadline || document.paymentDeadline,
          extensionCount: Math.max(current?.extensionCount ?? 0, document.extensionCount ?? 0),
        });
      }
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
      .filter(a => a.auction.status === 'forfeited')
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
      const caseRecord = casesMap.get(auction.caseId);
      const assetDetails = caseRecord?.assetDetails;
      const assetName = [
        assetDetails?.year,
        assetDetails?.make || assetDetails?.brand || assetDetails?.propertyType,
        assetDetails?.model,
      ].filter(Boolean).join(' ') || caseRecord?.assetType || `Auction ${auction.id.slice(0, 8)}`;
      const documentStatus = documentsMap.get(`${auction.id}:${winner.vendorId}`) as
        | { signedAt: Date | null; paymentDeadline: Date | null; extensionCount: number }
        | undefined;

      return {
        auction: {
          id: auction.id,
          assetName,
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
          status: winner.status,
          documentsSignedAt: documentStatus?.signedAt ?? null,
          paymentDeadline: documentStatus?.paymentDeadline ?? null,
          extensionCount: documentStatus?.extensionCount ?? 0,
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
          transferred: Boolean(forfeiture.transferredAt),
          transferredAt: forfeiture.transferredAt,
        } : null,
        actions: {
          canGrantExtension: auction.status === 'closed' &&
                             !documentStatus?.signedAt &&
                             (documentStatus?.extensionCount ?? 0) < 2,
          canTransferForfeiture: auction.status === 'forfeited' && 
                                 forfeiture && !forfeiture.transferredAt,
          requiresManualIntervention: auction.status === 'cancelled',
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
        awaitingDocuments: transactions.filter(t => t.auction.status === 'closed').length,
        awaitingPayment: transactions.filter(t => t.auction.status === 'awaiting_payment').length,
        depositForfeited: transactions.filter(t => t.auction.status === 'forfeited').length,
        failedAllFallbacks: transactions.filter(t => t.auction.status === 'cancelled').length,
        paid: transactions.filter(t => t.winner.status === 'completed').length,
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
