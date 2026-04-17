import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to capture real IP addresses from requests
 * Handles proxies, load balancers, and Cloudflare
 */
export function middleware(request: NextRequest) {
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
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Apply middleware to all API routes
export const config = {
  matcher: '/api/:path*',
};
