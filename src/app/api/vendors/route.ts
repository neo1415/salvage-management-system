import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, or, sql } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

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
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // SCALABILITY: Cache key for this specific query
    // Cache for 10 minutes to balance freshness with performance
    const cacheKey = `vendors:list:${statusFilter}:${tierFilter}:${search}:${page}:${pageSize}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return NextResponse.json(cached);
    }
    console.log(`❌ Cache MISS: ${cacheKey}`);

    // Build query conditions
    const conditions = [];
    // NOTE: Do NOT filter by vendors.status here - we need to filter by Tier 2 KYC status AFTER determining it
    // The statusFilter will be applied after we calculate kycStatus based on tier2ApprovedAt/tier2RejectionReason/tier2SubmittedAt
    
    if (tierFilter) {
      // Map frontend tier values to database enum values
      const tierMap: Record<string, string> = {
        'tier0': 'tier0',
        'tier1_bvn': 'tier1_bvn',
        'tier2_full': 'tier2_full',
      };
      
      const dbTier = tierMap[tierFilter] || tierFilter;
      
      // For tier2_full filter, also include vendors with pending tier2 submissions
      if (dbTier === 'tier2_full') {
        conditions.push(
          or(
            eq(vendors.tier, 'tier2_full'),
            and(
              eq(vendors.tier, 'tier1_bvn'),
              sql`${vendors.tier2SubmittedAt} IS NOT NULL`,
              sql`${vendors.tier2ApprovedAt} IS NULL`,
              sql`${vendors.tier2RejectionReason} IS NULL`
            )
          )
        );
      } else {
        conditions.push(eq(vendors.tier, dbTier as 'tier0' | 'tier1_bvn' | 'tier2_full'));
      }
    }
    
    // Search filter (company name, email, phone number)
    // Requirements: 7.1, 7.4
    if (search) {
      const searchLower = search.toLowerCase();
      conditions.push(
        or(
          sql`LOWER(${vendors.businessName}) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(${users.email}) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(${users.phone}) LIKE ${`%${searchLower}%`}`
        )
      );
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
        photoIdUrl: vendors.photoIdUrl,
        addressProofUrl: vendors.addressProofUrl,
        tier2SubmittedAt: vendors.tier2SubmittedAt,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2RejectionReason: vendors.tier2RejectionReason,
        ninVerificationData: vendors.ninVerificationData,
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
    const vendorsWithVerification = data.map((vendor) => {
      // Determine KYC status based on Tier 2 approval workflow
      // CRITICAL: Status should be based on tier2ApprovedAt/tier2RejectionReason, NOT vendor.status or vendor.tier
      let kycStatus: 'pending' | 'approved' | 'rejected' = 'pending';
      
      // Check Tier 2 specific approval status
      if (vendor.tier2ApprovedAt) {
        // Has been approved for Tier 2
        kycStatus = 'approved';
      } else if (vendor.tier2RejectionReason) {
        // Has been rejected for Tier 2
        kycStatus = 'rejected';
      } else if (vendor.tier2SubmittedAt) {
        // Has submitted Tier 2 but not yet approved or rejected = pending
        kycStatus = 'pending';
      } else if (vendor.status === 'suspended') {
        // Account suspended
        kycStatus = 'rejected';
      } else {
        // No Tier 2 submission yet - default to pending
        kycStatus = 'pending';
      }

      return {
        ...vendor,
        // KYC status and rejection reason
        kycStatus,
        kycRejectionReason: vendor.tier2RejectionReason || undefined,
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
        photoIdUrl: vendor.photoIdUrl || '',
        addressProofUrl: vendor.addressProofUrl || '',
        // Tier 2 submission status
        tier2SubmittedAt: vendor.tier2SubmittedAt,
        tier2ApprovedAt: vendor.tier2ApprovedAt,
        tier2RejectionReason: vendor.tier2RejectionReason,
        // AI verification data for manual KYC
        ninVerificationData: vendor.ninVerificationData,
      };
    });

    // CRITICAL: Apply status filter AFTER calculating kycStatus
    const filteredVendors = statusFilter 
      ? vendorsWithVerification.filter(v => v.kycStatus === statusFilter)
      : vendorsWithVerification;

    const response = {
      success: true,
      vendors: filteredVendors,
      count: filteredVendors.length,
      hasMore,
      page,
      pageSize,
    };

    // SCALABILITY: Cache the response for 10 minutes (600 seconds)
    await cache.set(cacheKey, response, 600);
    console.log(`✅ Cached response: ${cacheKey}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
