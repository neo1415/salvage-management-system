import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getDashboardPathForRole } from '@/lib/auth/rbac';
import {
  vendorNeedsBvnVerification,
  VENDOR_TIER1_PATH,
} from '@/lib/auth/vendor-bvn-access';

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

  const callback = resolveSafeCallback(
    request.nextUrl.searchParams.get('callbackUrl')
  );
  if (callback) {
    return NextResponse.redirect(new URL(callback, request.url));
  }

  const { role, bvnVerified } = session.user;
  if (vendorNeedsBvnVerification(role, bvnVerified)) {
    return NextResponse.redirect(new URL(VENDOR_TIER1_PATH, request.url));
  }

  const home = getDashboardPathForRole(role);
  if (home === '/login') {
    loginUrl.searchParams.set('error', 'UnknownRole');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(home, request.url));
}
