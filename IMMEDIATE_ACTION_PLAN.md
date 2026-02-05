# Immediate Action Plan - Pre-Epic 13 Fixes

**Priority**: CRITICAL  
**Timeline**: 1-2 Days  
**Goal**: Fix all known issues before starting Epic 13 (Testing)

---

## 🔥 Critical Fixes (Must Do Before Testing)

### 1. Dashboard APIs (3 hours)

#### Admin Dashboard API
**File**: `src/app/api/dashboard/admin/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db/drizzle';
import { users, vendors, salvageCases, payments } from '@/lib/db/schema';
import { eq, gte, and, count, sum } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Total users
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(users);
    
    // Active vendors (Tier 1 + Tier 2)
    const [activeVendorsResult] = await db
      .select({ count: count() })
      .from(vendors)
      .where(
        and(
          eq(vendors.status, 'verified_tier_1'),
          // OR eq(vendors.status, 'verified_tier_2')
        )
      );
    
    // Total cases
    const [totalCasesResult] = await db
      .select({ count: count() })
      .from(salvageCases);
    
    // Total revenue
    const [totalRevenueResult] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, 'completed'));

    return NextResponse.json({
      totalUsers: totalUsersResult.count || 0,
      activeVendors: activeVendorsResult.count || 0,
      totalCases: totalCasesResult.count || 0,
      totalRevenue: parseFloat(totalRevenueResult.total || '0'),
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard 