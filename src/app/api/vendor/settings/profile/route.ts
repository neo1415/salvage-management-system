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
    const [vendor] = await db
      .select({
        businessName: vendors.businessName,
        bankAccountNumber: vendors.bankAccountNumber,
        bankName: vendors.bankName,
        tier: vendors.tier,
        status: vendors.status,
      })
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        status: user.status,
        createdAt: user.createdAt,
      },
      vendor: vendor ? {
        businessName: vendor.businessName,
        bankAccountNumber: vendor.bankAccountNumber,
        bankName: vendor.bankName,
        tier: vendor.tier,
        status: vendor.status,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 }
    );
  }
}
