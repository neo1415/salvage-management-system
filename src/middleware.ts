import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware to:
 * 1. Capture real IP addresses from requests
 * 2. Enforce BVN verification for vendors before allowing dashboard access
 * 
 * Note: Uses getToken instead of auth() to avoid Edge Runtime compatibility issues
 */
export async function middleware(request: NextRequest) {
  // Get real IP address (handles proxies, load balancers, Cloudflare)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  // Priority: Cloudflare > x-forwarded-for (first IP) > x-real-ip > fallback
  const ipAddress = cfConnectingIp || 
                    (forwarded ? forwarded.split(',')[0].trim() : null) || 
                    realIp || 
                    'unknown';
  
  // Add to request headers for use in API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-ip', ipAddress);
  
  // Check if this is a dashboard route (excluding KYC and auth routes)
  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith('/vendor/') || 
                          pathname.startsWith('/admin/') || 
                          pathname.startsWith('/manager/') ||
                          pathname.startsWith('/adjuster/') ||
                          pathname.startsWith('/finance/');
  
  // Allow access to KYC routes, auth routes, and API routes without BVN check
  const isKycRoute = pathname.startsWith('/vendor/kyc/');
  const isAuthRoute = pathname.startsWith('/login') || 
                     pathname.startsWith('/register') || 
                     pathname.startsWith('/auth/');
  const isApiRoute = pathname.startsWith('/api/');
  
  // Only check BVN verification for dashboard routes (excluding KYC and auth)
  if (isDashboardRoute && !isKycRoute && !isAuthRoute && !isApiRoute) {
    // Get token directly (Edge Runtime compatible)
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    // If user is authenticated and is a vendor
    if (token?.role === 'vendor') {
      // Check if BVN is verified
      const bvnVerified = token.bvnVerified;
      
      if (!bvnVerified) {
        // Redirect to BVN verification page
        const url = new URL('/vendor/kyc/tier1', request.url);
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
      }
    }
  }
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Apply middleware to dashboard routes and API routes
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
