import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { bids } from '@/lib/db/schema/bids';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Automatic Vendor Rating Service
 * 
 * Calculates vendor ratings based on performance metrics:
 * - Payment speed (30% weight)
 * - Win rate (20% weight)
 * - Bid activity (15% weight)
 * - On-time pickup (25% weight)
 * - Fraud flags (10% penalty)
 * 
 * Rating scale: 0.0 - 5.0 stars
 */



/**
 * Calculate automatic rating for a vendor based on performance metrics
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<number> - Rating from 0.0 to 5.0
 */
export async function calculateAutoRating(vendorId: string): Promise<number> {
  try {
    // Get vendor record
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return 0;
    }

    // Calculate stats directly from tables (don't use stale performanceStats field)
    
    // Get total bids
    const totalBidsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(eq(bids.vendorId, vendorId));

    const totalBids = totalBidsResult[0]?.count || 0;

    // If vendor has no activity, return 0
    if (totalBids === 0) {
      return 0;
    }

    // Get total wins
    const totalWinsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(
        and(
          eq(auctions.currentBidder, vendorId),
          eq(auctions.status, 'closed')
        )
      );

    const totalWins = totalWinsResult[0]?.count || 0;

    // Calculate win rate
    const winRate = totalBids > 0 ? (totalWins / totalBids) * 100 : 0;

    // Calculate average payment time (hours)
    const paymentTimesResult = await db
      .select({
        auctionEndTime: auctions.endTime,
        paymentVerifiedTime: payments.verifiedAt,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .where(
        and(
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'verified')
        )
      );

    let avgPaymentTimeHours = 0;
    if (paymentTimesResult.length > 0) {
      const totalPaymentTime = paymentTimesResult.reduce((sum, item) => {
        if (item.auctionEndTime && item.paymentVerifiedTime) {
          const endTime = new Date(item.auctionEndTime).getTime();
          const verifiedTime = new Date(item.paymentVerifiedTime).getTime();
          const diffHours = (verifiedTime - endTime) / (1000 * 60 * 60);
          return sum + diffHours;
        }
        return sum;
      }, 0);
      avgPaymentTimeHours = totalPaymentTime / paymentTimesResult.length;
    }

    // Calculate on-time pickup rate
    const onTimePaymentsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .where(
        and(
          eq(payments.vendorId, vendorId),
          eq(payments.status, 'verified'),
          sql`${payments.verifiedAt} <= ${auctions.endTime} + INTERVAL '48 hours'`
        )
      );

    const onTimePayments = onTimePaymentsResult[0]?.count || 0;
    const totalVerifiedPayments = paymentTimesResult.length;
    const onTimePickupRate = totalVerifiedPayments > 0 ? (onTimePayments / totalVerifiedPayments) * 100 : 100; // Default to 100% if no payments yet

    // Calculate component scores (0-5 scale)
    
    // 1. Payment Speed Score (30% weight)
    let paymentScore = 5.0;
    if (avgPaymentTimeHours > 72) {
      paymentScore = 1.0;
    } else if (avgPaymentTimeHours > 48) {
      paymentScore = 2.0;
    } else if (avgPaymentTimeHours > 24) {
      paymentScore = 3.0;
    } else if (avgPaymentTimeHours > 6) {
      paymentScore = 4.0;
    }

    // 2. Win Rate Score (20% weight)
    let winRateScore = 1.0;
    if (winRate > 50) {
      winRateScore = 5.0;
    } else if (winRate > 30) {
      winRateScore = 4.0;
    } else if (winRate > 15) {
      winRateScore = 3.0;
    } else if (winRate > 5) {
      winRateScore = 2.0;
    }

    // 3. Bid Activity Score (15% weight)
    let activityScore = 1.0;
    if (totalBids >= 50) {
      activityScore = 5.0;
    } else if (totalBids >= 20) {
      activityScore = 4.0;
    } else if (totalBids >= 10) {
      activityScore = 3.0;
    } else if (totalBids >= 5) {
      activityScore = 2.0;
    }

    // 4. On-Time Pickup Score (25% weight)
    let pickupScore = 1.0;
    if (onTimePickupRate >= 100) {
      pickupScore = 5.0;
    } else if (onTimePickupRate >= 80) {
      pickupScore = 4.0;
    } else if (onTimePickupRate >= 60) {
      pickupScore = 3.0;
    } else if (onTimePickupRate >= 40) {
      pickupScore = 2.0;
    }

    // 5. Fraud Penalty (10% weight) - default to perfect score for now
    const fraudScore = 5.0;

    // Calculate weighted average
    const totalRating = 
      (paymentScore * 0.30) +
      (winRateScore * 0.20) +
      (activityScore * 0.15) +
      (pickupScore * 0.25) +
      (fraudScore * 0.10);

    // Round to 2 decimal places
    return Math.round(totalRating * 100) / 100;
  } catch (error) {
    console.error('Error calculating auto rating:', error);
    return 0;
  }
}

/**
 * Update all vendor ratings automatically
 * 
 * This should be run periodically (e.g., daily via cron job)
 * 
 * @returns Promise<{ updated: number; errors: number }>
 */
export async function updateAllVendorRatings(): Promise<{ updated: number; errors: number }> {
  try {
    // Get all vendors
    const allVendors = await db
      .select({ id: vendors.id })
      .from(vendors);

    let updated = 0;
    let errors = 0;

    for (const vendor of allVendors) {
      try {
        const rating = await calculateAutoRating(vendor.id);
        
        await db
          .update(vendors)
          .set({
            rating: rating.toString(),
            updatedAt: new Date(),
          })
          .where(eq(vendors.id, vendor.id));

        updated++;
      } catch (error) {
        console.error(`Error updating rating for vendor ${vendor.id}:`, error);
        errors++;
      }
    }

    return { updated, errors };
  } catch (error) {
    console.error('Error updating all vendor ratings:', error);
    return { updated: 0, errors: 1 };
  }
}

/**
 * Update rating for a specific vendor
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<{ success: boolean; rating?: number; error?: string }>
 */
export async function updateVendorRating(vendorId: string): Promise<{ 
  success: boolean; 
  rating?: number; 
  error?: string 
}> {
  try {
    const rating = await calculateAutoRating(vendorId);
    
    await db
      .update(vendors)
      .set({
        rating: rating.toString(),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    return {
      success: true,
      rating,
    };
  } catch (error) {
    console.error(`Error updating rating for vendor ${vendorId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update rating',
    };
  }
}
