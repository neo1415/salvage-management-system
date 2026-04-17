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

    // CRITICAL: Check for duplicate vehicle BEFORE creating case
    // This prevents fraud by detecting if the same vehicle is being submitted twice
    if (body.assetType === 'vehicle') {
      const { checkForDuplicateVehicle } = await import('@/features/fraud/services/duplicate-detection.service');
      const { logFraudAttempt } = await import('@/features/fraud/services/fraud-logging.service');
      
      console.log('🔍 Checking for duplicate vehicle...');
      const duplicateCheck = await checkForDuplicateVehicle({
        photos: body.photos,
        assetDetails: body.assetDetails,
      });
      
      if (duplicateCheck.isDuplicate) {
        console.log('🚨 DUPLICATE VEHICLE DETECTED - BLOCKING SUBMISSION');
        
        // Extract audit information for fraud logging
        const headers = request.headers;
        const ipAddress = getIpAddress(headers);
        const userAgent = headers.get('user-agent') || 'unknown';
        
        // Log fraud attempt with full details
        await logFraudAttempt({
          type: 'duplicate_vehicle_submission',
          userId: session.user.id,
          userEmail: session.user.email || 'unknown',
          userName: session.user.name || 'unknown',
          ipAddress,
          userAgent,
          attemptedData: {
            claimReference: body.claimReference,
            assetType: body.assetType,
            assetDetails: body.assetDetails,
            marketValue: body.marketValue,
            photoCount: body.photos.length,
          },
          matchedCase: duplicateCheck.matchedCase,
          confidence: duplicateCheck.confidence,
          timestamp: new Date(),
        });
        
        // Block the submission
        return NextResponse.json({
          success: false,
          error: 'Duplicate Vehicle Detected',
          message: `This vehicle appears to match an existing case (${duplicateCheck.matchedCase?.claimReference || 'unknown'}). ` +
                   `Confidence: ${Math.round(duplicateCheck.confidence * 100)}%. ` +
                   `Please contact support if this is an error.`,
          fraudAlert: true,
          matchedCaseId: duplicateCheck.matchedCase?.id,
          matchedClaimReference: duplicateCheck.matchedCase?.claimReference,
          confidence: duplicateCheck.confidence,
          reasoning: duplicateCheck.reasoning,
        }, { status: 409 }); // 409 Conflict
      }
      
      console.log('✅ No duplicate detected - proceeding with case creation');
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
      // CRITICAL: Pass AI assessment results from frontend
      aiAssessmentResult: body.aiAssessmentResult,
    };
    
    // DEBUG: Log what we're sending to createCase
    console.log('📤 Sending to createCase:', {
      claimReference: input.claimReference,
      assetType: input.assetType,
      marketValue: input.marketValue,
      marketValueType: typeof input.marketValue,
      photoCount: input.photos.length,
      hasGpsLocation: !!input.gpsLocation,
      gpsLocation: input.gpsLocation,
      hasLocationName: !!input.locationName,
      locationName: input.locationName,
      hasAiAssessment: !!input.aiAssessmentResult,
    });
    
    // DEBUG: Log what we received from frontend
    console.log('📥 Backend received AI assessment from frontend:', {
      hasAssessment: !!body.aiAssessmentResult,
      severity: body.aiAssessmentResult?.damageSeverity,
      confidence: body.aiAssessmentResult?.confidenceScore,
      salvageValue: body.aiAssessmentResult?.estimatedSalvageValue,
    });

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
    const { auctions } = await import('@/lib/db/schema/auctions');
    const { eq, desc, and, or, sql } = await import('drizzle-orm');
    const { alias } = await import('drizzle-orm/pg-core');
    const { cache } = await import('@/lib/redis/client');

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const createdByMe = searchParams.get('createdByMe') === 'true';
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // SCALABILITY: Cache key for this specific query
    // Only cache non-user-specific queries (no createdByMe filter)
    // Cache for 10 minutes to balance freshness with performance
    const shouldCache = !createdByMe;
    const cacheKey = shouldCache 
      ? `cases:list:${status}:${search}:${limit}:${offset}`
      : null;

    // Try to get from cache
    if (cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return NextResponse.json(cached);
      }
      console.log(`❌ Cache MISS: ${cacheKey}`);
    }

    // Create table aliases for adjuster and approver
    const adjusterUsers = alias(users, 'adjuster_users');
    const approverUsers = alias(users, 'approver_users');
    
    const baseQuery = db
      .select({
        id: salvageCases.id,
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        assetDetails: salvageCases.assetDetails,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        estimatedValue: salvageCases.estimatedSalvageValue,
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
        adjusterName: adjusterUsers.fullName,
        approverName: approverUsers.fullName,
        // Include auction data for real-time status checking
        auctionId: auctions.id,
        auctionStatus: auctions.status,
        auctionEndTime: auctions.endTime,
      })
      .from(salvageCases)
      .leftJoin(adjusterUsers, eq(salvageCases.createdBy, adjusterUsers.id))
      .leftJoin(approverUsers, eq(salvageCases.approvedBy, approverUsers.id))
      .leftJoin(auctions, eq(auctions.caseId, salvageCases.id));

    // Build where conditions
    const whereConditions = [];
    
    // Filter by status if provided
    if (status) {
      whereConditions.push(eq(salvageCases.status, status as 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled'));
    }
    
    // Filter by creator if requested
    if (createdByMe) {
      whereConditions.push(eq(salvageCases.createdBy, session.user.id));
    }
    
    // Search filter (claimReference, assetType, assetDetails)
    // Requirements: 7.1, 7.3
    if (search) {
      const searchLower = search.toLowerCase();
      whereConditions.push(
        or(
          sql`LOWER(${salvageCases.claimReference}) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(${salvageCases.assetType}) LIKE ${`%${searchLower}%`}`,
          // Search in JSON assetDetails fields using PostgreSQL JSON operators
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'make' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'model' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'description' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'brand' AS TEXT)) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(CAST(${salvageCases.assetDetails}->>'propertyType' AS TEXT)) LIKE ${`%${searchLower}%`}`
        )
      );
    }

    // Apply filters
    let query;
    if (whereConditions.length > 0) {
      query = baseQuery
        .where(and(...whereConditions))
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
    
    // DEBUG: Log severity values being returned
    console.log('📋 Returning cases with severities:', cases.map(c => ({ 
      id: c.id, 
      claimRef: c.claimReference,
      severity: c.damageSeverity 
    })));

    const response = {
      success: true,
      data: cases,
      meta: {
        limit,
        offset,
        count: cases.length,
      },
    };

    // SCALABILITY: Cache the response for 10 minutes (600 seconds)
    // Only cache non-user-specific queries
    if (cacheKey) {
      await cache.set(cacheKey, response, 600);
      console.log(`✅ Cached response: ${cacheKey}`);
    }

    return NextResponse.json(response, { status: 200 });
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
