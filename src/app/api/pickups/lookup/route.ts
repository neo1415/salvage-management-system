import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { canConfirmPickup, getPickupContextByCode, redactPickupCode } from '@/features/pickups/services/pickup-confirmation.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canConfirmPickup(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const pickupAuthCode = body.pickupAuthCode;

  if (typeof pickupAuthCode !== 'string' || pickupAuthCode.trim().length < 6) {
    return NextResponse.json({ error: 'Enter a valid pickup authorization code.' }, { status: 400 });
  }

  const pickup = await getPickupContextByCode(pickupAuthCode);

  console.info('[Pickup Lookup]', {
    actorId: session.user.id,
    actorRole: session.user.role,
    code: redactPickupCode(pickupAuthCode),
    found: !!pickup,
    auctionId: pickup?.auctionId,
    status: pickup?.lifecycleStatus,
    ipAddress: getIpAddress(request.headers),
    deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
  });

  if (!pickup) {
    return NextResponse.json({ error: 'No ready pickup was found for that authorization code.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, pickup });
}
