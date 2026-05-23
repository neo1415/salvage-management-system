import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, or, sql, inArray, isNotNull, isNull, desc, ne, type SQL } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
import { hasProviderVerificationStorage, PROVIDER_VERIFICATION_MIGRATION_MISSING } from '@/features/kyc/services/provider-verification-readiness';

const DOJAH_TIER2_REVIEW_STATUSES = [
  'pending',
  'review_required',
  'passed',
  'failed',
  'provider_unavailable',
  'completed',
  'submitted',
  'pending_review',
  'under_review',
  'manual_review',
] as const;

type ProviderEvidenceRow = {
  vendorId: string | null;
  provider: string;
  providerReference: string | null;
  verificationType: string;
  status: string;
  riskLevel: string;
  checksCompleted: string[];
  pendingChecks: string[];
  failedChecks: string[];
  reasonCodes: string[];
  displayMessage: string | null;
  normalizedResult: Record<string, unknown> | null;
  updatedAt: Date;
};

function normalizeTierParam(tier: string | null): string | null {
  if (!tier) return null;
  if (tier === 'tier1') return 'tier1_bvn';
  if (tier === 'tier2') return 'tier2_full';
  return tier;
}

function normalizeStatusParam(status: string | null): 'pending' | 'approved' | 'rejected' | null {
  if (!status || status === 'all') return null;
  if (['pending', 'pending_review', 'review_required', 'submitted'].includes(status)) return 'pending';
  if (['approved', 'verified', 'passed'].includes(status)) return 'approved';
  if (['rejected', 'failed'].includes(status)) return 'rejected';
  return null;
}

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

    if (!user || (user.role !== 'salvage_manager' && user.role !== 'system_admin')) {
      return NextResponse.json(
        { error: 'Only Salvage Managers and System Admins can view vendor applications' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = normalizeStatusParam(searchParams.get('status'));
    const tierFilter = normalizeTierParam(searchParams.get('tier'));
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // SCALABILITY: Cache key for this specific query
    // Cache for 10 minutes to balance freshness with performance
    const cacheKey = `vendors:list:${statusFilter}:${tierFilter}:${search}:${page}:${pageSize}`;
    const bypassCache =
      statusFilter === 'pending' ||
      tierFilter === 'tier2_full' ||
      tierFilter === 'tier2' ||
      tierFilter === 'tier1_bvn' ||
      tierFilter === 'tier1' ||
      tierFilter === 'tier0';
    const cached = bypassCache ? null : await cache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return NextResponse.json(cached);
    }
    console.log(`❌ Cache MISS: ${cacheKey}`);

    const providerVerificationTableExists = await hasProviderVerificationStorage();

    if (!providerVerificationTableExists) {
      if (tierFilter === 'tier2_full' || statusFilter === 'pending') {
        return NextResponse.json(
          { error: PROVIDER_VERIFICATION_MIGRATION_MISSING },
          { status: 503 }
        );
      }
      console.warn('[Vendors API] provider_verification_records table missing; returning legacy vendor data only for non-Dojah queue.');
    }

    // Build query conditions
    const conditions: SQL<unknown>[] = [ne(users.status, 'deleted')];
    // NOTE: Do NOT filter by vendors.status here - we need to filter by Tier 2 KYC status AFTER determining it
    // The statusFilter will be applied after we calculate kycStatus based on tier2ApprovedAt/tier2RejectionReason/tier2SubmittedAt
    
    if (tierFilter) {
      // Map frontend tier values to database enum values
      const tierMap: Record<string, string> = {
        'tier0': 'tier0',
        'tier1': 'tier1_bvn',
        'tier1_bvn': 'tier1_bvn',
        'tier2': 'tier2_full',
        'tier2_full': 'tier2_full',
      };
      
      const dbTier = tierMap[tierFilter] || tierFilter;
      
      // For tier2_full filter, include legacy submissions and Dojah provider pending review
      if (dbTier === 'tier2_full') {
        const tier2Condition = or(
            eq(vendors.tier, 'tier2_full'),
            and(
              eq(vendors.tier, 'tier1_bvn'),
              sql`${vendors.tier2ApprovedAt} IS NULL`,
              sql`${vendors.tier2RejectionReason} IS NULL`,
              providerVerificationTableExists
                ? or(
                    isNotNull(vendors.tier2SubmittedAt),
                    inArray(
                      vendors.id,
                      db
                        .select({ vendorId: providerVerificationRecords.vendorId })
                        .from(providerVerificationRecords)
                        .where(
                          and(
                            eq(providerVerificationRecords.provider, 'dojah'),
                            eq(providerVerificationRecords.verificationType, 'tier2'),
                            inArray(providerVerificationRecords.status, [...DOJAH_TIER2_REVIEW_STATUSES]),
                            isNotNull(providerVerificationRecords.vendorId)
                          )
                        )
                    )
                  )
                : isNotNull(vendors.tier2SubmittedAt)
            )
        );
        if (tier2Condition) {
          conditions.push(tier2Condition);
        }
      } else if (dbTier === 'tier1_bvn') {
        // Tier 1: BVN successfully verified (bvnVerifiedAt), not yet Tier 2 approved
        const tier1Condition = and(
            isNotNull(vendors.bvnVerifiedAt),
            isNull(vendors.tier2ApprovedAt),
            ne(vendors.tier, 'tier2_full')
        );
        if (tier1Condition) {
          conditions.push(tier1Condition);
        }
      } else if (dbTier === 'tier0') {
        // Tier 0: registered vendors who have not completed BVN verification
        conditions.push(isNull(vendors.bvnVerifiedAt));
      } else {
        conditions.push(eq(vendors.tier, dbTier as 'tier0' | 'tier1_bvn' | 'tier2_full'));
      }
    }
    
    // Search filter (company name, email, phone number)
    // Requirements: 7.1, 7.4
    if (search) {
      const searchLower = search.toLowerCase();
      const searchCondition = or(
          sql`LOWER(${vendors.businessName}) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(${users.email}) LIKE ${`%${searchLower}%`}`,
          sql`LOWER(${users.phone}) LIKE ${`%${searchLower}%`}`
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
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
      .orderBy(sql`${vendors.createdAt} DESC`)
      .limit(pageSize + 1)
      .offset(offset);

    // Check if there are more items
    const hasMore = vendorsList.length > pageSize;
    const data = hasMore ? vendorsList.slice(0, pageSize) : vendorsList;
    const vendorIds = data.map((vendor) => vendor.id);

    const providerRows: ProviderEvidenceRow[] = providerVerificationTableExists && vendorIds.length
      ? await db
          .select({
            vendorId: providerVerificationRecords.vendorId,
            provider: providerVerificationRecords.provider,
            providerReference: providerVerificationRecords.providerReference,
            verificationType: providerVerificationRecords.verificationType,
            status: providerVerificationRecords.status,
            riskLevel: providerVerificationRecords.riskLevel,
            checksCompleted: providerVerificationRecords.checksCompleted,
            pendingChecks: providerVerificationRecords.pendingChecks,
            failedChecks: providerVerificationRecords.failedChecks,
            reasonCodes: providerVerificationRecords.reasonCodes,
            displayMessage: providerVerificationRecords.displayMessage,
            normalizedResult: providerVerificationRecords.normalizedResult,
            updatedAt: providerVerificationRecords.updatedAt,
          })
          .from(providerVerificationRecords)
          .where(inArray(providerVerificationRecords.vendorId, vendorIds))
          .orderBy(desc(providerVerificationRecords.updatedAt))
      : [];

    const dojahPendingVendorIdSet = new Set<string>();
    if (providerVerificationTableExists && tierFilter === 'tier2_full') {
      const dojahPendingRows = await db
        .select({ vendorId: providerVerificationRecords.vendorId })
        .from(providerVerificationRecords)
        .where(
          and(
            eq(providerVerificationRecords.provider, 'dojah'),
            eq(providerVerificationRecords.verificationType, 'tier2'),
            inArray(providerVerificationRecords.status, [...DOJAH_TIER2_REVIEW_STATUSES]),
            isNotNull(providerVerificationRecords.vendorId)
          )
        );
      for (const row of dojahPendingRows) {
        if (row.vendorId) dojahPendingVendorIdSet.add(row.vendorId);
      }
    }

    // For Tier 2 pending applications, return verification statuses from database
    const vendorsWithVerification = data.map((vendor) => {
      const latestProviderEvidence = providerRows.find((record) => record.vendorId === vendor.id);
      // Determine KYC status based on the selected tier workflow.
      let kycStatus: 'pending' | 'approved' | 'rejected' = 'pending';

      if (tierFilter === 'tier1_bvn' || tierFilter === 'tier1') {
        if (vendor.status === 'suspended') {
          kycStatus = 'rejected';
        } else if (vendor.bvnVerifiedAt) {
          kycStatus = 'approved';
        } else {
          kycStatus = 'pending';
        }
      } else if (vendor.tier2ApprovedAt || vendor.tier === 'tier2_full') {
        kycStatus = 'approved';
      } else if (vendor.tier2RejectionReason) {
        kycStatus = 'rejected';
      } else if (
        vendor.tier2SubmittedAt ||
        (dojahPendingVendorIdSet.has(vendor.id) && !vendor.tier2ApprovedAt && !vendor.tier2RejectionReason)
      ) {
        kycStatus = 'pending';
      } else if (vendor.status === 'suspended') {
        kycStatus = 'rejected';
      } else {
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
        verificationSource: latestProviderEvidence?.provider === 'dojah' ? 'dojah' : 'legacy',
        providerEvidence: latestProviderEvidence
          ? {
              provider: latestProviderEvidence.provider,
              providerReference: latestProviderEvidence.providerReference,
              verificationType: latestProviderEvidence.verificationType,
              status: latestProviderEvidence.status,
              riskLevel: latestProviderEvidence.riskLevel,
              checksCompleted: latestProviderEvidence.checksCompleted,
              pendingChecks: latestProviderEvidence.pendingChecks,
              failedChecks: latestProviderEvidence.failedChecks,
              reasonCodes: latestProviderEvidence.reasonCodes,
              displayMessage: latestProviderEvidence.displayMessage,
              normalizedResult: latestProviderEvidence.normalizedResult,
              updatedAt: latestProviderEvidence.updatedAt,
            }
          : undefined,
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

    // Keep Tier 2 review queues fresh; stale cache can hide newly submitted Dojah evidence.
    if (!bypassCache) {
      await cache.set(cacheKey, response, 600);
      console.log(`✅ Cached response: ${cacheKey}`);
    }

    return NextResponse.json(response, bypassCache ? {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    } : undefined);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
