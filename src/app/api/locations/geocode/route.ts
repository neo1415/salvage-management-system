/**
 * POST /api/locations/geocode
 * Forward-geocode an address to lat/lng (Google Geocoding API).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { geocodeAddress } from '@/lib/integrations/google-geocoding';

const ALLOWED_ROLES = [
  'claims_adjuster',
  'salvage_manager',
  'system_admin',
  'vendor',
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const address = typeof body.address === 'string' ? body.address.trim() : '';

    if (address.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Address is too short' },
        { status: 400 }
      );
    }

    const result = await geocodeAddress(address);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'No coordinates found for this address' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
        formattedAddress: result.formattedAddress,
      },
    });
  } catch (error) {
    console.error('Geocode error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Geocoding failed',
      },
      { status: 500 }
    );
  }
}
