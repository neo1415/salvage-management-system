import crypto from 'crypto';

/**
 * Generate a device fingerprint from browser characteristics
 * Used for tracking users across sessions for fraud detection
 */
export function generateDeviceFingerprint(request: {
  headers: Headers;
}): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const accept = request.headers.get('accept') || '';
  
  // Create a hash of browser characteristics
  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${accept}`;
  
  return crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .substring(0, 64); // Limit to 64 characters
}

/**
 * Get real IP address from request headers
 * Handles proxies, load balancers, and Cloudflare
 */
export function getRealIPAddress(request: {
  headers: Headers;
}): string {
  // Check middleware-added header first
  const middlewareIp = request.headers.get('x-user-ip');
  if (middlewareIp && middlewareIp !== 'unknown') {
    return middlewareIp;
  }
  
  // Fallback to manual extraction
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || 
         (forwarded ? forwarded.split(',')[0].trim() : null) || 
         realIp || 
         'unknown';
}
