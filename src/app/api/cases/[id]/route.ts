/**
 * GET /api/cases/[id]
 * Fetch a single case by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

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
      status: caseData.status 
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
