import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { payments, auctions, salvageCases, vendors, users, releaseForms } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';

/**
 * GET /api/reports/escrow-performance
 * Generate escrow wallet payment performance report
 * 
 * Query Parameters:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 * 
 * Returns:
 * - summary: total payments, amounts, automation rates, completion rates
 * - timeSeriesData: payments over time for charting
 * - detailedPayments: list of escrow payments with full details
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !['finance_officer', 'system_admin'].includes(session.user.role)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only Finance Officers and Admins can access escrow reports',
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

    // Query escrow wallet payments with related data
    const escrowPayments = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        escrowStatus: payments.escrowStatus,
        autoVerified: payments.autoVerified,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
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
      .where(
        and(
          eq(payments.paymentMethod, 'escrow_wallet'),
          gte(payments.createdAt, start),
          lte(payments.createdAt, end)
        )
      );

    // Get document signing data for each payment
    const auctionIds = escrowPayments.map(p => p.auctionId);
    const documents = auctionIds.length > 0 ? await db
      .select({
        auctionId: releaseForms.auctionId,
        documentType: releaseForms.documentType,
        status: releaseForms.status,
        signedAt: releaseForms.signedAt,
      })
      .from(releaseForms)
      .where(sql`${releaseForms.auctionId} = ANY(${auctionIds})`) : [];

    // Group documents by auction
    const documentsByAuction = documents.reduce((acc, doc) => {
      if (!acc[doc.auctionId]) {
        acc[doc.auctionId] = [];
      }
      acc[doc.auctionId].push(doc);
      return acc;
    }, {} as Record<string, typeof documents>);

    // Calculate metrics
    const totalPayments = escrowPayments.length;
    const totalAmount = escrowPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Automation metrics
    const autoReleased = escrowPayments.filter(p => p.autoVerified && p.status === 'verified').length;
    const manualReleased = escrowPayments.filter(p => !p.autoVerified && p.status === 'verified').length;
    const failed = escrowPayments.filter(p => p.escrowStatus === 'failed').length;
    const automationSuccessRate = totalPayments > 0 ? (autoReleased / totalPayments) * 100 : 0;

    // Document signing completion
    let allDocumentsSigned = 0;
    let partialDocumentsSigned = 0;
    let noDocumentsSigned = 0;

    escrowPayments.forEach(payment => {
      const docs = documentsByAuction[payment.auctionId] || [];
      const signedCount = docs.filter(d => d.status === 'signed').length;
      
      if (signedCount === 3) {
        allDocumentsSigned++;
      } else if (signedCount > 0) {
        partialDocumentsSigned++;
      } else {
        noDocumentsSigned++;
      }
    });

    const documentCompletionRate = totalPayments > 0 ? (allDocumentsSigned / totalPayments) * 100 : 0;

    // Processing time metrics
    const verifiedPayments = escrowPayments.filter(p => p.verifiedAt);
    const processingTimes = verifiedPayments.map(p => {
      const created = new Date(p.createdAt).getTime();
      const verified = new Date(p.verifiedAt!).getTime();
      return (verified - created) / (1000 * 60 * 60); // hours
    });

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    // Time series data for chart (group by day)
    const timeSeriesMap = new Map<string, { date: string; count: number; amount: number }>();
    
    escrowPayments.forEach(payment => {
      const dateKey = new Date(payment.createdAt).toISOString().split('T')[0];
      const existing = timeSeriesMap.get(dateKey) || { date: dateKey, count: 0, amount: 0 };
      existing.count++;
      existing.amount += parseFloat(payment.amount);
      timeSeriesMap.set(dateKey, existing);
    });

    const timeSeriesData = Array.from(timeSeriesMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Detailed payments list
    const detailedPayments = escrowPayments.map(payment => {
      const docs = documentsByAuction[payment.auctionId] || [];
      const signedCount = docs.filter(d => d.status === 'signed').length;
      
      let processingTimeHours = null;
      if (payment.verifiedAt) {
        const created = new Date(payment.createdAt).getTime();
        const verified = new Date(payment.verifiedAt).getTime();
        processingTimeHours = Math.round(((verified - created) / (1000 * 60 * 60)) * 100) / 100;
      }

      return {
        paymentId: payment.paymentId,
        claimReference: payment.claimReference,
        assetType: payment.assetType,
        vendorName: payment.businessName || payment.fullName,
        amount: parseFloat(payment.amount),
        status: payment.status,
        escrowStatus: payment.escrowStatus,
        autoVerified: payment.autoVerified,
        createdAt: payment.createdAt.toISOString(),
        verifiedAt: payment.verifiedAt?.toISOString() || null,
        documentsSigned: signedCount,
        totalDocuments: 3,
        processingTimeHours,
      };
    });

    // Sort by created date (most recent first)
    detailedPayments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      status: 'success',
      data: {
        summary: {
          totalPayments,
          totalAmount: Math.round(totalAmount * 100) / 100,
          autoReleased,
          manualReleased,
          failed,
          automationSuccessRate: Math.round(automationSuccessRate * 100) / 100,
          allDocumentsSigned,
          partialDocumentsSigned,
          noDocumentsSigned,
          documentCompletionRate: Math.round(documentCompletionRate * 100) / 100,
          avgProcessingTimeHours: Math.round(avgProcessingTime * 100) / 100,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        timeSeriesData,
        detailedPayments,
      },
    });
  } catch (error) {
    console.error('Escrow performance report error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate escrow performance report',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
