import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that require authentication
const protectedRoutes = [
  '/vendor',
  '/manager',
  '/adjuster',
  '/finance',
  '/admin',
];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the token from the request
  // For NextAuth v5, getToken automatically handles __Secure- prefix in production
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  const isAuthenticated = !!token;

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the current path is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Debug logging only for auth-related issues (can be removed in production)
  if (process.env.NODE_ENV === 'development' && !isAuthenticated && isProtectedRoute) {
    console.log('[Middleware] Unauthenticated access to protected route:', pathname);
  }

  // Check if user needs to change password (force password change)
  if (isAuthenticated && token.requirePasswordChange && pathname !== '/change-password') {
    console.log('[Middleware] User requires password change, redirecting to /change-password');
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // Redirect authenticated users from root to their dashboard
  if (pathname === '/' && isAuthenticated) {
    const role = token.role as string;
    const dashboardUrl = getDashboardUrl(role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // Redirect to login if accessing protected route without authentication
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (isAuthRoute && isAuthenticated) {
    // Check if session cookie actually exists to prevent redirect loops during logout
    const sessionCookie = request.cookies.get('authjs.session-token') || 
                          request.cookies.get('__Secure-authjs.session-token');
    
    // Only redirect if we have a valid session cookie
    // This prevents redirect loops when cookies are being cleared
    if (sessionCookie) {
      const role = token.role as string;
      const dashboardUrl = getDashboardUrl(role);
      
      // Avoid redirect loop by checking if we're already being redirected
      const url = new URL(dashboardUrl, request.url);
      if (url.pathname !== pathname) {
        return NextResponse.redirect(url);
      }
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self)'
  );
  
  // Content Security Policy - allow necessary external services
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.googleapis.com https://nominatim.openstreetmap.org https://api.paystack.co https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com",
      "frame-src 'self' https://js.paystack.co https://checkout.flutterwave.com",
      "worker-src 'self' blob:",
    ].join('; ')
  );

  return response;
}

// Helper function to get dashboard URL based on role
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'vendor':
      return '/vendor/dashboard';
    case 'salvage_manager':
      return '/manager/dashboard';
    case 'claims_adjuster':
      return '/adjuster/dashboard';
    case 'finance_officer':
      return '/finance/dashboard';
    case 'system_admin':
    case 'admin': // Support both 'system_admin' and 'admin' role names
      return '/admin/dashboard';
    default:
      // Log unexpected role for debugging
      console.warn(`[Middleware] Unexpected role: ${role}, defaulting to /login`);
      return '/login';
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|assets|manifest.json|sw.js|offline.html).*)',
  ],
};
