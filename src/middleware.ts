import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Protected routes that require authentication
const protectedRoutes = [
  '/vendor',
  '/adjuster',
  '/manager',
  '/finance',
  '/admin',
];

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/verify-otp',
];

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // Get token from request
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect to login if accessing protected route without authentication
  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing public auth routes while authenticated
  // Only redirect if token exists AND user is not on verify-otp page
  if (isPublicRoute && token && (pathname === '/login' || pathname === '/register') && pathname !== '/verify-otp') {
    // Redirect based on user role
    const role = token.role as string;
    let dashboardUrl = '/vendor/dashboard';

    if (role === 'claims_adjuster') {
      dashboardUrl = '/adjuster/cases';
    } else if (role === 'salvage_manager') {
      dashboardUrl = '/manager/dashboard';
    } else if (role === 'finance_officer') {
      dashboardUrl = '/finance/dashboard';
    } else if (role === 'system_admin') {
      dashboardUrl = '/admin/users';
    }

    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  );

  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
