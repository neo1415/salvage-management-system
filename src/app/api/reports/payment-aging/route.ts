import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { payments, auctions, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';

/**
 * GET /api/reports/payment-aging
 * Generate payment aging report showing payment status and delays
 * 
 * Query Parameters:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 * 
 * Returns:
 * - summary: counts by status and aging buckets
 * - payments: detailed list of payments with aging information
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !['salvage_manager', 'finance_officer', 'system_admin'].includes(session.user.role)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only Salvage Managers, Finance Officers, and Admins can access reports',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const startDate =
      searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format. Use ISO date strings',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // Query payments with related data
    const paymentData = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        paymentDeadline: payments.paymentDeadline,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
        autoVerified: payments.autoVerified,
        auctionId: auctions.id,
        caseId: salvageCases.id,
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        vendorId: vendors.id,
        businessName: vendors.businessName,
        fullName: users.fullName,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(and(gte(payments.createdAt, start), lte(payments.createdAt, end)));

    const now = new Date();

    // Calculate aging buckets (in days as per requirements)
    const agingBuckets = {
      '0-7': 0,    // 0-7 days overdue
      '8-14': 0,   // 8-14 days overdue
      '15-21': 0,  // 15-21 days overdue
      '22+': 0,    // 22+ days overdue
    };

    const statusCounts = {
      pending: 0,
      verified: 0,
      rejected: 0,
      overdue: 0,
    };

    const detailedPayments = paymentData.map((row) => {
      const deadline = new Date(row.paymentDeadline);
      const daysOverdue = row.status === 'pending' ? (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24) : 0;

      let agingBucket = '0-7';
      if (daysOverdue > 0) {
        if (daysOverdue <= 7) {
          agingBucket = '0-7';
          agingBuckets['0-7']++;
        } else if (daysOverdue <= 14) {
          agingBucket = '8-14';
          agingBuckets['8-14']++;
        } else if (daysOverdue <= 21) {
          agingBucket = '15-21';
          agingBuckets['15-21']++;
        } else {
          agingBucket = '22+';
          agingBuckets['22+']++;
        }
      } else {
        // Not overdue yet
        agingBuckets['0-7']++;
      }

      // Count by status
      const status = row.status as string;
      if (status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts]++;
      }

      // Calculate payment time if verified
      let paymentTimeHours = null;
      if (row.verifiedAt) {
        paymentTimeHours = (row.verifiedAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60);
      }

      return {
        paymentId: row.paymentId,
        claimReference: row.claimReference,
        assetType: row.assetType,
        vendorName: row.businessName || row.fullName,
        amount: parseFloat(row.amount),
        paymentMethod: row.paymentMethod,
        status: row.status,
        autoVerified: row.autoVerified,
        createdAt: row.createdAt.toISOString(),
        paymentDeadline: row.paymentDeadline.toISOString(),
        verifiedAt: row.verifiedAt?.toISOString() || null,
        daysOverdue: Math.max(0, Math.round(daysOverdue * 100) / 100),
        agingBucket,
        paymentTimeHours: paymentTimeHours ? Math.round(paymentTimeHours * 100) / 100 : null,
      };
    });

    // Sort by days overdue (descending) for pending payments, then by created date
    detailedPayments.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        return b.daysOverdue - a.daysOverdue;
      }
      if (a.status === 'pending') return -1;
      if (b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Calculate summary statistics
    const totalPayments = paymentData.length;
    const totalAmount = paymentData.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const verifiedAmount = paymentData
      .filter((row) => row.status === 'verified')
      .reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const pendingAmount = paymentData
      .filter((row) => row.status === 'pending')
      .reduce((sum, row) => sum + parseFloat(row.amount), 0);
    const overdueAmount = paymentData
      .filter((row) => row.status === 'overdue')
      .reduce((sum, row) => sum + parseFloat(row.amount), 0);

    const autoVerifiedCount = paymentData.filter((row) => row.autoVerified).length;
    const autoVerificationRate = totalPayments > 0 ? (autoVerifiedCount / totalPayments) * 100 : 0;

    return NextResponse.json({
      status: 'success',
      data: {
        summary: {
          totalPayments,
          totalAmount: Math.round(totalAmount * 100) / 100,
          verifiedAmount: Math.round(verifiedAmount * 100) / 100,
          pendingAmount: Math.round(pendingAmount * 100) / 100,
          overdueAmount: Math.round(overdueAmount * 100) / 100,
          statusCounts,
          agingBuckets,
          autoVerificationRate: Math.round(autoVerificationRate * 100) / 100,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        payments: detailedPayments,
      },
    });
  } catch (error) {
    console.error('Payment aging report error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate payment aging report',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
