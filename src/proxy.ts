import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Proxy to:
 * 1. Capture real IP addresses from requests
 * 2. Enforce BVN verification for vendors before allowing dashboard access
 *
 * Note: Uses getToken instead of auth() to avoid Edge Runtime compatibility issues.
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
  const isDashboardRoute =
    pathname.startsWith('/vendor/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/manager/') ||
    pathname.startsWith('/adjuster/') ||
    pathname.startsWith('/finance/');

  const isKycRoute = pathname.startsWith('/vendor/kyc/');
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth/');
  const isApiRoute = pathname.startsWith('/api/');

  if (isDashboardRoute && !isKycRoute && !isAuthRoute && !isApiRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    });

    if (token?.role === 'vendor' && !token.bvnVerified) {
      const url = new URL('/vendor/kyc/tier1', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
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
