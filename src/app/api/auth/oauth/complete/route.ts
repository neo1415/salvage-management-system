import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { oauthService } from '@/features/auth/services/oauth.service';
import { getSession } from '@/lib/auth/auth-helpers';

// Validation schema for OAuth completion
const oauthCompleteSchema = z.object({
  phone: z.string()
    .regex(/^(\+234|0)[789]\d{9}$/, 'Invalid Nigerian phone number format'),
  dateOfBirth: z.string()
    .refine((date) => {
      const dob = new Date(date);
      const age = (new Date().getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return age >= 18;
    }, 'You must be at least 18 years old'),
});

/**
 * POST /api/auth/oauth/complete
 * Complete OAuth registration by providing phone number
 */
export async function POST(request: NextRequest) {
  try {
    // Get session to verify user is authenticated via OAuth
    const session = await getSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in with OAuth first.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedInput = oauthCompleteSchema.parse(body);

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Complete OAuth registration
    const result = await oauthService.completeOAuthRegistration(
      session.user.email,
      validatedInput.phone,
      new Date(validatedInput.dateOfBirth),
      ipAddress,
      deviceType,
      userAgent
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        message: 'Registration completed successfully. Please verify your phone number.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('OAuth completion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to detect device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}
