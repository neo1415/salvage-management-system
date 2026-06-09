import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { confirmPickupByVendor } from '@/features/pickups/services/pickup-confirmation.service';
import { getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

interface ConfirmPickupRequest {
  vendorId: string;
  pickupAuthCode: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: auctionId } = await params;
    const body: ConfirmPickupRequest = await request.json();
    const { vendorId, pickupAuthCode } = body;

    if (!vendorId || !pickupAuthCode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: vendorId and pickupAuthCode' },
        { status: 400 }
      );
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor || vendor.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the auction winner can confirm pickup' },
        { status: 403 }
      );
    }

    const pickup = await confirmPickupByVendor({
      auctionId,
      vendorId,
      pickupAuthCode,
      actor: {
        userId: vendor.userId,
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
        pickupConfirmedVendor: pickup.pickupConfirmedVendor,
        pickupConfirmedVendorAt: pickup.pickupConfirmedVendorAt || '',
      },
      message: 'Pickup confirmed successfully. Staff will verify the handoff shortly.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to confirm pickup';
    const status =
      message.includes('Only the auction winner') ? 403
        : message.includes('already') || message.includes('Invalid') || message.includes('not generated') ? 400
          : message.includes('not found') ? 404
            : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
