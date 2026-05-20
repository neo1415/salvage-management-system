import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  isVendorPreBvnApi,
  isVendorPreBvnPage,
  vendorNeedsBvnVerification,
  VENDOR_TIER1_PATH,
} from '@/lib/auth/vendor-bvn-access';

/**
 * Proxy: IP forwarding + mandatory BVN onboarding for vendors.
 */
export async function proxy(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  const ipAddress =
    cfConnectingIp ||
    (forwarded ? forwarded.split(',')[0].trim() : null) ||
    realIp ||
    'unknown';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-ip', ipAddress);

  const pathname = request.nextUrl.pathname;
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  const needsBvn = vendorNeedsBvnVerification(
    token?.role as string | undefined,
    token?.bvnVerified as boolean | undefined
  );

  if (needsBvn) {
    if (pathname.startsWith('/vendor/') && !isVendorPreBvnPage(pathname)) {
      const url = new URL(VENDOR_TIER1_PATH, request.url);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/api/') && !isVendorPreBvnApi(pathname)) {
      return NextResponse.json(
        { error: 'Identity verification required. Complete BVN verification to continue.' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/api/:path*',
    '/vendor/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/adjuster/:path*',
    '/finance/:path*',
  ],
};
