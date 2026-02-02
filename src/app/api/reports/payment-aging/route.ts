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

    // Calculate aging buckets
    const agingBuckets = {
      current: 0, // Within deadline
      '0-24h': 0, // 0-24 hours overdue
      '24-48h': 0, // 24-48 hours overdue
      '48h+': 0, // 48+ hours overdue
    };

    const statusCounts = {
      pending: 0,
      verified: 0,
      rejected: 0,
      overdue: 0,
    };

    const detailedPayments = paymentData.map((row) => {
      const deadline = new Date(row.paymentDeadline);
      const hoursOverdue = row.status === 'pending' ? (now.getTime() - deadline.getTime()) / (1000 * 60 * 60) : 0;

      let agingBucket = 'current';
      if (hoursOverdue > 0) {
        if (hoursOverdue <= 24) {
          agingBucket = '0-24h';
          agingBuckets['0-24h']++;
        } else if (hoursOverdue <= 48) {
          agingBucket = '24-48h';
          agingBuckets['24-48h']++;
        } else {
          agingBucket = '48h+';
          agingBuckets['48h+']++;
        }
      } else {
        agingBuckets.current++;
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
        hoursOverdue: Math.max(0, Math.round(hoursOverdue * 100) / 100),
        agingBucket,
        paymentTimeHours: paymentTimeHours ? Math.round(paymentTimeHours * 100) / 100 : null,
      };
    });

    // Sort by hours overdue (descending) for pending payments, then by created date
    detailedPayments.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'pending') {
        return b.hoursOverdue - a.hoursOverdue;
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
