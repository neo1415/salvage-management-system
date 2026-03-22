import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { escrowService } from '@/features/payments/services/escrow.service';
import { getDocumentProgress } from '@/features/documents/services/document.service';

/**
 * GET /api/finance/payments
 * Fetch payments for Finance Officer dashboard with flexible filtering
 * 
 * Requirements: 27 (Auto-Verified Payments Dashboard)
 * 
 * Query Parameters:
 * - view: 'all' | 'today' | 'pending' | 'overdue' (default: 'all')
 * - status: 'pending' | 'verified' | 'rejected' | 'overdue' (optional)
 * - paymentMethod: 'paystack' | 'flutterwave' | 'bank_transfer' | 'escrow_wallet' (optional)
 * - dateFrom: ISO date string (optional)
 * - dateTo: ISO date string (optional)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'all';
    const statusFilter = searchParams.get('status');
    const paymentMethodFilter = searchParams.get('paymentMethod');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Get today's date range (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build dynamic where conditions for payments list
    const conditions = [];

    // Apply view-based filters
    if (view === 'today') {
      conditions.push(gte(payments.createdAt, today));
    } else if (view === 'pending') {
      conditions.push(eq(payments.status, 'pending'));
    } else if (view === 'overdue') {
      conditions.push(eq(payments.status, 'overdue'));
    }

    // Apply status filter
    if (statusFilter) {
      conditions.push(eq(payments.status, statusFilter as any));
    }

    // Apply payment method filter
    if (paymentMethodFilter) {
      conditions.push(eq(payments.paymentMethod, paymentMethodFilter as any));
    }

    // Apply date range filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      conditions.push(gte(payments.createdAt, fromDate));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, toDate));
    }

    // Fetch payments with filters
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const filteredPayments = await db
      .select({
        payment: payments,
        vendor: vendors,
        user: users,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(whereClause)
      .orderBy(sql`${payments.createdAt} DESC`);

    // Update payment status to 'overdue' if past deadline (real-time check)
    const now = new Date();
    for (const { payment } of filteredPayments) {
      if (
        payment.status === 'pending' &&
        payment.paymentDeadline < now
      ) {
        // Update status to overdue in database
        await db
          .update(payments)
          .set({
            status: 'overdue',
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));
        
        // Update in-memory object for response
        payment.status = 'overdue';
      }
    }

    // Calculate stats from filtered payments (not just today)
    const totalFiltered = filteredPayments.length;
    const autoVerified = filteredPayments.filter(p => p.payment.autoVerified).length;
    const pendingManual = filteredPayments.filter(
      p => p.payment.status === 'pending' && !p.payment.autoVerified
    ).length;
    const overdue = filteredPayments.filter(p => p.payment.status === 'overdue').length;

    // Format response
    const formattedPayments = await Promise.all(
      filteredPayments.map(async ({ payment, vendor, user, case: caseData }) => {
        const base = {
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
          escrowStatus: payment.escrowStatus,
          vendor: {
            id: vendor.id,
            businessName: vendor.businessName,
            contactPersonName: user.fullName,
            phoneNumber: user.phone,
            email: user.email,
            kycTier: vendor.tier === 'tier1_bvn' ? 'tier1' : vendor.tier === 'tier2_full' ? 'tier2' : null,
            kycStatus: vendor.status,
            bankAccountNumber: vendor.bankAccountNumber,
            bankName: vendor.bankName,
            bankAccountName: vendor.bankAccountName,
          },
          case: {
            claimReference: caseData.claimReference,
            assetType: caseData.assetType,
            assetDetails: caseData.assetDetails,
          },
        };

        if (payment.paymentMethod !== 'escrow_wallet') {
          return base;
        }

        // Enrich escrow wallet payments with wallet + document progress for Phase 4 UI.
        const wallet = await escrowService.getBalance(payment.vendorId);
        const progress = await getDocumentProgress(payment.auctionId, payment.vendorId);

        return {
          ...base,
          walletBalance: {
            availableBalance: wallet.availableBalance,
            frozenAmount: wallet.frozenAmount,
          },
          documentProgress: {
            signedDocuments: progress.signedDocuments,
            totalDocuments: progress.totalDocuments,
            progress: progress.progress,
            allSigned: progress.allSigned,
          },
        };
      })
    );

    return NextResponse.json({
      stats: {
        total: totalFiltered,
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
