/**
 * GET /api/cases/[id]
 * Fetch a single case by ID
 * 
 * PATCH /api/cases/[id]
 * Update case status or other fields
 * 
 * DELETE /api/cases/[id]
 * Delete a case (admin/manager only, or adjuster for their own drafts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, and } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    console.log('Fetching case with ID:', caseId);
    
    const session = await auth();
    console.log('Session:', { userId: session?.user?.id, role: session?.user?.role });

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the case with adjuster info
    console.log('Querying database for case:', caseId);
    const caseResult = await db
      .select({
        id: salvageCases.id,
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        reservePrice: salvageCases.reservePrice,
        damageSeverity: salvageCases.damageSeverity,
        aiAssessment: salvageCases.aiAssessment,
        gpsLocation: salvageCases.gpsLocation,
        locationName: salvageCases.locationName,
        photos: salvageCases.photos,
        voiceNotes: salvageCases.voiceNotes, // ADDED: Include voice notes
        status: salvageCases.status,
        createdAt: salvageCases.createdAt,
        updatedAt: salvageCases.updatedAt,
        createdBy: salvageCases.createdBy,
        approvedBy: salvageCases.approvedBy,
        approvedAt: salvageCases.approvedAt,
        adjusterName: users.fullName,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id))
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    console.log('Query result:', { found: caseResult.length > 0 });

    if (caseResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Case not found' },
        { status: 404 }
      );
    }

    const caseData = caseResult[0];
    console.log('Case data:', { 
      id: caseData.id, 
      createdBy: caseData.createdBy,
      status: caseData.status,
      damageSeverity: caseData.damageSeverity, // DEBUG: Log severity
    });

    // Check if user has permission to view this case
    // Adjusters can only view their own cases
    // Managers and admins can view all cases
    const userRole = session.user.role;
    const isAdjuster = userRole === 'claims_adjuster';
    const isOwner = caseData.createdBy === session.user.id;

    console.log('Permission check:', { userRole, isAdjuster, isOwner });

    if (isAdjuster && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this case' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: caseData,
    });
  } catch (error) {
    console.error('Error fetching case:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch case',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


/**
 * PATCH /api/cases/[id]
 * Update case status or other fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the case to check ownership
    const existingCase = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    if (existingCase.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Case not found' },
        { status: 404 }
      );
    }

    const caseData = existingCase[0];
    const userRole = session.user.role;
    const isOwner = caseData.createdBy === session.user.id;
    const isManager = userRole === 'manager' || userRole === 'admin';

    // Only owner or manager can update
    if (!isOwner && !isManager) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this case' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, ...otherUpdates } = body;

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['pending_approval', 'cancelled'],
        pending_approval: ['approved', 'cancelled'],
        approved: ['active_auction', 'cancelled'],
        active_auction: ['sold', 'cancelled'],
      };

      const allowedStatuses = validTransitions[caseData.status] || [];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot transition from ${caseData.status} to ${status}` 
          },
          { status: 400 }
        );
      }
    }

    // Update the case
    const updateData: any = {
      ...otherUpdates,
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    await db
      .update(salvageCases)
      .set(updateData)
      .where(eq(salvageCases.id, caseId));

    // Log audit event
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.CASE_UPDATED,
      entityType: AuditEntityType.CASE,
      entityId: caseId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      deviceType: DeviceType.DESKTOP, // Could be enhanced to detect actual device
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: { status: caseData.status },
      afterState: { status: status || caseData.status, ...otherUpdates },
    });

    return NextResponse.json({
      success: true,
      message: 'Case updated successfully',
    });
  } catch (error) {
    console.error('Error updating case:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update case',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]
 * Delete a case and all related data
 * Only allowed for:
 * - Admins/Managers (any case)
 * - Adjusters (only their own draft cases)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the case to check ownership and status
    const existingCase = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.id, caseId))
      .limit(1);

    if (existingCase.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Case not found' },
        { status: 404 }
      );
    }

    const caseData = existingCase[0];
    const userRole = session.user.role;
    const isOwner = caseData.createdBy === session.user.id;
    const isAdmin = userRole === 'admin' || userRole === 'manager';
    const isDraft = caseData.status === 'draft';

    // Permission check
    if (!isAdmin && !(isOwner && isDraft)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You can only delete your own draft cases. Contact an admin to delete other cases.' 
        },
        { status: 403 }
      );
    }

    // Check if case has active auction or bids
    const relatedAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, caseId))
      .limit(1);

    if (relatedAuctions.length > 0) {
      const auction = relatedAuctions[0];
      
      // Check for bids
      const relatedBids = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auction.id))
        .limit(1);

      if (relatedBids.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Cannot delete case with active bids. Please cancel the auction first.' 
          },
          { status: 400 }
        );
      }

      // Delete auction if no bids
      await db.delete(auctions).where(eq(auctions.id, auction.id));
    }

    // Delete related audit logs
    await db.delete(auditLogs).where(
      and(
        eq(auditLogs.entityType, 'case'),
        eq(auditLogs.entityId, caseId)
      )
    );

    // Delete the case
    await db.delete(salvageCases).where(eq(salvageCases.id, caseId));

    // Log deletion
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.CASE_DELETED,
      entityType: AuditEntityType.CASE,
      entityId: caseId,
      ipAddress: _request.headers.get('x-forwarded-for') || _request.headers.get('x-real-ip') || 'unknown',
      deviceType: DeviceType.DESKTOP,
      userAgent: _request.headers.get('user-agent') || 'unknown',
      beforeState: {
        claimReference: caseData.claimReference,
        status: caseData.status,
        assetType: caseData.assetType,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Case deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting case:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete case',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
