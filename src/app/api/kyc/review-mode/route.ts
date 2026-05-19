import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import {
  getTier2AutoReviewEnabled,
  setTier2AutoReviewEnabled,
} from '@/features/kyc/services/tier2-review-settings.service';

const READ_ROLES = new Set(['salvage_manager', 'system_admin']);
const WRITE_ROLES = new Set(['salvage_manager']);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!READ_ROLES.has(session.user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const automaticReviewEnabled = await getTier2AutoReviewEnabled();
  return NextResponse.json({
    automaticReviewEnabled,
    mode: automaticReviewEnabled ? 'automatic' : 'manual',
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!WRITE_ROLES.has(session.user.role || '')) {
    return NextResponse.json(
      { error: 'Only Salvage Managers can change Tier 2 review mode' },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (typeof body?.automaticReviewEnabled !== 'boolean') {
    return NextResponse.json({ error: 'automaticReviewEnabled must be a boolean' }, { status: 400 });
  }

  await setTier2AutoReviewEnabled({
    enabled: body.automaticReviewEnabled,
    actorId: session.user.id,
    reason: body.reason,
  });

  return NextResponse.json({
    success: true,
    automaticReviewEnabled: body.automaticReviewEnabled,
    mode: body.automaticReviewEnabled ? 'automatic' : 'manual',
  });
}
