import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis/client';
import { getToken } from 'next-auth/jwt';

/**
 * Manual logout endpoint
 * Clears session from Redis and browser cookies
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

    // Clear all NextAuth cookies
    const cookieStore = await cookies();
    const cookieNames = [
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

    return NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
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
