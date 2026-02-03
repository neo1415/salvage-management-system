import { db } from '@/lib/db/drizzle';
import { ratings } from '@/lib/db/schema/ratings';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, sql } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

/**
 * Category ratings for vendor performance
 */
export interface CategoryRatings {
  paymentSpeed: number; // 1-5 stars
  communication: number; // 1-5 stars
  pickupPunctuality: number; // 1-5 stars
}

/**
 * Input data for rating a vendor
 */
export interface RateVendorInput {
  vendorId: string;
  auctionId: string;
  ratedBy: string;
  overallRating: number; // 1-5 stars
  categoryRatings: CategoryRatings;
  review?: string; // Optional text review (max 500 characters)
  ipAddress: string;
  deviceType: DeviceType;
  userAgent: string;
}

/**
 * Result of rating a vendor
 */
export interface RateVendorResult {
  success: boolean;
  ratingId?: string;
  newAverageRating?: number;
  error?: string;
}

/**
 * Rate a vendor after pickup confirmation
 * 
 * This function:
 * - Validates the rating (1-5 stars)
 * - Validates the review length (max 500 characters)
 * - Prevents rating the same transaction twice
 * - Creates a rating record
 * - Calculates and updates the vendor's average rating
 * - Creates an audit log entry
 * 
 * @param input - Rating input data
 * @returns Promise<RateVendorResult>
 * 
 * @example
 * ```typescript
 * const result = await rateVendor({
 *   vendorId: 'vendor-123',
 *   auctionId: 'auction-456',
 *   ratedBy: 'manager-789',
 *   overallRating: 5,
 *   categoryRatings: {
 *     paymentSpeed: 5,
 *     communication: 4,
 *     pickupPunctuality: 5,
 *   },
 *   review: 'Excellent vendor, very professional',
 *   ipAddress: '192.168.1.1',
 *   deviceType: DeviceType.MOBILE,
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */
export async function rateVendor(input: RateVendorInput): Promise<RateVendorResult> {
  try {
    // Validate overall rating (1-5 stars)
    if (input.overallRating < 1 || input.overallRating > 5 || !Number.isInteger(input.overallRating)) {
      return {
        success: false,
        error: 'Overall rating must be an integer between 1 and 5 stars',
      };
    }

    // Validate category ratings (1-5 stars each)
    const { paymentSpeed, communication, pickupPunctuality } = input.categoryRatings;
    
    if (
      paymentSpeed < 1 || paymentSpeed > 5 || !Number.isInteger(paymentSpeed) ||
      communication < 1 || communication > 5 || !Number.isInteger(communication) ||
      pickupPunctuality < 1 || pickupPunctuality > 5 || !Number.isInteger(pickupPunctuality)
    ) {
      return {
        success: false,
        error: 'All category ratings must be integers between 1 and 5 stars',
      };
    }

    // Validate review length (max 500 characters)
    if (input.review && input.review.length > 500) {
      return {
        success: false,
        error: 'Review must be 500 characters or less',
      };
    }

    // Check if this auction has already been rated
    const existingRating = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.auctionId, input.auctionId),
          eq(ratings.vendorId, input.vendorId)
        )
      )
      .limit(1);

    if (existingRating.length > 0) {
      return {
        success: false,
        error: 'This transaction has already been rated',
      };
    }

    // Create rating record
    const [newRating] = await db
      .insert(ratings)
      .values({
        vendorId: input.vendorId,
        auctionId: input.auctionId,
        ratedBy: input.ratedBy,
        overallRating: input.overallRating,
        categoryRatings: input.categoryRatings,
        review: input.review || null,
      })
      .returning();

    // Calculate new average rating for vendor
    const avgResult = await db
      .select({
        avgRating: sql<number>`AVG(${ratings.overallRating})::numeric(3,2)`,
      })
      .from(ratings)
      .where(eq(ratings.vendorId, input.vendorId));

    const newAverageRating = avgResult[0]?.avgRating || 0;

    // Update vendor's average rating
    await db
      .update(vendors)
      .set({
        rating: newAverageRating.toString(),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, input.vendorId));

    // Create audit log entry
    await logAction({
      userId: input.ratedBy,
      actionType: AuditActionType.VENDOR_RATED,
      entityType: AuditEntityType.RATING,
      entityId: newRating.id,
      ipAddress: input.ipAddress,
      deviceType: input.deviceType,
      userAgent: input.userAgent,
      afterState: {
        vendorId: input.vendorId,
        auctionId: input.auctionId,
        overallRating: input.overallRating,
        categoryRatings: input.categoryRatings,
        newAverageRating: parseFloat(newAverageRating.toString()),
      },
    });

    return {
      success: true,
      ratingId: newRating.id,
      newAverageRating: parseFloat(newAverageRating.toString()),
    };
  } catch (error) {
    console.error('Error rating vendor:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rate vendor',
    };
  }
}

/**
 * Get vendor ratings
 * 
 * @param vendorId - Vendor ID
 * @returns Promise with ratings array
 */
export async function getVendorRatings(vendorId: string) {
  try {
    const vendorRatings = await db
      .select()
      .from(ratings)
      .where(eq(ratings.vendorId, vendorId))
      .orderBy(sql`${ratings.createdAt} DESC`);

    return {
      success: true,
      ratings: vendorRatings,
    };
  } catch (error) {
    console.error('Error fetching vendor ratings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch ratings',
      ratings: [],
    };
  }
}

/**
 * Get average rating for a vendor
 * 
 * @param vendorId - Vendor ID
 * @returns Promise with average rating
 */
export async function getVendorAverageRating(vendorId: string) {
  try {
    const avgResult = await db
      .select({
        avgRating: sql<number>`AVG(${ratings.overallRating})::numeric(3,2)`,
        totalRatings: sql<number>`COUNT(*)::integer`,
      })
      .from(ratings)
      .where(eq(ratings.vendorId, vendorId));

    const avgRating = avgResult[0]?.avgRating || 0;
    const totalRatings = avgResult[0]?.totalRatings || 0;

    return {
      success: true,
      averageRating: parseFloat(avgRating.toString()),
      totalRatings,
    };
  } catch (error) {
    console.error('Error calculating average rating:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate average rating',
      averageRating: 0,
      totalRatings: 0,
    };
  }
}
