import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import {
  getTier2AutoReviewEnabled,
  setTier2AutoReviewEnabled,
} from '@/features/kyc/services/tier2-review-settings.service';
import { businessPolicyService } from '@/features/business-policy';

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
  const policy = await businessPolicyService.getEffectivePolicy();
  const automaticReviewAllowed =
    !policy.kyc.providerPassRequiresInternalReview &&
    policy.onboarding.finalTier2Decision !== 'manual_review';

  return NextResponse.json({
    automaticReviewEnabled: automaticReviewAllowed && automaticReviewEnabled,
    automaticReviewAllowed,
    disabledReason: automaticReviewAllowed
      ? null
      : 'Current verification policy requires internal manual review for Tier 2 submissions.',
    mode: automaticReviewAllowed && automaticReviewEnabled ? 'automatic' : 'manual',
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

  const policy = await businessPolicyService.getEffectivePolicy();
  const automaticReviewAllowed =
    !policy.kyc.providerPassRequiresInternalReview &&
    policy.onboarding.finalTier2Decision !== 'manual_review';

  if (body.automaticReviewEnabled && !automaticReviewAllowed) {
    return NextResponse.json(
      {
        error: 'Automatic review is disabled by the current verification policy.',
        automaticReviewAllowed: false,
        mode: 'manual',
      },
      { status: 409 }
    );
  }

  await setTier2AutoReviewEnabled({
    enabled: body.automaticReviewEnabled,
    actorId: session.user.id,
    reason: body.reason,
  });

  return NextResponse.json({
    success: true,
    automaticReviewEnabled: automaticReviewAllowed && body.automaticReviewEnabled,
    automaticReviewAllowed,
    mode: automaticReviewAllowed && body.automaticReviewEnabled ? 'automatic' : 'manual',
  });
}
