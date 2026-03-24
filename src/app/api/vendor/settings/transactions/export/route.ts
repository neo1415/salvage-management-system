import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets, bids, auctions, vendors } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { ExportService } from '@/features/export/services/export.service';

/**
 * GET /api/vendor/settings/transactions/export
 * Export transactions to CSV or PDF
 * 
 * Query params:
 * - type: 'wallet' | 'bids' | 'payments'
 * - format: 'csv' | 'pdf'
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
    const format = searchParams.get('format') as 'csv' | 'pdf' || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: type, startDate, endDate' },
        { status: 400 }
      );
    }

    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "pdf"' },
        { status: 400 }
      );
    }

    let csvData: string[][] = [];
    let headers: string[] = [];
    let exportData: any[] = [];

    if (type === 'wallet') {
      headers = ['Transaction ID', 'Type', 'Amount', 'Balance After', 'Description', 'Date', 'Reference'];

      const [wallet] = await db
        .select({ id: escrowWallets.id })
        .from(escrowWallets)
        .where(eq(escrowWallets.vendorId, vendor.id))
        .limit(1);

      if (wallet) {
        const results = await db
          .select({
            id: walletTransactions.id,
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

        exportData = results.map((t) => ({
          transactionId: t.id,
          type: t.type,
          amount: parseFloat(t.amount),
          balanceAfter: parseFloat(t.balanceAfter),
          description: t.description,
          date: new Date(t.date).toISOString(),
          reference: t.reference,
        }));

        csvData = results.map((t) => [
          t.id,
          t.type,
          t.amount,
          t.balanceAfter,
          t.description,
          new Date(t.date).toISOString(),
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

      const filteredResults = results
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

          return {
            date: new Date(b.date).toISOString(),
            auctionId: b.auctionId,
            amount: parseFloat(b.amount),
            status: bidStatus,
          };
        })
        .filter(Boolean) as any[];

      exportData = filteredResults;
      csvData = filteredResults.map((b) => [
        b.date,
        b.auctionId,
        b.amount.toString(),
        b.status,
      ]);
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

      exportData = results.map((a) => ({
        date: new Date(a.date || new Date()).toISOString(),
        auctionId: a.auctionId,
        amount: parseFloat(a.winningBid || '0'),
        status: a.status === 'closed' ? 'completed' : 'pending',
      }));

      csvData = results.map((a) => [
        new Date(a.date || new Date()).toISOString(),
        a.auctionId,
        a.winningBid || '0',
        a.status === 'closed' ? 'completed' : 'pending',
      ]);
    }

    // Generate export based on format
    if (format === 'csv') {
      // Generate CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      // Return CSV file
      const date = new Date().toISOString().split('T')[0];
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="wallet-transactions-${date}.csv"`,
        },
      });
    } else {
      // Generate PDF using ExportService
      const columns = headers.map((header, index) => ({
        key: Object.keys(exportData[0] || {})[index] || `col${index}`,
        header,
        format: (value: any) => {
          if (typeof value === 'number') {
            return new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: 'NGN',
            }).format(value);
          }
          if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
            return new Date(value).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          }
          return String(value || '');
        },
      }));

      const date = new Date().toISOString().split('T')[0];
      const pdfBuffer = await ExportService.generatePDF({
        filename: `wallet-transactions-${date}.pdf`,
        columns,
        data: exportData,
        title: 'WALLET TRANSACTIONS',
      });

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="wallet-transactions-${date}.pdf"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting transactions:', error);
    return NextResponse.json(
      { error: 'Failed to export transactions' },
      { status: 500 }
    );
  }
}
