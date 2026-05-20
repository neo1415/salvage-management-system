import type { NextRequest } from 'next/server';
import type { GetTokenParams } from 'next-auth/jwt';

/**
 * Auth.js v5 uses __Secure-* session cookies in production (HTTPS).
 * getToken() must set secureCookie or the proxy treats users as logged out.
 */
export function getAuthJwtParams(req: NextRequest): GetTokenParams<false> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const useSecureCookie =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXTAUTH_URL?.startsWith('https://') === true ||
    process.env.AUTH_URL?.startsWith('https://') === true ||
    process.env.VERCEL === '1';

  return {
    req,
    secret,
    secureCookie: useSecureCookie,
  };
}
