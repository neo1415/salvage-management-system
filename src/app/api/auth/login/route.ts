import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/lib/auth/next-auth.config';

/**
 * POST /api/auth/login
 * Login with email/phone and password
 * 
 * This endpoint handles credential-based login with:
 * - Email OR phone number support
 * - Password verification
 * - Account lockout after 5 failed attempts (30-minute cooldown)
 * - Audit logging with IP address and device type
 * - Device-specific JWT expiry (24h desktop, 2h mobile)
 * - Session storage in Redis
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { emailOrPhone, password } = body;

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { error: 'Email/Phone and password are required' },
        { status: 400 }
      );
    }

    // Get IP address and user agent
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Attempt sign in with NextAuth
    // Note: signIn with redirect: false in server-side context doesn't work as expected
    // We need to use the authorize function directly or handle this differently
    try {
      await signIn('credentials', {
        emailOrPhone,
        password,
        ipAddress,
        userAgent,
        redirect: false,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Login successful',
        },
        { status: 200 }
      );
    } catch (authError: unknown) {
      // Handle authentication errors
      console.error('Authentication error:', authError);
      
      if (authError instanceof Error) {
        return NextResponse.json(
          { error: authError.message },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
  } catch (error: unknown) {
    console.error('Login API error:', error);

    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
