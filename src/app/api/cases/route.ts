/**
 * Cases API Route
 * 
 * POST /api/cases - Create a new salvage case
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { createCase, ValidationError, type CreateCaseInput } from '@/features/cases/services/case.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

/**
 * POST /api/cases
 * Create a new salvage case
 * 
 * Request body:
 * {
 *   claimReference: string;
 *   assetType: 'vehicle' | 'property' | 'electronics';
 *   assetDetails: VehicleDetails | PropertyDetails | ElectronicsDetails;
 *   marketValue: number;
 *   photos: string[]; // Base64 encoded images
 *   gpsLocation: { latitude: number; longitude: number };
 *   locationName: string;
 *   voiceNotes?: string[];
 *   status?: 'draft' | 'pending_approval';
 * }
 * 
 * Response:
 * {
 *   success: true;
 *   data: CreateCaseResult;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.claimReference) {
      return NextResponse.json(
        { success: false, error: 'Claim reference is required' },
        { status: 400 }
      );
    }

    if (!body.assetType) {
      return NextResponse.json(
        { success: false, error: 'Asset type is required' },
        { status: 400 }
      );
    }

    if (!body.assetDetails) {
      return NextResponse.json(
        { success: false, error: 'Asset details are required' },
        { status: 400 }
      );
    }

    if (!body.marketValue) {
      return NextResponse.json(
        { success: false, error: 'Market value is required' },
        { status: 400 }
      );
    }

    if (!body.photos || !Array.isArray(body.photos)) {
      return NextResponse.json(
        { success: false, error: 'Photos are required' },
        { status: 400 }
      );
    }

    if (!body.gpsLocation) {
      return NextResponse.json(
        { success: false, error: 'GPS location is required' },
        { status: 400 }
      );
    }

    if (!body.locationName) {
      return NextResponse.json(
        { success: false, error: 'Location name is required' },
        { status: 400 }
      );
    }

    // Convert base64 photos to buffers
    const photoBuffers: Buffer[] = [];
    for (const photo of body.photos) {
      try {
        // Handle both data URL format and plain base64
        const base64Data = photo.includes('base64,') 
          ? photo.split('base64,')[1] 
          : photo;
        const buffer = Buffer.from(base64Data, 'base64');
        photoBuffers.push(buffer);
      } catch (error) {
        console.error('Error converting photo to buffer:', error);
        return NextResponse.json(
          { success: false, error: 'Invalid photo format' },
          { status: 400 }
        );
      }
    }

    // Extract audit information
    const headers = request.headers;
    const ipAddress = getIpAddress(headers);
    const userAgent = headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    // Create case input
    const input: CreateCaseInput = {
      claimReference: body.claimReference,
      assetType: body.assetType,
      assetDetails: body.assetDetails,
      marketValue: body.marketValue,
      photos: photoBuffers,
      gpsLocation: body.gpsLocation,
      locationName: body.locationName,
      voiceNotes: body.voiceNotes,
      createdBy: session.user.id,
      status: body.status || 'pending_approval',
    };

    // Create case
    const result = await createCase(input, ipAddress, deviceType, userAgent);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/cases:', error);

    // Handle validation errors
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errors: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create case',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases
 * Get all cases with optional filtering
 * 
 * Query parameters:
 * - status: Filter by case status (e.g., 'pending_approval', 'draft', 'approved')
 * - limit: Number of cases to return (default: 50)
 * - offset: Number of cases to skip (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Import database dependencies
    const { db } = await import('@/lib/db/drizzle');
    const { salvageCases } = await import('@/lib/db/schema/cases');
    const { users } = await import('@/lib/db/schema/users');
    const { eq, desc } = await import('drizzle-orm');

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build base query
    const baseQuery = db
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
        voiceNotes: salvageCases.voiceNotes,
        status: salvageCases.status,
        createdBy: salvageCases.createdBy,
        createdAt: salvageCases.createdAt,
        approvedBy: salvageCases.approvedBy,
        approvedAt: salvageCases.approvedAt,
        adjusterName: users.fullName,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id));

    // Apply status filter if provided
    let query;
    if (status) {
      query = baseQuery
        .where(eq(salvageCases.status, status as 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled'))
        .orderBy(desc(salvageCases.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      query = baseQuery
        .orderBy(desc(salvageCases.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // Execute query
    const cases = await query;

    return NextResponse.json(
      {
        success: true,
        data: cases,
        meta: {
          limit,
          offset,
          count: cases.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/cases:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cases',
      },
      { status: 500 }
    );
  }
}
