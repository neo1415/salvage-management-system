import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';

const CLAIMS_ADJUSTER_OFFLINE_TTL_MS = 72 * 60 * 60 * 1000;

export async function GET() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'claims_adjuster') {
    return NextResponse.json({ data: null }, { status: 403 });
  }

  return NextResponse.json({
    data: {
      userId: session.user.id,
      role: session.user.role,
      fullName: session.user.name || session.user.email || 'Claims adjuster',
      expiresAt: new Date(Date.now() + CLAIMS_ADJUSTER_OFFLINE_TTL_MS).toISOString(),
    },
  });
}

