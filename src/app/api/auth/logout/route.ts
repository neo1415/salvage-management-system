import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis/client';
import { getToken } from 'next-auth/jwt';

/**
 * Manual logout endpoint
 * Clears session from Redis and browser cookies
 * 
 * NOTE: For client-side logout, prefer using signOut() from next-auth/react
 * This endpoint is for server-side or API-based logout scenarios
 */
export async function POST(request: NextRequest) {
  try {
    // Get token to find user ID
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Clear session from Redis if user ID exists
    if (token?.id) {
      const sessionKey = `session:${token.id}`;
      await redis.del(sessionKey);
    }

    // Clear all Auth.js (NextAuth v5) cookies
    const cookieStore = await cookies();
    const cookieNames = [
      // Auth.js v5 cookie names
      'authjs.session-token',
      '__Secure-authjs.session-token',
      'authjs.csrf-token',
      '__Host-authjs.csrf-token',
      'authjs.callback-url',
      '__Secure-authjs.callback-url',
      // Legacy NextAuth v4 names (for backwards compatibility)
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
    ];

    cookieNames.forEach((name) => {
      cookieStore.delete(name);
    });

    // Create response with redirect to login
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully',
      redirect: '/login'
    });

    // Also set cookies to expire in the response
    cookieNames.forEach((name) => {
      response.cookies.set(name, '', {
        expires: new Date(0),
        path: '/',
      });
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
