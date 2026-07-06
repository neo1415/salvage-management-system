import { NextResponse } from 'next/server';

/** @deprecated Use /api/settings/profile */
export async function GET() {
  const { GET: getShared } = await import('@/app/api/settings/profile/route');
  return getShared();
}

/** @deprecated Use /api/settings/profile/phone/request and .../verify */
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        'Phone updates require verification. Use Settings → Profile and the Send code flow.',
    },
    { status: 400 }
  );
}
