import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets, bids, auctions, vendors, payments } from '@/lib/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { ExportService } from '@/features/export/services/export.service';
import { formatNgnAmount } from '@/lib/utils/format-ngn';

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

    let columns: { key: string; header: string }[] = [];
    let exportData: Record<string, string>[] = [];

    if (type === 'wallet') {
      columns = [
        { key: 'transactionId', header: 'Transaction ID' },
        { key: 'type', header: 'Type' },
        { key: 'amount', header: 'Amount' },
        { key: 'balanceAfter', header: 'Balance After' },
        { key: 'description', header: 'Description' },
        { key: 'date', header: 'Date' },
        { key: 'reference', header: 'Reference' },
      ];

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
          amount: formatNgnAmount(t.amount, { decimals: 0 }),
          balanceAfter: formatNgnAmount(t.balanceAfter, { decimals: 0 }),
          description: t.description ?? '',
          date: new Date(t.date).toISOString(),
          reference: t.reference ?? '',
        }));
      }
    } else if (type === 'bids') {
      columns = [
        { key: 'date', header: 'Date' },
        { key: 'auctionId', header: 'Auction ID' },
        { key: 'amount', header: 'Bid Amount' },
        { key: 'status', header: 'Status' },
      ];

      const results = await db
        .select({
          date: bids.createdAt,
          auctionId: auctions.id,
          amount: bids.amount,
          auctionStatus: auctions.status,
          currentBid: auctions.currentBid,
          winnerId: auctions.currentBidder,
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
          } else if (parseFloat(b.currentBid ?? '0') > parseFloat(b.amount)) {
            bidStatus = 'outbid';
          }

          // Apply status filter if provided
          if (status && bidStatus !== status) {
            return null;
          }

          return {
            date: new Date(b.date).toISOString(),
            auctionId: b.auctionId,
            amount: formatNgnAmount(b.amount, { decimals: 0 }),
            status: bidStatus,
          };
        })
        .filter(Boolean) as Array<Record<string, string>>;

      exportData = filteredResults;
    } else if (type === 'payments') {
      columns = [
        { key: 'date', header: 'Date' },
        { key: 'auctionId', header: 'Auction ID' },
        { key: 'amount', header: 'Amount' },
        { key: 'status', header: 'Status' },
      ];

      const results = await db
        .select({
          date: payments.verifiedAt,
          auctionId: payments.auctionId,
          amount: payments.amount,
          status: payments.status,
        })
        .from(payments)
        .where(
          and(
            eq(payments.vendorId, vendor.id),
            gte(payments.createdAt, new Date(startDate)),
            lte(payments.createdAt, new Date(endDate + 'T23:59:59'))
          )
        )
        .orderBy(desc(payments.createdAt));

      exportData = results.map((a) => ({
        date: new Date(a.date || new Date()).toISOString(),
        auctionId: a.auctionId || 'Registration fee',
        amount: formatNgnAmount(a.amount, { decimals: 0 }),
        status: a.status === 'verified' ? 'completed' : a.status,
      }));
    }

    const filename = ExportService.generateFilename(`vendor-${type}-transactions`, format);

    if (format === 'csv') {
      const csvContent = ExportService.generateCSV({
        filename,
        columns,
        data: exportData,
      });

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const pdfBuffer = await ExportService.generatePDF({
      filename,
      columns,
      data: exportData,
      title: `VENDOR ${type.toUpperCase()} TRANSACTIONS`,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
