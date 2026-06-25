import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getDashboardPathForRole } from '@/lib/auth/rbac';
import {
  CHANGE_PASSWORD_PATH,
  resolveVendorOnboardingRedirectForUser,
} from '@/lib/auth/vendor-onboarding-navigation';

const BLOCKED_CALLBACK_PATHS = new Set(['/', '/login', '/launch', '/register']);

function resolveSafeCallback(pathname: string | null): string | null {
  if (!pathname) return null;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return null;
  const base = pathname.split('?')[0];
  if (BLOCKED_CALLBACK_PATHS.has(base)) return null;
  return pathname;
}

/**
 * Server redirect after credentials sign-in (cookie is set before this runs).
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const loginUrl = new URL('/login', request.url);

  if (!session?.user) {
    loginUrl.searchParams.set('error', 'SessionRequired');
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.requirePasswordChange) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  if (session.user.role === 'vendor') {
    const vendorPath = await resolveVendorOnboardingRedirectForUser(session.user.id);
    if (vendorPath) {
      return NextResponse.redirect(new URL(vendorPath, request.url));
    }
  }

  const callback = resolveSafeCallback(
    request.nextUrl.searchParams.get('callbackUrl')
  );
  if (callback && callback !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(callback, request.url));
  }

  const home = getDashboardPathForRole(session.user.role);
  if (home === '/login') {
    loginUrl.searchParams.set('error', 'UnknownRole');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(home, request.url));
}
