import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role: session.user.role ?? null,
      status: session.user.status ?? null,
      phone: session.user.phone ?? null,
      vendorId: session.user.vendorId ?? null,
      bvnVerified: Boolean(session.user.bvnVerified),
      profilePictureUrl: session.user.profilePictureUrl ?? null,
      requirePasswordChange: Boolean(session.user.requirePasswordChange),
      needsPhoneNumber: Boolean(session.user.needsPhoneNumber),
    },
  });
}
