import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, payments, salvageCases } from '@/lib/db/schema';
import { pickupEvidence } from '@/lib/db/schema/pickup-evidence';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, desc, gte, exists, sql, isNotNull } from 'drizzle-orm';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT)))
    );
    const period = request.nextUrl.searchParams.get('period') || 'all';
    const periodStart =
      period === '30d'
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : period === '90d'
          ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          : null;

    const evidenceExists = exists(
      db
        .select({ id: pickupEvidence.id })
        .from(pickupEvidence)
        .where(
          and(
            eq(pickupEvidence.auctionId, auctions.id),
            eq(pickupEvidence.vendorId, vendor.id)
          )
        )
    );

    const whereClause = and(
      eq(auctions.currentBidder, vendor.id),
      eq(auctions.pickupConfirmedAdmin, true),
      isNotNull(auctions.pickupConfirmedAdminAt),
      evidenceExists,
      periodStart ? gte(auctions.pickupConfirmedAdminAt, periodStart) : undefined
    );

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .innerJoin(payments, and(
        eq(payments.auctionId, auctions.id),
        eq(payments.vendorId, vendor.id),
        eq(payments.status, 'verified')
      ))
      .where(whereClause);

    const total = Number(countRow?.count || 0);
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        auctionId: auctions.id,
        pickupConfirmedAt: auctions.pickupConfirmedAdminAt,
        pickupConfirmedVendor: auctions.pickupConfirmedVendor,
        pickupConfirmedAdmin: auctions.pickupConfirmedAdmin,
        case: {
          claimReference: salvageCases.claimReference,
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
        },
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(payments, and(
        eq(payments.auctionId, auctions.id),
        eq(payments.vendorId, vendor.id),
        eq(payments.status, 'verified')
      ))
      .where(whereClause)
      .orderBy(desc(auctions.pickupConfirmedAdminAt))
      .limit(limit)
      .offset(offset);

    const pickups = rows.map((row) => ({
      auctionId: row.auctionId,
      pickupConfirmedAt: row.pickupConfirmedAt?.toISOString() ?? null,
      pickupConfirmedVendor: row.pickupConfirmedVendor ?? false,
      pickupConfirmedAdmin: row.pickupConfirmedAdmin ?? false,
      case: row.case,
    }));

    return NextResponse.json({
      pickups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      period,
    });
  } catch (error) {
    console.error('Failed to fetch completed pickups:', error);
    return NextResponse.json({ error: 'Failed to fetch pickup history' }, { status: 500 });
  }
}
