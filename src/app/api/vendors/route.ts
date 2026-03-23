import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and } from 'drizzle-orm';

/**
 * Vendors API - Get vendors list
 * Supports filtering by status and tier, with pagination
 * 
 * Query Parameters:
 * - status: Filter by vendor status (pending, approved, suspended)
 * - tier: Filter by vendor tier (tier1_bvn, tier2_full)
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50)
 * 
 * Requirements: 7, NFR5.3
 */

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a Salvage Manager
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Only Salvage Managers can view vendor applications' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const tierFilter = searchParams.get('tier');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Build query conditions
    const conditions = [];
    if (statusFilter) {
      conditions.push(eq(vendors.status, statusFilter as 'pending' | 'approved' | 'suspended'));
    }
    if (tierFilter) {
      conditions.push(eq(vendors.tier, tierFilter as 'tier1_bvn' | 'tier2_full'));
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Fetch vendors with user details (paginated)
    const vendorsList = await db
      .select({
        id: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        cacNumber: vendors.cacNumber,
        tin: vendors.tin,
        bankAccountNumber: vendors.bankAccountNumber,
        bankName: vendors.bankName,
        bankAccountName: vendors.bankAccountName,
        tier: vendors.tier,
        status: vendors.status,
        bvnVerifiedAt: vendors.bvnVerifiedAt,
        ninVerified: vendors.ninVerified,
        bankAccountVerified: vendors.bankAccountVerified,
        cacCertificateUrl: vendors.cacCertificateUrl,
        bankStatementUrl: vendors.bankStatementUrl,
        ninCardUrl: vendors.ninCardUrl,
        createdAt: vendors.createdAt,
        user: {
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        },
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(vendors.createdAt)
      .limit(pageSize + 1)
      .offset(offset);

    // Check if there are more items
    const hasMore = vendorsList.length > pageSize;
    const data = hasMore ? vendorsList.slice(0, pageSize) : vendorsList;

    // For Tier 2 pending applications, return verification statuses from database
    const vendorsWithVerification = data.map((vendor) => ({
      ...vendor,
      // BVN is verified if bvnVerifiedAt is set
      bvnVerified: !!vendor.bvnVerifiedAt,
      // NIN and bank account verification from database
      ninVerified: !!vendor.ninVerified,
      bankAccountVerified: !!vendor.bankAccountVerified,
      // CAC verification is manual, so it's pending for review
      cacVerified: false,
      // Document URLs from database
      cacCertificateUrl: vendor.cacCertificateUrl || '',
      bankStatementUrl: vendor.bankStatementUrl || '',
      ninCardUrl: vendor.ninCardUrl || '',
    }));

    return NextResponse.json({
      success: true,
      vendors: vendorsWithVerification,
      count: vendorsWithVerification.length,
      hasMore,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
