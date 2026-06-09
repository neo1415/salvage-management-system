import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { confirmPickupByStaff } from '@/features/pickups/services/pickup-confirmation.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const pickup = await confirmPickupByStaff({
      pickupAuthCode: typeof body.pickupAuthCode === 'string' ? body.pickupAuthCode : undefined,
      auctionId: typeof body.auctionId === 'string' ? body.auctionId : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      actor: {
        userId: session.user.id,
        userName: session.user.name,
        role: session.user.role,
        ipAddress: getIpAddress(request.headers),
        deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      pickup,
      message: 'Pickup confirmed and transaction completed.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pickup confirmation failed.';
    const status =
      message.includes('Only salvage managers') ? 403
        : message.includes('not found') || message.includes('not ready') ? 404
          : message.includes('payment') || message.includes('authorization') ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
