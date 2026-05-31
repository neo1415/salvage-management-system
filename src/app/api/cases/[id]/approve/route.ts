/**
 * Case Approval API Route
 * 
 * Allows Salvage Manager to approve or reject salvage cases.
 * On approval, auto-creates auction and notifies matching vendors.
 * 
 * POST /api/cases/[id]/approve
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db, withRetry } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType, createAuditLogData } from '@/lib/utils/audit-logger';
import { validatePriceOverrides } from '@/lib/validation/price-validation';
import {
  notifyAdjusterOfCaseApproval,
  notifyAdjusterOfCaseRejection,
  notifyMatchingVendorsOfNewAuction,
  notifyStaffOfCaseApproval,
} from '@/features/notifications/services/case-approval-notifications.service';
import {
  businessPolicyService,
  logPolicyDecision,
  resolveReservePrice,
} from '@/features/business-policy';
import { getAppUrl } from '@/features/notifications/templates/email-urls';

/**
 * Price override data structure
 * Allows managers to override AI-estimated prices
 */
interface PriceOverrides {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
}

/**
 * Approval request body
 * 
 * API Contract:
 * - action: 'approve' or 'reject'
 * - comment: Optional for approval, required for rejection (min 10 chars)
 * - priceOverrides: Optional price adjustments (requires comment if provided)
 * - scheduleData: Optional auction scheduling data
 * 
 * Requirements: 11.1
 */
interface ApprovalRequest {
  action: 'approve' | 'reject';
  comment?: string;
  priceOverrides?: PriceOverrides;
  scheduleData?: {
    mode: 'now' | 'scheduled';
    scheduledTime?: Date | string;
    durationHours?: number;
  };
}

/**
 * POST /api/cases/[id]/approve
 * Approve or reject a salvage case
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Salvage Manager (with retry for connection timeouts)
    const [user] = await withRetry(async () => {
      return await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
    });

    if (!user || user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden: Only Salvage Managers can approve cases' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ApprovalRequest = await request.json();

    // Validate action
    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Require comment for rejection
    if (body.action === 'reject' && (!body.comment || body.comment.trim().length < 10)) {
      return NextResponse.json(
        { error: 'Comment is required for rejection (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // Validate price overrides if provided (Requirements: 11.2, 11.5)
    if (body.priceOverrides && Object.keys(body.priceOverrides).length > 0) {
      // Require comment when overrides are provided (Requirement: 11.2)
      if (!body.comment || body.comment.trim().length < 10) {
        return NextResponse.json(
          { 
            error: 'Comment is required when overriding prices (minimum 10 characters)',
            details: 'Please explain why you are adjusting these prices'
          },
          { status: 400 }
        );
      }
    }

    // Get case by ID (with retry for connection timeouts)
    const caseId = params.id;
    const [caseRecord] = await withRetry(async () => {
      return await db
        .select()
        .from(salvageCases)
        .where(eq(salvageCases.id, caseId))
        .limit(1);
    });

    if (!caseRecord) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Check if case is in pending_approval status
    if (caseRecord.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Case cannot be ${body.action}ed. Current status: ${caseRecord.status}` },
        { status: 400 }
      );
    }

    // Validate price override relationships if provided (Requirements: 11.2, 11.5)
    if (body.priceOverrides && Object.keys(body.priceOverrides).length > 0) {
      const aiEstimates = {
        marketValue: parseFloat(caseRecord.marketValue),
        salvageValue: parseFloat(caseRecord.estimatedSalvageValue ?? '0'),
        reservePrice: parseFloat(caseRecord.reservePrice ?? '0'),
      };

      const validationResult = validatePriceOverrides(body.priceOverrides, aiEstimates);

      if (!validationResult.isValid) {
        return NextResponse.json(
          { 
            error: 'Price override validation failed',
            details: validationResult.errors,
            warnings: validationResult.warnings,
          },
          { status: 400 }
        );
      }
    }

    // Get case creator details for notifications (with retry for connection timeouts)
    const [creator] = await withRetry(async () => {
      return await db
        .select()
        .from(users)
        .where(eq(users.id, caseRecord.createdBy))
        .limit(1);
    });

    if (body.action === 'approve') {
      // APPROVE CASE
      
      // Define appUrl for use in notifications
      const appUrl = getAppUrl();
      
      // Determine final values to use (Requirements: 6.1, 6.2, 6.3, 11.3, 11.4)
      const aiEstimates = {
        marketValue: parseFloat(caseRecord.marketValue),
        repairCost: caseRecord.aiAssessment?.estimatedRepairCost || 0,
        salvageValue: parseFloat(caseRecord.estimatedSalvageValue ?? '0'),
        reservePrice: parseFloat(caseRecord.reservePrice ?? '0'),
        confidence: caseRecord.aiAssessment?.confidence?.overall || caseRecord.aiAssessment?.confidenceScore || 0,
      };

      // Use overridden prices if provided, else AI estimates
      const finalMarketValue = body.priceOverrides?.marketValue ?? aiEstimates.marketValue;
      const finalRepairCost = body.priceOverrides?.repairCost ?? aiEstimates.repairCost;
      const finalSalvageValue = body.priceOverrides?.salvageValue ?? aiEstimates.salvageValue;
      const finalReservePrice = body.priceOverrides?.reservePrice ?? aiEstimates.reservePrice;
      const policy = await businessPolicyService.getEffectivePolicy();
      const reserveDecision = resolveReservePrice(policy, finalSalvageValue);

      await logPolicyDecision({
        userId: session.user.id,
        entityType: AuditEntityType.CASE,
        entityId: caseId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        deviceType: DeviceType.DESKTOP,
        decision: {
          ...reserveDecision.decision,
          entityId: caseId,
        },
        context: {
          mode: 'shadow',
          surface: 'case_approval_route',
          caseId,
          legacyFinalReservePrice: finalReservePrice,
          policyReservePrice: reserveDecision.value,
          hadManagerReserveOverride: body.priceOverrides?.reservePrice !== undefined,
        },
      });

      // Update case status to 'approved' and store both AI estimates and overrides
      const [updatedCase] = await db
        .update(salvageCases)
        .set({
          // Update with final values
          marketValue: finalMarketValue.toString(),
          estimatedSalvageValue: finalSalvageValue.toString(),
          reservePrice: finalReservePrice.toString(),
          // Store original AI estimates for audit trail (Requirement: 6.4, 11.4)
          aiEstimates: aiEstimates,
          // Store manager overrides if any (Requirement: 6.4, 11.4)
          managerOverrides: body.priceOverrides ? {
            ...body.priceOverrides,
            reason: body.comment!,
            overriddenBy: session.user.id,
            overriddenAt: new Date().toISOString(),
          } : null,
          status: 'approved',
          approvedBy: session.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId))
        .returning();

      // Create audit log for case approval
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          AuditActionType.CASE_APPROVED,
          AuditEntityType.CASE,
          caseId,
          { status: caseRecord.status },
          { status: 'approved', approvedBy: session.user.id }
        )
      );

      // Create audit log for price overrides if any (Requirement: 7.1, 7.2, 7.3)
      if (body.priceOverrides && Object.keys(body.priceOverrides).length > 0) {
        await logAction(
          createAuditLogData(
            request,
            session.user.id,
            AuditActionType.PRICE_OVERRIDE,
            AuditEntityType.CASE,
            caseId,
            {
              aiEstimates: aiEstimates,
            },
            {
              managerOverrides: body.priceOverrides,
              reason: body.comment,
              finalValues: {
                marketValue: finalMarketValue,
                repairCost: finalRepairCost,
                salvageValue: finalSalvageValue,
                reservePrice: finalReservePrice,
              },
            }
          )
        );
      }

      // Auto-create auction with scheduling support
      const now = new Date();
      const scheduleData = body.scheduleData || { mode: 'now', durationHours: 120 };
      
      // Get duration in hours (default 120 hours = 5 days)
      const durationHours = scheduleData.durationHours || 120;
      const durationMs = durationHours * 60 * 60 * 1000;
      
      let auctionStatus: 'scheduled' | 'active' = 'active';
      let scheduledStartTime: Date | null = null;
      let isScheduled = false;
      let startTime = now;
      let endTime: Date;
      
      if (scheduleData.mode === 'scheduled' && scheduleData.scheduledTime) {
        // Scheduled auction
        auctionStatus = 'scheduled';
        scheduledStartTime = new Date(scheduleData.scheduledTime);
        isScheduled = true;
        startTime = scheduledStartTime;
        // Use specified duration from scheduled start
        endTime = new Date(scheduledStartTime.getTime() + durationMs);
      } else {
        // Start now - use specified duration
        endTime = new Date(now.getTime() + durationMs);
      }

      const [auction] = await db
        .insert(auctions)
        .values({
          caseId: caseId,
          startTime: startTime,
          endTime: endTime,
          originalEndTime: endTime,
          extensionCount: 0,
          currentBid: null,
          currentBidder: null,
          minimumIncrement: '10000.00', // ₦10,000
          status: auctionStatus,
          watchingCount: 0,
          scheduledStartTime: scheduledStartTime,
          isScheduled: isScheduled,
        })
        .returning();

      await businessPolicyService.createPolicySnapshot({
        policy,
        entityType: 'auction',
        entityId: auction.id,
        actorId: session.user.id,
        reason: 'Auction created from approved salvage case.',
      });

      // Create audit log for auction creation
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          AuditActionType.AUCTION_CREATED,
          AuditEntityType.AUCTION,
          auction.id,
          undefined,
          {
            caseId: caseId,
            startTime: auction.startTime,
            endTime: auction.endTime,
            status: auction.status,
            isScheduled: auction.isScheduled,
            scheduledStartTime: auction.scheduledStartTime,
          }
        )
      );

      // Update case status based on auction status
      const caseStatus = auctionStatus === 'scheduled' ? 'approved' : 'active_auction';
      await db
        .update(salvageCases)
        .set({
          status: caseStatus,
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId));

      const hasOverrides = !!(body.priceOverrides && Object.keys(body.priceOverrides).length > 0);
      const priceAdjustments = hasOverrides
        ? {
            ...(body.priceOverrides!.marketValue !== undefined && {
              marketValue: {
                original: aiEstimates.marketValue,
                adjusted: body.priceOverrides!.marketValue,
              },
            }),
            ...(body.priceOverrides!.repairCost !== undefined && {
              repairCost: {
                original: aiEstimates.repairCost,
                adjusted: body.priceOverrides!.repairCost,
              },
            }),
            ...(body.priceOverrides!.salvageValue !== undefined && {
              salvageValue: {
                original: aiEstimates.salvageValue,
                adjusted: body.priceOverrides!.salvageValue,
              },
            }),
            ...(body.priceOverrides!.reservePrice !== undefined && {
              reservePrice: {
                original: aiEstimates.reservePrice,
                adjusted: body.priceOverrides!.reservePrice,
              },
            }),
          }
        : undefined;

      const responseBody = {
        success: true,
        message: body.priceOverrides
          ? 'Case approved with price adjustments and auction created successfully'
          : scheduleData.mode === 'scheduled'
            ? 'Case approved and auction scheduled successfully'
            : 'Case approved and auction created successfully',
        data: {
          case: {
            id: updatedCase.id,
            claimReference: updatedCase.claimReference,
            status: caseStatus,
            approvedBy: updatedCase.approvedBy,
            approvedAt: updatedCase.approvedAt,
            priceOverridesApplied: !!body.priceOverrides,
          },
          auction: {
            id: auction.id,
            startTime: auction.startTime,
            endTime: auction.endTime,
            status: auction.status,
            reservePrice: finalReservePrice,
            isScheduled: auction.isScheduled,
            scheduledStartTime: auction.scheduledStartTime,
          },
          notifiedVendors: scheduleData.mode === 'now' ? null : 0,
          notificationsQueued: true,
        },
      };

      // SMS/email to many vendors can take 30s+ — run after the manager gets success UI.
      after(async () => {
        let notifiedVendorsCount = 0;

        if (scheduleData.mode === 'now') {
          notifiedVendorsCount = await notifyMatchingVendorsOfNewAuction({
            auctionId: auction.id,
            assetType: caseRecord.assetType,
            claimReference: caseRecord.claimReference,
            reservePrice: finalReservePrice.toString(),
            locationName: caseRecord.locationName,
            endTime,
            appUrl,
          });
        }

        if (creator) {
          await notifyAdjusterOfCaseApproval({
            creatorId: creator.id,
            creatorPhone: creator.phone,
            creatorEmail: creator.email,
            creatorName: creator.fullName,
            caseId,
            claimReference: caseRecord.claimReference,
            assetType: caseRecord.assetType,
            auctionId: auction.id,
            managerName: user.fullName,
            appUrl,
            scheduleMode: scheduleData.mode,
            comment: body.comment,
            hasOverrides,
            priceAdjustments,
          });
        }

        await notifyStaffOfCaseApproval({
          claimReference: caseRecord.claimReference,
          caseId,
          auctionId: auction.id,
          scheduleMode: scheduleData.mode,
        });

        console.log(
          `[CaseApproval] Background notifications finished (vendors: ${notifiedVendorsCount})`
        );
      });

      return NextResponse.json({
        ...responseBody,
      });
    } else {
      // REJECT CASE
      
      // Update case status back to 'draft' (return to adjuster)
      const [updatedCase] = await db
        .update(salvageCases)
        .set({
          status: 'draft',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId))
        .returning();

      // Create audit log for case rejection
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          AuditActionType.CASE_REJECTED,
          AuditEntityType.CASE,
          caseId,
          { status: caseRecord.status },
          { 
            status: 'draft',
            rejectedBy: session.user.id,
            rejectionReason: body.comment,
          }
        )
      );

      const { getAppUrl } = await import('@/features/notifications/templates/email-urls');
      const rejectAppUrl = getAppUrl();

      if (creator) {
        after(async () => {
          await notifyAdjusterOfCaseRejection({
            creatorId: creator.id,
            creatorPhone: creator.phone,
            creatorEmail: creator.email,
            creatorName: creator.fullName,
            caseId,
            claimReference: caseRecord.claimReference,
            assetType: caseRecord.assetType,
            comment: body.comment!,
            managerName: user.fullName,
            appUrl: rejectAppUrl,
          });
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Case rejected and returned to adjuster',
        data: {
          case: {
            id: updatedCase.id,
            claimReference: updatedCase.claimReference,
            status: 'draft',
            rejectionReason: body.comment,
          },
        },
      });
    }
  } catch (error) {
    console.error('Case approval error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process case approval',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
