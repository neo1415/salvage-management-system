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

/**
 * Approval request body
 */
interface ApprovalRequest {
  action: 'approve' | 'reject';
  comment?: string;
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

    // Get case creator details for notifications
    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.id, caseRecord.createdBy))
      .limit(1);

    if (body.action === 'approve') {
      // APPROVE CASE
      
      // Update case status to 'approved'
      const [updatedCase] = await db
        .update(salvageCases)
        .set({
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

      // Auto-create auction
      const now = new Date();
      const endTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

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

      // Send notifications to matching vendors
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';

      for (const vendor of matchingVendors) {
        // Send SMS notification
        const smsMessage = `New auction available! ${assetType.toUpperCase()} - Reserve: ₦${caseRecord.reservePrice}. Ends in 5 days. Bid now: ${appUrl}/vendor/auctions/${auction.id}`;
        
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

      return NextResponse.json({
        success: true,
        message: 'Case approved and auction created successfully',
        data: {
          case: {
            id: updatedCase.id,
            claimReference: updatedCase.claimReference,
            status: 'active_auction',
            approvedBy: updatedCase.approvedBy,
            approvedAt: updatedCase.approvedAt,
          },
          auction: {
            id: auction.id,
            startTime: auction.startTime,
            endTime: auction.endTime,
            status: auction.status,
          },
          notifiedVendors: matchingVendors.length,
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
