import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets, bids, auctions, vendors } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * GET /api/vendor/settings/transactions/export
 * Export transactions to CSV
 * 
 * Query params:
 * - type: 'wallet' | 'bids' | 'payments'
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - status: optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor ID
    const [vendor] = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'wallet' | 'bids' | 'payments';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, startDate, endDate' },
        { status: 400 }
      );
    }

    let csvData: string[][] = [];
    let headers: string[] = [];

    if (type === 'wallet') {
      headers = ['Date', 'Description', 'Type', 'Amount', 'Balance After', 'Reference'];

      const [wallet] = await db
        .select({ id: escrowWallets.id })
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendor.id))
        .limit(1);

      if (wallet) {
        const results = await db
          .select({
            date: walletTransactions.createdAt,
            description: walletTransactions.description,
            type: walletTransactions.type,
            amount: walletTransactions.amount,
            balanceAfter: walletTransactions.balanceAfter,
            reference: walletTransactions.reference,
          })
          .from(walletTransactions)
          .where(
            and(
              eq(walletTransactions.walletId, wallet.id),
              gte(walletTransactions.createdAt, new Date(startDate)),
              lte(walletTransactions.createdAt, new Date(endDate + 'T23:59:59'))
            )
          )
          .orderBy(desc(walletTransactions.createdAt));

        csvData = results.map((t) => [
          new Date(t.date).toISOString(),
          t.description,
          t.type,
          t.amount,
          t.balanceAfter,
          t.reference,
        ]);
      }
    } else if (type === 'bids') {
      headers = ['Date', 'Auction ID', 'Bid Amount', 'Status'];

      const results = await db
        .select({
          date: bids.createdAt,
          auctionId: auctions.id,
          amount: bids.amount,
          auctionStatus: auctions.status,
          currentBid: auctions.currentBid,
          winnerId: auctions.winnerId,
        })
        .from(bids)
        .innerJoin(auctions, eq(bids.auctionId, auctions.id))
        .where(
          and(
            eq(bids.vendorId, vendor.id),
            gte(bids.createdAt, new Date(startDate)),
            lte(bids.createdAt, new Date(endDate + 'T23:59:59'))
          )
        )
        .orderBy(desc(bids.createdAt));

      csvData = results
        .map((b) => {
          let bidStatus = 'active';
          if (b.auctionStatus === 'closed') {
            if (b.winnerId === vendor.id) {
              bidStatus = 'won';
            } else {
              bidStatus = 'lost';
            }
          } else if (parseFloat(b.currentBid) > parseFloat(b.amount)) {
            bidStatus = 'outbid';
          }

          // Apply status filter if provided
          if (status && bidStatus !== status) {
            return null;
          }

          return [
            new Date(b.date).toISOString(),
            b.auctionId,
            b.amount,
            bidStatus,
          ];
        })
        .filter(Boolean) as string[][];
    } else if (type === 'payments') {
      headers = ['Date', 'Auction ID', 'Amount', 'Status'];

      const results = await db
        .select({
          date: auctions.closedAt,
          auctionId: auctions.id,
          winningBid: auctions.winningBid,
          status: auctions.status,
        })
        .from(auctions)
        .where(
          and(
            eq(auctions.winnerId, vendor.id),
            gte(auctions.closedAt, new Date(startDate)),
            lte(auctions.closedAt, new Date(endDate + 'T23:59:59'))
          )
        )
        .orderBy(desc(auctions.closedAt));

      csvData = results.map((a) => [
        new Date(a.date || new Date()).toISOString(),
        a.auctionId,
        a.winningBid || '0',
        a.status === 'closed' ? 'completed' : 'pending',
      ]);
    }

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json(
      { error: 'Failed to export transactions' },
      { status: 500 }
    );
  }
}
