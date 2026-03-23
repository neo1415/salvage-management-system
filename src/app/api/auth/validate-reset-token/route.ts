import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';

/**
 * GET /api/auth/validate-reset-token
 * Validate a password reset token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Check if token exists in Redis
    const resetKey = `password_reset:${token}`;
    const tokenData = await redis.get(resetKey);

    if (!tokenData) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { valid: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Validate reset token error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}
