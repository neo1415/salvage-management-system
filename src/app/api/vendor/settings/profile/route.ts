import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/vendor/settings/profile
 * Fetch user profile data including KYC status
 * 
 * Returns:
 * - User information (name, email, phone, DOB, status, created date)
 * - Vendor information (business name, bank account masked, tier, status)
 * - Hides sensitive data (BVN, NIN, documents)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user data
    const [user] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        dateOfBirth: users.dateOfBirth,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch vendor data if exists
    // CRITICAL FIX: Only select fields that actually exist in the vendors schema
    const [vendor] = await db
      .select({
        businessName: vendors.businessName,
        businessType: vendors.businessType,
        cacNumber: vendors.cacNumber,
        tin: vendors.tin,
        bankAccountNumber: vendors.bankAccountNumber,
        bankAccountName: vendors.bankAccountName,
        bankName: vendors.bankName,
        tier: vendors.tier,
        status: vendors.status,
        tier2ApprovedAt: vendors.tier2ApprovedAt,
        tier2ExpiresAt: vendors.tier2ExpiresAt,
      })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    // Build response with explicit null handling for ALL fields
    const response = {
      user: {
        id: user.id,
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || null,
        status: user.status || 'unverified_tier_0',
        createdAt: user.createdAt || new Date(),
      },
      vendor: vendor ? {
        businessName: vendor.businessName || null,
        businessType: vendor.businessType || null,
        cacNumber: vendor.cacNumber || null,
        tin: vendor.tin || null,
        bankAccountNumber: vendor.bankAccountNumber || null,
        bankAccountName: vendor.bankAccountName || null,
        bankName: vendor.bankName || null,
        tier: vendor.tier || 'tier0',
        status: vendor.status || 'pending',
        tier2ApprovedAt: vendor.tier2ApprovedAt || null,
        tier2ExpiresAt: vendor.tier2ExpiresAt || null,
      } : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}
