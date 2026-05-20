import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAuthJwtParams } from '@/lib/auth/jwt-token';
import {
  isVendorPreBvnApi,
  isVendorPreBvnPage,
  vendorNeedsBvnVerification,
  VENDOR_TIER1_PATH,
} from '@/lib/auth/vendor-bvn-access';
import {
  isApiAllowedForRole,
  isPathAllowedForRole,
  isProtectedPage,
} from '@/lib/auth/rbac';

/**
 * Proxy: IP forwarding, BVN onboarding, and server-side RBAC (JWT from httpOnly cookie).
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
  const token = await getToken(getAuthJwtParams(request));

  const role = token?.role as string | undefined;

  // --- Page RBAC (cannot be bypassed by tampering with client state) ---
  if (isProtectedPage(pathname)) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isPathAllowedForRole(pathname, role)) {
      const denied = new URL('/unauthorized', request.url);
      denied.searchParams.set('from', pathname);
      return NextResponse.redirect(denied);
    }
  }

  // --- API RBAC for role-scoped dashboard/admin namespaces ---
  if (pathname.startsWith('/api/') && token && !isApiAllowedForRole(pathname, role)) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for this API' },
      { status: 403 }
    );
  }

  const needsBvn = vendorNeedsBvnVerification(role, token?.bvnVerified as boolean | undefined);

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
    // Auth routes must not pass through proxy (avoids edge JWT work during sign-in/session)
    '/api/((?!auth).*)',
    '/vendor/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/adjuster/:path*',
    '/finance/:path*',
    '/bid-history/:path*',
    '/reports/:path*',
    '/notifications/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/receipt/:path*',
  ],
};
