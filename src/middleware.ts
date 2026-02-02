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

  // Enhanced debug logging
  if (pathname.startsWith('/vendor') || pathname.startsWith('/login')) {
    const cookies = request.cookies.getAll();
    const authCookies = cookies.filter(c => 
      c.name.includes('next-auth') || c.name.includes('session') || c.name.includes('Secure')
    );
    
    console.log('[Middleware Debug]', {
      pathname,
      hasToken: !!token,
      tokenRole: token?.role,
      tokenEmail: token?.email,
      tokenExp: token?.exp,
      currentTime: Math.floor(Date.now() / 1000),
      tokenExpired: token?.exp ? token.exp < Math.floor(Date.now() / 1000) : 'no-exp',
      hasSecret: !!process.env.NEXTAUTH_SECRET,
      secretLength: process.env.NEXTAUTH_SECRET?.length,
      nextauthUrl: process.env.NEXTAUTH_URL,
      nodeEnv: process.env.NODE_ENV,
      host: request.headers.get('host'),
      authCookieNames: authCookies.map(c => c.name),
      authCookieCount: authCookies.length,
      allCookieNames: cookies.map(c => c.name),
    });
  }

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the current path is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect to login if accessing protected route without authentication
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (isAuthRoute && isAuthenticated) {
    const role = token.role as string;
    const dashboardUrl = getDashboardUrl(role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // Add security headers to all responses
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

// Helper function to get dashboard URL based on role
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'vendor':
      return '/vendor/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'adjuster':
      return '/adjuster/cases';
    case 'finance':
      return '/finance/payments';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/vendor/dashboard';
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
