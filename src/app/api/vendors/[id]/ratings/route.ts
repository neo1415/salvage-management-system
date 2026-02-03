import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { rateVendor, getVendorRatings } from '@/features/vendors/services/rating.service';
import { DeviceType } from '@/lib/utils/audit-logger';

/**
 * POST /api/vendors/[id]/ratings
 * 
 * Rate a vendor after pickup confirmation
 * 
 * Requirements:
 * - Requirement 37: Vendor Rating System
 * - Enterprise Standards Section 5
 * 
 * Acceptance Criteria:
 * - Validate rating is 1-5 stars
 * - Validate review is ≤500 characters
 * - Update vendor average rating
 * - Create audit log entry
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing vendor ID
 * @returns JSON response with rating result
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authenticate user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only Salvage Managers can rate vendors
    if (session.user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Only Salvage Managers can rate vendors' },
        { status: 403 }
      );
    }

    const vendorId = id;

    // Parse request body
    const body = await request.json();
    const {
      auctionId,
      overallRating,
      categoryRatings,
      review,
    } = body;

    // Validate required fields
    if (!auctionId) {
      return NextResponse.json(
        { error: 'Auction ID is required' },
        { status: 400 }
      );
    }

    if (!overallRating) {
      return NextResponse.json(
        { error: 'Overall rating is required' },
        { status: 400 }
      );
    }

    if (!categoryRatings) {
      return NextResponse.json(
        { error: 'Category ratings are required' },
        { status: 400 }
      );
    }

    // Validate rating is 1-5 stars
    if (
      typeof overallRating !== 'number' ||
      overallRating < 1 ||
      overallRating > 5 ||
      !Number.isInteger(overallRating)
    ) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5 stars' },
        { status: 400 }
      );
    }

    // Validate review length (≤500 characters)
    if (review && typeof review === 'string' && review.length > 500) {
      return NextResponse.json(
        { error: 'Review must be 500 characters or less' },
        { status: 400 }
      );
    }

    // Validate category ratings
    if (
      !categoryRatings.paymentSpeed ||
      !categoryRatings.communication ||
      !categoryRatings.pickupPunctuality
    ) {
      return NextResponse.json(
        { error: 'All category ratings are required (paymentSpeed, communication, pickupPunctuality)' },
        { status: 400 }
      );
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Determine device type from user agent
    const deviceType = userAgent.toLowerCase().includes('mobile')
      ? DeviceType.MOBILE
      : userAgent.toLowerCase().includes('tablet')
      ? DeviceType.TABLET
      : DeviceType.DESKTOP;

    // Rate the vendor
    const result = await rateVendor({
      vendorId,
      auctionId,
      ratedBy: session.user.id,
      overallRating,
      categoryRatings: {
        paymentSpeed: categoryRatings.paymentSpeed,
        communication: categoryRatings.communication,
        pickupPunctuality: categoryRatings.pickupPunctuality,
      },
      review: review || undefined,
      ipAddress,
      deviceType,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ratingId: result.ratingId,
      newAverageRating: result.newAverageRating,
      message: 'Vendor rated successfully',
    });
  } catch (error) {
    console.error('Error rating vendor:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vendors/[id]/ratings
 * 
 * Get all ratings for a vendor
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing vendor ID
 * @returns JSON response with vendor ratings
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authenticate user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const vendorId = id;

    // Get vendor ratings
    const result = await getVendorRatings(vendorId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ratings: result.ratings,
    });
  } catch (error) {
    console.error('Error fetching vendor ratings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
