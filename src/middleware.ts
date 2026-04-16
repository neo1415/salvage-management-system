import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimiter } from '@/lib/redis/client';

// SCALABILITY: Rate limiting configuration
// Increased limits for production to prevent false positives
const RATE_LIMITS = {
  general: { maxAttempts: 200, windowSeconds: 60 }, // 200 req/min for general routes
  bidding: { maxAttempts: 20, windowSeconds: 60 },  // 20 req/min for bidding (increased from 10)
  api: { maxAttempts: 200, windowSeconds: 60 },     // 200 req/min for API routes (increased from 100)
} as const;

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

  // SCALABILITY: Apply rate limiting ONLY to API routes, not page navigation
  // Page routes should not be rate limited as they're needed for normal navigation
  if (pathname.startsWith('/api')) {
    // Get client identifier (IP address or user ID if authenticated)
    // Improved IP detection for production (Vercel)
    let ip: string | null = null;
    
    // Try x-forwarded-for header (Vercel sets this)
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one (client IP)
      ip = forwardedFor.split(',')[0].trim();
    }
    
    // If still no IP, try x-real-ip header
    if (!ip) {
      ip = request.headers.get('x-real-ip');
    }
    
    // Fallback to a unique identifier to prevent all users sharing the same rate limit
    if (!ip) {
      // Use a combination of user agent and a random factor to create pseudo-unique identifier
      const userAgent = request.headers.get('user-agent') || 'unknown';
      ip = `fallback-${userAgent.slice(0, 20)}`;
    }
    
    // Determine rate limit based on route
    let rateLimit: { maxAttempts: number; windowSeconds: number };
    let rateLimitKey: string;
    
    // Stricter limits for bidding endpoints
    if (pathname.includes('/bids') || pathname.includes('/bid')) {
      rateLimit = RATE_LIMITS.bidding;
      rateLimitKey = `ratelimit:${ip}:bidding`;
    } else {
      rateLimit = RATE_LIMITS.api;
      rateLimitKey = `ratelimit:${ip}:api`;
    }
    
    // Check rate limit
    try {
      const isLimited = await rateLimiter.isLimited(
        rateLimitKey,
        rateLimit.maxAttempts,
        rateLimit.windowSeconds
      );
      
      if (isLimited) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'You have exceeded the rate limit. Please try again later.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimit.windowSeconds),
            },
          }
        );
      }
    } catch (error) {
      // If rate limiting fails, log but don't block the request
      console.error('[Middleware] Rate limiting error:', error);
    }
  }

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
  // Note: Relaxed CSP for Paystack compatibility in development
  const cspDirectives = process.env.NODE_ENV === 'production' 
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com https://widget.dojah.io",
        "style-src 'self' 'unsafe-inline' https://checkout.paystack.com https://*.paystack.com https://widget.dojah.io",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data: https://checkout.paystack.com https://*.paystack.com",
        "connect-src 'self' https://www.googleapis.com https://nominatim.openstreetmap.org https://api.paystack.co https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com https://checkout.paystack.com https://*.paystack.com https://widget.dojah.io https://api.dojah.io https://*.dojah.io",
        "frame-src 'self' https://js.paystack.co https://checkout.flutterwave.com https://www.google.com https://maps.google.com https://www.google.com/maps/embed/ https://checkout.paystack.com https://*.paystack.com https://widget.dojah.io",
        "worker-src 'self' blob:",
      ]
    : [
        // Development: More permissive CSP
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:",
        "style-src 'self' 'unsafe-inline' https: http:",
        "img-src 'self' data: https: http: blob:",
        "font-src 'self' data: https: http:",
        "connect-src 'self' https: http: ws: wss:",
        "frame-src 'self' https: http:",
        "worker-src 'self' blob:",
      ];
  
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

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
