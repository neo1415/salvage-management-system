import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { bids, payments, vendors, auctions, salvageCases, escrowWallets, walletTransactions } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * GET /api/vendor/settings/transactions
 * 
 * Fetch transaction history for vendor (wallet, bids, or payments)
 * 
 * Query Parameters:
 * - type: 'wallet' | 'bid' | 'bids' | 'payment' | 'payments'
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - status: optional status filter
 * - limit: number of records per page
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor ID
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get('type');
    
    // Normalize type parameter to handle both singular and plural forms
    let type: 'wallet' | 'bid' | 'payment';
    if (typeParam === 'payments' || typeParam === 'payment') {
      type = 'payment';
    } else if (typeParam === 'bids' || typeParam === 'bid') {
      type = 'bid';
    } else if (typeParam === 'wallet') {
      type = 'wallet';
    } else {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be "wallet", "bid"/"bids", or "payment"/"payments"' },
        { status: 400 }
      );
    }
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!typeParam || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, startDate, endDate' },
        { status: 400 }
      );
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999); // End of day

    if (type === 'wallet') {
      // Fetch wallet transaction history
      const [wallet] = await db
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendor.id))
        .limit(1);

      if (!wallet) {
        return NextResponse.json({
          transactions: [],
          totalCount: 0,
        });
      }

      const conditions = [
        eq(walletTransactions.walletId, wallet.id),
        gte(walletTransactions.createdAt, startDateTime),
        lte(walletTransactions.createdAt, endDateTime),
      ];

      const walletRecords = await db
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
        .where(and(...conditions))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(walletTransactions)
        .where(and(...conditions));

      // Transform to transaction format
      const transactions = walletRecords.map((record) => ({
        id: record.id,
        date: record.createdAt.toISOString(),
        description: record.description,
        amount: parseFloat(record.amount),
        type: record.type === 'credit' ? 'credit' : 'debit',
        status: 'completed',
        reference: record.reference,
        balanceAfter: parseFloat(record.balanceAfter),
      }));

      return NextResponse.json({
        transactions,
        totalCount: countResult?.count || 0,
      });
    } else if (type === 'bid') {
      // Fetch bid history
      const conditions = [
        eq(bids.vendorId, vendor.id),
        gte(bids.createdAt, startDateTime),
        lte(bids.createdAt, endDateTime),
      ];

      if (status) {
        conditions.push(eq(bids.status, status));
      }

      const bidRecords = await db
        .select({
          id: bids.id,
          amount: bids.amount,
          status: bids.status,
          createdAt: bids.createdAt,
          auctionId: bids.auctionId,
          auctionStatus: auctions.status,
          auctionCurrentBid: auctions.currentBid,
          auctionCurrentBidder: auctions.currentBidder,
          caseClaimReference: salvageCases.claimReference,
          caseAssetType: salvageCases.assetType,
          caseAssetDetails: salvageCases.assetDetails,
        })
        .from(bids)
        .leftJoin(auctions, eq(bids.auctionId, auctions.id))
        .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .where(and(...conditions))
        .orderBy(desc(bids.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bids)
        .where(and(...conditions));

      // Transform to transaction format
      const transactions = bidRecords.map((record) => {
        const assetDetails = record.caseAssetDetails;
        let description = 'Bid placed';
        
        // Check if case exists and has valid data (must check for null BEFORE typeof check)
        if (record.caseClaimReference) {
          if (record.caseAssetType === 'vehicle' && assetDetails !== null && typeof assetDetails === 'object') {
            const year = (assetDetails as any)?.year || '';
            const make = (assetDetails as any)?.make || '';
            const model = (assetDetails as any)?.model || '';
            const vehicleDesc = `${year} ${make} ${model}`.trim();
            description = vehicleDesc ? `Bid on ${vehicleDesc}` : `Bid on ${record.caseClaimReference}`;
          } else {
            description = `Bid on ${record.caseClaimReference}`;
          }
        }

        // Determine bid status
        let bidStatus = record.status || 'active';
        if (record.auctionStatus) {
          if (record.auctionStatus === 'closed') {
            if (record.auctionCurrentBidder === vendor.id) {
              bidStatus = 'won';
            } else {
              bidStatus = 'lost';
            }
          } else if (record.auctionCurrentBid && parseFloat(record.auctionCurrentBid) > parseFloat(record.amount)) {
            bidStatus = 'outbid';
          }
        }

        return {
          id: record.id,
          date: record.createdAt.toISOString(),
          description,
          amount: parseFloat(record.amount),
          type: 'debit' as const,
          status: bidStatus,
          reference: record.caseClaimReference || undefined,
        };
      });

      return NextResponse.json({
        transactions,
        totalCount: countResult?.count || 0,
      });
    } else if (type === 'payment') {
      // Fetch payment history
      const conditions = [
        eq(payments.vendorId, vendor.id),
        gte(payments.createdAt, startDateTime),
        lte(payments.createdAt, endDateTime),
      ];

      if (status) {
        conditions.push(eq(payments.status, status));
      }

      const paymentRecords = await db
        .select({
          id: payments.id,
          amount: payments.amount,
          status: payments.status,
          paymentMethod: payments.paymentMethod,
          paymentReference: payments.paymentReference,
          createdAt: payments.createdAt,
          paymentDeadline: payments.paymentDeadline,
          auctionId: payments.auctionId,
          caseClaimReference: salvageCases.claimReference,
          caseAssetType: salvageCases.assetType,
          caseAssetDetails: salvageCases.assetDetails,
        })
        .from(payments)
        .leftJoin(auctions, eq(payments.auctionId, auctions.id))
        .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .where(and(...conditions))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(...conditions));

      // Transform to transaction format
      const transactions = paymentRecords.map((record) => {
        const assetDetails = record.caseAssetDetails;
        let description = 'Payment';
        
        // Check if this is a registration fee (no auction ID)
        if (!record.auctionId) {
          description = 'Vendor Registration Fee';
        }
        // Check if case exists and has valid data (must check for null BEFORE typeof check)
        else if (record.caseClaimReference) {
          if (record.caseAssetType === 'vehicle' && assetDetails !== null && typeof assetDetails === 'object') {
            const year = (assetDetails as any)?.year || '';
            const make = (assetDetails as any)?.make || '';
            const model = (assetDetails as any)?.model || '';
            const vehicleDesc = `${year} ${make} ${model}`.trim();
            description = vehicleDesc ? `Payment for ${vehicleDesc}` : `Payment for ${record.caseClaimReference}`;
          } else {
            description = `Payment for ${record.caseClaimReference}`;
          }
        }

        // Check if payment is overdue
        let paymentStatus = record.status || 'pending';
        if (paymentStatus === 'pending' && record.paymentDeadline) {
          const now = new Date();
          if (now > record.paymentDeadline) {
            paymentStatus = 'overdue';
          }
        }

        return {
          id: record.id,
          date: record.createdAt.toISOString(),
          description,
          amount: parseFloat(record.amount),
          type: 'debit' as const,
          status: paymentStatus,
          reference: record.paymentReference || record.caseClaimReference || undefined,
        };
      });

      return NextResponse.json({
        transactions,
        totalCount: countResult?.count || 0,
      });
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
