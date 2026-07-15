import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAuthJwtParams } from '@/lib/auth/jwt-token';
import {
  CHANGE_PASSWORD_PATH,
  isVendorOnboardingApi,
  isVendorOnboardingPage,
} from '@/lib/auth/vendor-onboarding-paths';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import {
  loadVendorNavigationSnapshot,
  resolveVendorOnboardingPath,
} from '@/lib/auth/vendor-onboarding-navigation';
import {
  isApiAllowedForRole,
  isPathAllowedForRole,
  isProtectedPage,
  normalizeRole,
} from '@/lib/auth/rbac';
import { getClientIpFromHeaders, isTemporarilyBlockedIp } from '@/lib/security/request-ip';

function getManagerCaseDetailRedirect(pathname: string, role: string | undefined): string | null {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole !== 'salvage_manager' && normalizedRole !== 'system_admin') {
    return null;
  }

  const match = pathname.match(
    /^\/adjuster\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  return match ? `/manager/cases/${match[1]}` : null;
}

/**
 * Proxy: IP forwarding, vendor onboarding gates, and server-side RBAC (JWT from httpOnly cookie).
 */
export async function proxy(request: NextRequest) {
  const ipAddress = getClientIpFromHeaders(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-ip', ipAddress);

  const pathname = request.nextUrl.pathname;

  if (isTemporarilyBlockedIp(ipAddress)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

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
      const managerCaseRedirect = getManagerCaseDetailRedirect(pathname, role);
      if (managerCaseRedirect) {
        return NextResponse.redirect(new URL(managerCaseRedirect, request.url));
      }

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

  if (role === 'vendor' && token?.id) {
    const snapshot = await loadVendorNavigationSnapshot(token.id as string);
    if (snapshot) {
      const policy = await businessPolicyService.getEffectivePolicy();
      const onboardingPath = resolveVendorOnboardingPath(policy, snapshot);

      if (onboardingPath) {
        const targetBase = onboardingPath.split('?')[0];
        const onWrongOnboardingPage =
          isVendorOnboardingPage(pathname) &&
          pathname !== targetBase &&
          !pathname.startsWith(`${targetBase}/`);

        if (pathname.startsWith('/vendor/') && (!isVendorOnboardingPage(pathname) || onWrongOnboardingPage)) {
          return NextResponse.redirect(new URL(onboardingPath, request.url));
        }

        if (
          pathname === CHANGE_PASSWORD_PATH &&
          onboardingPath !== CHANGE_PASSWORD_PATH &&
          !pathname.startsWith('/api/auth')
        ) {
          return NextResponse.redirect(new URL(onboardingPath, request.url));
        }

        if (pathname.startsWith('/api/') && !isVendorOnboardingApi(pathname)) {
          return NextResponse.json(
            { error: 'Complete account setup before using this feature.' },
            { status: 403 }
          );
        }
      }
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
    '/',
    '/api/((?!auth).*)',
    '/login',
    '/register',
    '/launch',
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
    '/change-password',
  ],
};
