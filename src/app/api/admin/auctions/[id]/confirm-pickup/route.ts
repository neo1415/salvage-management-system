import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { confirmPickupByStaff } from '@/features/pickups/services/pickup-confirmation.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: auctionId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const pickup = await confirmPickupByStaff({
      auctionId,
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
      auction: {
        id: pickup.auctionId,
        pickupConfirmedAdmin: pickup.pickupConfirmedAdmin,
        pickupConfirmedAdminAt: pickup.pickupConfirmedAdminAt,
        pickupConfirmedAdminBy: pickup.pickupConfirmedAdminBy,
      },
      message: 'Pickup confirmed successfully',
      notes: body.notes || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to confirm pickup. Please try again.';
    const status =
      message.includes('Only salvage managers') ? 403
        : message.includes('not found') ? 404
          : message.includes('payment') || message.includes('authorization') ? 400
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
