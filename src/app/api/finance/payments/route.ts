import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * GET /api/finance/payments
 * Fetch payments for Finance Officer dashboard
 * 
 * Requirements: 27 (Auto-Verified Payments Dashboard)
 * 
 * Acceptance Criteria:
 * - Display total payments today, auto-verified count, pending manual verification count, overdue count
 * - Display pie chart: auto-verified vs manual (target: 90%+ auto)
 * - Show uploaded payment receipts
 * - Show only bank transfer payments requiring manual review
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a Finance Officer
    if (session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Unauthorized: User is not a Finance Officer' },
        { status: 403 }
      );
    }

    // Get today's date range (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all payments created today
    const allPaymentsToday = await db
      .select({
        id: payments.id,
        status: payments.status,
        autoVerified: payments.autoVerified,
      })
      .from(payments)
      .where(gte(payments.createdAt, today));

    // Calculate stats
    const totalToday = allPaymentsToday.length;
    const autoVerified = allPaymentsToday.filter(p => p.autoVerified).length;
    const pendingManual = allPaymentsToday.filter(
      p => p.status === 'pending' && !p.autoVerified
    ).length;
    const overdue = allPaymentsToday.filter(p => p.status === 'overdue').length;

    // Fetch pending payments requiring manual verification (bank transfers)
    const pendingPayments = await db
      .select({
        payment: payments,
        vendor: vendors,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(payments.status, 'pending'),
          eq(payments.paymentMethod, 'bank_transfer')
        )
      )
      .orderBy(sql`${payments.createdAt} ASC`);

    // Format response
    const formattedPayments = pendingPayments.map(({ payment, vendor, auction, case: caseData }) => ({
      id: payment.id,
      auctionId: payment.auctionId,
      vendorId: payment.vendorId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference,
      paymentProofUrl: payment.paymentProofUrl,
      status: payment.status,
      autoVerified: payment.autoVerified,
      paymentDeadline: payment.paymentDeadline.toISOString(),
      createdAt: payment.createdAt.toISOString(),
      vendor: {
        businessName: vendor.businessName,
        bankAccountNumber: vendor.bankAccountNumber,
        bankName: vendor.bankName,
      },
      case: {
        claimReference: caseData.claimReference,
        assetType: caseData.assetType,
        assetDetails: caseData.assetDetails,
      },
    }));

    return NextResponse.json({
      stats: {
        totalToday,
        autoVerified,
        pendingManual,
        overdue,
      },
      payments: formattedPayments,
    });
  } catch (error) {
    console.error('Error fetching finance payments:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch payments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
