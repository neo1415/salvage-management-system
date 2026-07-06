import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { emailService } from '@/features/notifications/services/email.service';
import { appPath } from '@/features/notifications/templates/email-urls';
import { brandLegalName, getEmailBranding, getSupportEmail } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

/**
 * Generate a secure temporary password
 */
function generateTemporaryPassword(): string {
  const words = [
    'Sunset', 'Mountain', 'River', 'Ocean', 'Forest', 'Desert', 'Valley', 'Canyon',
    'Meadow', 'Prairie', 'Island', 'Harbor', 'Summit', 'Glacier', 'Volcano', 'Lagoon',
  ];

  const specialChars = '!@#$%^&*';

  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const word3 = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];

  return `${word1}-${word2}-${word3}-${digits}${specialChar}`;
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Reset user password and send new temporary password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate new temporary password
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hash(temporaryPassword, 12);

    // Update user with new password and require password change
    await db
      .update(users)
      .set({
        passwordHash,
        requirePasswordChange: 'true',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // Send password reset email
    try {
      const branding = await getEmailBranding();
      const supportEmail = getSupportEmail(branding);
      const html = await wrapProfessionalEmail(
        'Password Reset',
        `
          <p>Hello <strong>${existingUser.fullName}</strong>,</p>
          <p>Your password has been reset by a system administrator. Below is your new temporary password:</p>
          <div style="background-color: #f8f9fa; border-left: 4px solid ${branding.primaryColor}; padding: 20px; margin: 30px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: bold;">New Temporary Password:</p>
            <code style="display: block; background-color: #ffffff; padding: 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 18px; color: ${branding.primaryColor}; text-align: center;">${temporaryPassword}</code>
          </div>
          <div style="background-color: #fff3cd; border: 1px solid ${branding.accentColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-size: 14px;"><strong>Important:</strong> You will be required to change this password on your next login.</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appPath('/login')}" style="display: inline-block; padding: 14px 32px; background-color: ${branding.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Log In Now</a>
          </div>
          <p style="font-size: 14px; color: #666666;">If you did not request this password reset, please contact support immediately at ${supportEmail}.</p>
          <p style="font-size: 12px; color: #999999;">${brandLegalName(branding)}</p>
        `,
        `Your ${branding.brandName} password has been reset.`
      );
      await emailService.sendEmail({
        to: existingUser.email,
        subject: `Password Reset - ${branding.brandName}`,
        html,
        category: 'auth',
        replyTo: supportEmail,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'password_reset_by_admin',
      entityType: 'user',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
      afterState: {
        targetUserId: id,
        targetUserEmail: existingUser.email,
        resetBy: session.user.id,
        resetAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      temporaryPassword, // Return to admin in case email fails
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
