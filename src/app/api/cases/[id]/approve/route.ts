/**
 * Case Approval API Route
 * 
 * Allows Salvage Manager to approve or reject salvage cases.
 * On approval, auto-creates auction and notifies matching vendors.
 * 
 * POST /api/cases/[id]/approve
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, arrayContains } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { validatePriceOverrides } from '@/lib/validation/price-validation';

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
 * - auctionDurationHours: Optional custom auction duration in hours (default: 120 hours = 5 days)
 * 
 * Requirements: 11.1
 */
interface ApprovalRequest {
  action: 'approve' | 'reject';
  comment?: string;
  priceOverrides?: PriceOverrides;
  auctionDurationHours?: number;
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

    // Check if user is Salvage Manager
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

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

    // Get case by ID
    const caseId = params.id;
    const [caseRecord] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

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
        salvageValue: parseFloat(caseRecord.estimatedSalvageValue),
        reservePrice: parseFloat(caseRecord.reservePrice),
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

    // Get case creator details for notifications
    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.id, caseRecord.createdBy))
      .limit(1);

    if (body.action === 'approve') {
      // APPROVE CASE
      
      // Determine final values to use (Requirements: 6.1, 6.2, 6.3, 11.3, 11.4)
      const aiEstimates = {
        marketValue: parseFloat(caseRecord.marketValue),
        repairCost: caseRecord.aiAssessment?.estimatedRepairCost || 0,
        salvageValue: parseFloat(caseRecord.estimatedSalvageValue),
        reservePrice: parseFloat(caseRecord.reservePrice),
        confidence: caseRecord.aiAssessment?.confidence?.overall || caseRecord.aiAssessment?.confidenceScore || 0,
      };

      // Use overridden prices if provided, else AI estimates
      const finalMarketValue = body.priceOverrides?.marketValue ?? aiEstimates.marketValue;
      const finalRepairCost = body.priceOverrides?.repairCost ?? aiEstimates.repairCost;
      const finalSalvageValue = body.priceOverrides?.salvageValue ?? aiEstimates.salvageValue;
      const finalReservePrice = body.priceOverrides?.reservePrice ?? aiEstimates.reservePrice;

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

      // Auto-create auction with custom duration
      const now = new Date();
      const auctionDurationHours = body.auctionDurationHours || 120; // Default to 5 days (120 hours)
      const endTime = new Date(now.getTime() + auctionDurationHours * 60 * 60 * 1000);

      const [auction] = await db
        .insert(auctions)
        .values({
          caseId: caseId,
          startTime: now,
          endTime: endTime,
          originalEndTime: endTime,
          extensionCount: 0,
          currentBid: null,
          currentBidder: null,
          minimumIncrement: '10000.00', // ₦10,000
          status: 'active',
          watchingCount: 0,
        })
        .returning();

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
            durationHours: auctionDurationHours,
            status: auction.status,
          }
        )
      );

      // Update case status to 'active_auction'
      await db
        .update(salvageCases)
        .set({
          status: 'active_auction',
          updatedAt: new Date(),
        })
        .where(eq(salvageCases.id, caseId));

      // Notify vendors matching asset categories
      const assetType = caseRecord.assetType;
      const matchingVendors = await db
        .select({
          vendorId: vendors.id,
          userId: vendors.userId,
          phone: users.phone,
          email: users.email,
          fullName: users.fullName,
        })
        .from(vendors)
        .innerJoin(users, eq(vendors.userId, users.id))
        .where(
          and(
            eq(vendors.status, 'approved'),
            arrayContains(vendors.categories, [assetType])
          )
        );

      console.log(`Found ${matchingVendors.length} vendors matching asset type: ${assetType}`);

      // Filter out test vendors to save email quota and speed up approval
      const realVendors = matchingVendors.filter(vendor => {
        const isTestEmail = vendor.email.endsWith('@test.com') || vendor.email.endsWith('@example.com');
        if (isTestEmail) {
          console.log(`⏭️ Skipping test vendor: ${vendor.email}`);
        }
        return !isTestEmail;
      });

      console.log(`Sending notifications to ${realVendors.length} real vendors (${matchingVendors.length - realVendors.length} test vendors skipped)`);

      // Send notifications to real vendors only
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
      const durationText = auctionDurationHours < 24 
        ? `${auctionDurationHours} hour${auctionDurationHours !== 1 ? 's' : ''}`
        : `${Math.round(auctionDurationHours / 24)} day${Math.round(auctionDurationHours / 24) !== 1 ? 's' : ''}`;

      for (const vendor of realVendors) {
        // Send SMS notification
        const smsMessage = `New auction available! ${assetType.toUpperCase()} - Reserve: ₦${caseRecord.reservePrice}. Ends in ${durationText}. Bid now: ${appUrl}/vendor/auctions/${auction.id}`;
        
        try {
          await smsService.sendSMS({
            to: vendor.phone,
            message: smsMessage,
          });
        } catch (error) {
          console.error(`Failed to send SMS to vendor ${vendor.vendorId}:`, error);
        }

        // Send email notification using professional template
        try {
          await emailService.sendAuctionStartEmail(vendor.email, {
            vendorName: vendor.fullName,
            auctionId: auction.id,
            assetType: assetType,
            assetName: `${assetType.toUpperCase()} - ${caseRecord.claimReference}`,
            reservePrice: parseFloat(caseRecord.reservePrice),
            startTime: now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
            endTime: endTime.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
            location: caseRecord.locationName,
            appUrl: appUrl,
          });
        } catch (error) {
          console.error(`Failed to send email to vendor ${vendor.vendorId}:`, error);
        }
      }

      // Notify case creator (adjuster) about approval (Requirement: 6.5)
      if (creator) {
        const hasOverrides = body.priceOverrides && Object.keys(body.priceOverrides).length > 0;
        
        // Send SMS notification
        const smsMessage = hasOverrides
          ? `Your case ${caseRecord.claimReference} was approved with price adjustments by ${user.fullName}. Check your email for details.`
          : `Your case ${caseRecord.claimReference} was approved by ${user.fullName}. Auction is now live!`;
        
        try {
          await smsService.sendSMS({
            to: creator.phone,
            message: smsMessage,
          });
        } catch (error) {
          console.error(`Failed to send SMS to adjuster ${creator.id}:`, error);
        }

        // Send email notification with price adjustment details
        try {
          // Build price adjustments object if overrides exist
          const priceAdjustments = hasOverrides ? {
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
          } : undefined;

          await emailService.sendCaseApprovalEmail(creator.email, {
            adjusterName: creator.fullName,
            caseId: caseId,
            claimReference: caseRecord.claimReference,
            assetType: caseRecord.assetType,
            status: 'approved',
            comment: body.comment,
            managerName: user.fullName,
            appUrl: appUrl,
            priceAdjustments: priceAdjustments,
          });
        } catch (error) {
          console.error(`Failed to send email to adjuster ${creator.id}:`, error);
        }
      }

      return NextResponse.json({
        success: true,
        message: body.priceOverrides 
          ? 'Case approved with price adjustments and auction created successfully'
          : 'Case approved and auction created successfully',
        data: {
          case: {
            id: updatedCase.id,
            claimReference: updatedCase.claimReference,
            status: 'active_auction',
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
          },
          notifiedVendors: realVendors.length,
          totalMatchingVendors: matchingVendors.length,
          testVendorsSkipped: matchingVendors.length - realVendors.length,
        },
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

      // Notify case creator (Claims Adjuster) about rejection
      if (creator) {
        // Send SMS notification
        const smsMessage = `Your case ${caseRecord.claimReference} was rejected. Reason: ${body.comment}. Please review and resubmit.`;
        
        try {
          await smsService.sendSMS({
            to: creator.phone,
            message: smsMessage,
          });
        } catch (error) {
          console.error(`Failed to send SMS to adjuster ${creator.id}:`, error);
        }

        // Send email notification using professional template
        try {
          await emailService.sendCaseApprovalEmail(creator.email, {
            adjusterName: creator.fullName,
            caseId: caseId,
            claimReference: caseRecord.claimReference,
            assetType: caseRecord.assetType,
            status: 'rejected',
            comment: body.comment,
            managerName: user.fullName,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com',
          });
        } catch (error) {
          console.error(`Failed to send email to adjuster ${creator.id}:`, error);
        }
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
