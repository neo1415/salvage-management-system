import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { escrowService } from '@/features/payments/services/escrow.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

/**
 * GET /api/payments/wallet/transactions
 * Get wallet transaction history for authenticated vendor
 * 
 * Query Parameters:
 * - limit: Number of transactions per page (default: 10)
 * - offset: Offset for pagination (default: 0)
 * - page: Page number (alternative to offset, default: 1)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor ID from user
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10); // Changed default to 10
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = parseInt(searchParams.get('offset') || String((page - 1) * limit), 10);

    // Get wallet transactions with pagination
    const transactions = await escrowService.getTransactions(vendor.id, limit, offset);
    
    // Get total count for pagination metadata
    const allTransactions = await escrowService.getTransactions(vendor.id, 10000, 0); // Get all for count
    const total = allTransactions.length;
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return NextResponse.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        page: currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet transactions' },
      { status: 500 }
    );
  }
}
