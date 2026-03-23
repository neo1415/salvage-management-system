import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { bids, payments, vendors, auctions, salvageCases } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * GET /api/vendor/settings/transactions
 * 
 * Fetch transaction history for vendor (bids or payments)
 * 
 * Query Parameters:
 * - type: 'bids' | 'payments'
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
    const type = searchParams.get('type') as 'bids' | 'payments';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, startDate, endDate' },
        { status: 400 }
      );
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999); // End of day

    if (type === 'bids') {
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
          auction: {
            id: auctions.id,
            status: auctions.status,
            currentBid: auctions.currentBid,
            currentBidder: auctions.currentBidder,
          },
          case: {
            claimReference: salvageCases.claimReference,
            assetType: salvageCases.assetType,
            assetDetails: salvageCases.assetDetails,
          },
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
        const assetDetails = record.case?.assetDetails as any;
        let description = 'Bid placed';
        
        if (record.case) {
          if (record.case.assetType === 'vehicle' && assetDetails && typeof assetDetails === 'object' && assetDetails !== null) {
            const year = assetDetails.year || '';
            const make = assetDetails.make || '';
            const model = assetDetails.model || '';
            description = `Bid on ${year} ${make} ${model}`.trim() || `Bid on ${record.case.claimReference}`;
          } else {
            description = `Bid on ${record.case.claimReference}`;
          }
        }

        // Determine bid status
        let bidStatus = record.status || 'active';
        if (record.auction) {
          if (record.auction.status === 'closed') {
            if (record.auction.currentBidder === vendor.id) {
              bidStatus = 'won';
            } else {
              bidStatus = 'lost';
            }
          } else if (record.auction.currentBid && parseFloat(record.auction.currentBid) > parseFloat(record.amount)) {
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
          reference: record.case?.claimReference,
        };
      });

      return NextResponse.json({
        transactions,
        totalCount: countResult?.count || 0,
      });
    } else if (type === 'payments') {
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
          auction: {
            id: auctions.id,
          },
          case: {
            claimReference: salvageCases.claimReference,
            assetType: salvageCases.assetType,
            assetDetails: salvageCases.assetDetails,
          },
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
        const assetDetails = record.case?.assetDetails as any;
        let description = 'Payment';
        
        if (record.case) {
          if (record.case.assetType === 'vehicle' && assetDetails && typeof assetDetails === 'object' && assetDetails !== null) {
            const year = assetDetails.year || '';
            const make = assetDetails.make || '';
            const model = assetDetails.model || '';
            description = `Payment for ${year} ${make} ${model}`.trim() || `Payment for ${record.case.claimReference}`;
          } else {
            description = `Payment for ${record.case.claimReference}`;
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
          reference: record.paymentReference || record.case?.claimReference,
        };
      });

      return NextResponse.json({
        transactions,
        totalCount: countResult?.count || 0,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be "bids" or "payments"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
