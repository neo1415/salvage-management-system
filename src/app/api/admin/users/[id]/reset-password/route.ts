import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { emailService } from '@/features/notifications/services/email.service';

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
    const [updatedUser] = await db
      .update(users)
      .set({
        passwordHash,
        requirePasswordChange: 'true',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Send password reset email
    try {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Password Reset - NEM Insurance</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #800020 0%, #a00028 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Password Reset</h1>
              <p style="margin: 10px 0 0; color: #ffd700; font-size: 16px;">NEM Insurance Salvage Management</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello <strong>${existingUser.fullName}</strong>,
              </p>
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Your password has been reset by a system administrator. Below is your new temporary password:
              </p>
              <div style="background-color: #f8f9fa; border-left: 4px solid #800020; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: bold;">New Temporary Password:</p>
                <code style="display: block; background-color: #ffffff; padding: 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 18px; color: #800020; text-align: center;">${temporaryPassword}</code>
              </div>
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>⚠️ Important:</strong> You will be required to change this password on your next login.
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                   style="display: inline-block; padding: 14px 32px; background-color: #800020; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Log In Now
                </a>
              </div>
              <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you did not request this password reset, please contact support immediately at 
                <a href="mailto:nemsupport@nem-insurance.com" style="color: #800020; text-decoration: none;">nemsupport@nem-insurance.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} NEM Insurance. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: existingUser.email,
        subject: 'Password Reset - NEM Insurance Salvage Management',
        html,
        replyTo: 'nemsupport@nem-insurance.com',
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
