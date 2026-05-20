import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, vendors } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { phoneSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updatePhoneSchema = z.object({
  phone: phoneSchema,
});

/**
 * GET /api/vendor/settings/profile
 * Fetch user profile data including KYC status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      vendor: vendor
        ? {
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
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile data' }, { status: 500 });
  }
}

/**
 * PATCH /api/vendor/settings/profile
 * Update editable profile fields (phone only for now).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updatePhoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid phone number' },
        { status: 400 }
      );
    }

    const phone = parsed.data.phone;

    const [current] = await db
      .select({ id: users.id, phone: users.phone, status: users.status })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (current.status === 'deleted' || current.status === 'suspended') {
      return NextResponse.json({ error: 'Account cannot be updated' }, { status: 403 });
    }

    if (current.phone === phone) {
      return NextResponse.json({ success: true, phone });
    }

    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, phone), ne(users.id, session.user.id), ne(users.status, 'deleted')))
      .limit(1);

    if (conflict) {
      return NextResponse.json(
        { error: 'This phone number is already registered to another account' },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, session.user.id))
      .returning({ phone: users.phone });

    return NextResponse.json({ success: true, phone: updated.phone });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
