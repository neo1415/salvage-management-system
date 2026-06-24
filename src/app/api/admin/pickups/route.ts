/**
 * Admin Pickup Confirmations API
 * 
 * GET /api/admin/pickups
 * Fetches list of auctions pending admin pickup confirmation
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctions, salvageCases, vendors, users, payments, releaseForms } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { derivePickupLifecycleStatus } from '@/features/pickups/services/pickup-confirmation.service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or manager
    const allowedRoles = ['salvage_manager', 'system_admin'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending'; // 'pending' | 'all'
    const sortBy = searchParams.get('sortBy') || 'confirmedAt'; // 'confirmedAt' | 'amount' | 'claimRef'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' | 'desc'

    // Fetch payment-verified auctions with a pickup authorization document.
    // These are operationally ready for staff pickup validation even if the
    // vendor did not self-confirm in the portal first.
    const pendingPickups = await db
      .select({
        auction: {
          id: auctions.id,
          caseId: auctions.caseId,
          currentBid: auctions.currentBid,
          pickupConfirmedVendor: auctions.pickupConfirmedVendor,
          pickupConfirmedVendorAt: auctions.pickupConfirmedVendorAt,
          pickupConfirmedAdmin: auctions.pickupConfirmedAdmin,
          pickupConfirmedAdminAt: auctions.pickupConfirmedAdminAt,
          pickupConfirmedAdminBy: auctions.pickupConfirmedAdminBy,
          status: auctions.status,
          endTime: auctions.endTime,
        },
        case: {
          id: salvageCases.id,
          claimReference: salvageCases.claimReference,
          policyNumber: salvageCases.policyNumber,
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
          status: salvageCases.status,
        },
        vendor: {
          id: vendors.id,
          businessName: vendors.businessName,
        },
        vendorUser: {
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        },
        payment: {
          id: payments.id,
          amount: payments.amount,
          status: payments.status,
          paymentMethod: payments.paymentMethod,
          verifiedAt: payments.verifiedAt,
        },
        pickupDocument: {
          id: releaseForms.id,
          deadline: sql<string | null>`${releaseForms.documentData}->>'pickupDeadline'`,
        },
        pickupEvidence: {
          id: sql<string | null>`(
            SELECT pe.id
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          status: sql<string | null>`(
            SELECT pe.comparison_status
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          photoCount: sql<number | null>`(
            SELECT cardinality(pe.photo_urls)
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          findings: sql<string[] | null>`(
            SELECT COALESCE(
              ARRAY(SELECT jsonb_array_elements_text(pe.comparison_summary->'findings')),
              ARRAY[]::text[]
            )
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          observedDifferences: sql<string[] | null>`(
            SELECT COALESCE(
              ARRAY(SELECT jsonb_array_elements_text(pe.comparison_summary->'observedDifferences')),
              ARRAY[]::text[]
            )
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          confidenceScore: sql<number | null>`(
            SELECT (pe.comparison_summary->>'confidenceScore')::int
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          overallMatchScore: sql<number | null>`(
            SELECT (pe.comparison_summary->>'overallMatchScore')::int
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          assetIdentityScore: sql<number | null>`(
            SELECT (pe.comparison_summary->>'assetIdentityScore')::int
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          quantityMatchScore: sql<number | null>`(
            SELECT (pe.comparison_summary->>'quantityMatchScore')::int
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          conditionMatchScore: sql<number | null>`(
            SELECT (pe.comparison_summary->>'conditionMatchScore')::int
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          reviewBand: sql<string | null>`(
            SELECT pe.comparison_summary->>'reviewBand'
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          method: sql<string | null>`(
            SELECT pe.comparison_summary->>'method'
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          recommendedStaffAction: sql<string | null>`(
            SELECT pe.comparison_summary->>'recommendedStaffAction'
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          resolutionStatus: sql<string | null>`(
            SELECT pe.resolution_status
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          adjustmentAmount: sql<string | null>`(
            SELECT pe.adjustment_amount
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          reimbursementMethod: sql<string | null>`(
            SELECT pe.reimbursement_method
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
          submittedAt: sql<string | null>`(
            SELECT pe.created_at
            FROM pickup_evidence pe
            WHERE pe.auction_id = ${auctions.id}
            ORDER BY pe.created_at DESC
            LIMIT 1
          )`,
        },
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(
        payments,
        and(
          eq(payments.auctionId, auctions.id),
          eq(payments.vendorId, vendors.id),
          eq(payments.status, 'verified')
        )
      )
      .innerJoin(
        releaseForms,
        and(
          eq(releaseForms.auctionId, auctions.id),
          eq(releaseForms.vendorId, vendors.id),
          eq(releaseForms.documentType, 'pickup_authorization'),
          eq(releaseForms.disabled, false),
          sql`${releaseForms.status} != 'voided'`
        )
      )
      .where(
        status === 'pending'
          ? and(
              eq(auctions.pickupConfirmedAdmin, false)
            )
          : undefined
      )
      .orderBy(
        sortOrder === 'desc'
          ? desc(auctions.pickupConfirmedVendorAt)
          : auctions.pickupConfirmedVendorAt
      );

    // Format response
    const formattedPickups = Array.from(
      new Map(pendingPickups.map((pickup) => [pickup.auction.id, pickup])).values()
    ).map((pickup) => ({
      auctionId: pickup.auction.id,
      claimReference: pickup.case.claimReference,
      policyNumber: pickup.case.policyNumber,
      assetType: pickup.case.assetType,
      assetDetails: pickup.case.assetDetails,
      amount: pickup.auction.currentBid,
      vendor: {
        id: pickup.vendor.id,
        businessName: pickup.vendor.businessName,
        fullName: pickup.vendorUser.fullName,
        email: pickup.vendorUser.email,
        phone: pickup.vendorUser.phone,
      },
      vendorConfirmation: {
        confirmed: pickup.auction.pickupConfirmedVendor,
        confirmedAt: pickup.auction.pickupConfirmedVendorAt,
      },
      adminConfirmation: {
        confirmed: pickup.auction.pickupConfirmedAdmin,
        confirmedAt: pickup.auction.pickupConfirmedAdminAt,
        confirmedBy: pickup.auction.pickupConfirmedAdminBy,
      },
      pickupStatus: derivePickupLifecycleStatus({
        hasVerifiedPayment: pickup.payment?.status === 'verified',
        hasPickupAuthorization: !!pickup.pickupDocument?.id,
        pickupConfirmedVendor: pickup.auction.pickupConfirmedVendor,
        pickupConfirmedAdmin: pickup.auction.pickupConfirmedAdmin,
      }),
      pickupDeadline: pickup.pickupDocument?.deadline || null,
      pickupEvidence: pickup.pickupEvidence?.id
        ? {
            id: pickup.pickupEvidence.id,
            status: pickup.pickupEvidence.status,
            photoCount: pickup.pickupEvidence.photoCount,
            findings: pickup.pickupEvidence.findings || [],
            observedDifferences: pickup.pickupEvidence.observedDifferences || [],
            confidenceScore: pickup.pickupEvidence.confidenceScore,
            overallMatchScore: pickup.pickupEvidence.overallMatchScore,
            assetIdentityScore: pickup.pickupEvidence.assetIdentityScore,
            quantityMatchScore: pickup.pickupEvidence.quantityMatchScore,
            conditionMatchScore: pickup.pickupEvidence.conditionMatchScore,
            reviewBand: pickup.pickupEvidence.reviewBand,
            method: pickup.pickupEvidence.method,
            recommendedStaffAction: pickup.pickupEvidence.recommendedStaffAction,
            resolutionStatus: pickup.pickupEvidence.resolutionStatus,
            adjustmentAmount: pickup.pickupEvidence.adjustmentAmount,
            reimbursementMethod: pickup.pickupEvidence.reimbursementMethod,
            submittedAt: pickup.pickupEvidence.submittedAt,
          }
        : null,
      payment: pickup.payment
        ? {
            id: pickup.payment.id,
            amount: pickup.payment.amount,
            status: pickup.payment.status,
            paymentMethod: pickup.payment.paymentMethod,
            verifiedAt: pickup.payment.verifiedAt,
          }
        : null,
      auctionStatus: pickup.auction.status,
      caseStatus: pickup.case.status,
      auctionEndTime: pickup.auction.endTime,
    }));

    // Apply sorting if needed
    if (sortBy === 'amount') {
      formattedPickups.sort((a, b) => {
        const amountA = parseFloat(a.amount || '0');
        const amountB = parseFloat(b.amount || '0');
        return sortOrder === 'desc' ? amountB - amountA : amountA - amountB;
      });
    } else if (sortBy === 'claimRef') {
      formattedPickups.sort((a, b) => {
        const comparison = a.claimReference.localeCompare(b.claimReference);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return NextResponse.json({
      success: true,
      pickups: formattedPickups,
      count: formattedPickups.length,
    });
  } catch (error) {
    console.error('Error fetching pickup confirmations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pickup confirmations' },
      { status: 500 }
    );
  }
}
