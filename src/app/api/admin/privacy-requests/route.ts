import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { dataRightRequests, users } from '@/lib/db/schema';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

const ALLOWED_ROLES = ['system_admin', 'salvage_manager'] as const;
const VALID_STATUSES = ['submitted', 'in_review', 'completed', 'rejected', 'cancelled'] as const;
const VALID_TYPES = [
  'access',
  'export',
  'correction',
  'deactivation',
  'deletion',
  'restriction',
  'objection',
] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 100);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search')?.trim();

    const conditions = [];
    if (status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      conditions.push(eq(dataRightRequests.status, status as (typeof VALID_STATUSES)[number]));
    }
    if (type && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      conditions.push(eq(dataRightRequests.type, type as (typeof VALID_TYPES)[number]));
    }
    if (search) {
      conditions.push(
        or(
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.phone, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const offset = (page - 1) * limit;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dataRightRequests)
      .innerJoin(users, eq(dataRightRequests.userId, users.id))
      .where(whereClause);

    const requests = await db
      .select({
        id: dataRightRequests.id,
        type: dataRightRequests.type,
        status: dataRightRequests.status,
        reason: dataRightRequests.reason,
        responseNotes: dataRightRequests.responseNotes,
        requestedData: dataRightRequests.requestedData,
        resolvedAt: dataRightRequests.resolvedAt,
        createdAt: dataRightRequests.createdAt,
        updatedAt: dataRightRequests.updatedAt,
        userId: users.id,
        userName: users.fullName,
        userEmail: users.email,
        userPhone: users.phone,
        userRole: users.role,
        userStatus: users.status,
      })
      .from(dataRightRequests)
      .innerJoin(users, eq(dataRightRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(dataRightRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const totalCount = countRow?.count ?? 0;

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/privacy-requests:', error);
    return NextResponse.json({ error: 'Failed to load privacy requests' }, { status: 500 });
  }
}
