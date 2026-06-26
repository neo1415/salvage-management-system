import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { cache } from '@/lib/redis/client';
import {
  parseFinancePaymentFilters,
  financeFilterCacheSuffix,
} from '@/lib/finance/payment-case-filters';
import { calculateFinanceDashboardStats } from '@/lib/finance/finance-dashboard-stats';
import { fetchFinanceFilterOptions } from '@/lib/finance/finance-filter-options';

/**
 * Finance Dashboard API
 *
 * GET /api/dashboard/finance
 *
 * Query: dateFrom, dateTo, branch, broker, insuranceClass
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Finance Officer access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bypassCache = searchParams.get('bypass') === 'true';
    const filters = parseFinancePaymentFilters(searchParams);
    const filterSuffix = financeFilterCacheSuffix(filters);
    const hasFilters = filterSuffix.replace(/\|/g, '').length > 0;

    const cacheKey = `dashboard:finance:v4:${filterSuffix}`;
    if (!bypassCache && !hasFilters) {
      const cachedData = await cache.get<Awaited<ReturnType<typeof calculateFinanceDashboardStats>>>(cacheKey);
      if (cachedData) {
        const filterOptions = await fetchFinanceFilterOptions();
        return NextResponse.json({ ...cachedData, filterOptions, appliedFilters: filters });
      }
    }

    const stats = await calculateFinanceDashboardStats(filters);
    const filterOptions = await fetchFinanceFilterOptions();

    if (!hasFilters) {
      await cache.set(cacheKey, stats, 300);
    }

    return NextResponse.json({ ...stats, filterOptions, appliedFilters: filters });
  } catch (error) {
    console.error('Finance dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
