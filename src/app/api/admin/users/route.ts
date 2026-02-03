import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { hash } from 'bcryptjs';
import { emailService } from '@/features/notifications/services/email.service';
import { z } from 'zod';
import { eq, or, ilike, and, inArray } from 'drizzle-orm';

// Validation schema for staff account creation
const createStaffSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format'),
  role: z.enum(['claims_adjuster', 'salvage_manager', 'finance_officer'], {
    message: 'Invalid role. Must be claims_adjuster, salvage_manager, or finance_officer',
  }),
});

/**
 * Generate a secure temporary password
 * Format: 3 random words + 2 digits + 1 special character
 * Example: "Sunset-Mountain-River-42!"
 */
function generateTemporaryPassword(): string {
  const words = [
    'Sunset', 'Mountain', 'River', 'Ocean', 'Forest', 'Desert', 'Valley', 'Canyon',
    'Meadow', 'Prairie', 'Island', 'Harbor', 'Summit', 'Glacier', 'Volcano', 'Lagoon',
  ];
  
  const specialChars = '!@#$%^&*';
  
  // Pick 3 random words
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const word3 = words[Math.floor(Math.random() * words.length)];
  
  // Generate 2 random digits
  const digits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  // Pick 1 random special character
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${word1}-${word2}-${word3}-${digits}${specialChar}`;
}

/**
 * Send temporary password email to new staff member
 */
async function sendTemporaryPasswordEmail(
  email: string,
  fullName: string,
  temporaryPassword: string,
  role: string
): Promise<void> {
  const roleDisplayNames: Record<string, string> = {
    claims_adjuster: 'Claims Adjuster',
    salvage_manager: 'Salvage Manager',
    finance_officer: 'Finance Officer',
  };

  const roleDisplay = roleDisplayNames[role] || role;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to NEM Insurance Salvage Management System</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #800020 0%, #a00028 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Welcome to NEM Insurance</h1>
              <p style="margin: 10px 0 0; color: #ffd700; font-size: 16px;">Salvage Management System</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello <strong>${fullName}</strong>,
              </p>

              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Your staff account has been created for the NEM Insurance Salvage Management System. You have been assigned the role of <strong>${roleDisplay}</strong>.
              </p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #800020; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: bold;">Your Login Credentials:</p>
                <p style="margin: 0 0 5px; color: #555555; font-size: 14px;">
                  <strong>Email:</strong> ${email}
                </p>
                <p style="margin: 0; color: #555555; font-size: 14px;">
                  <strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 16px; color: #800020;">${temporaryPassword}</code>
                </p>
              </div>

              <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>⚠️ Important:</strong> You will be required to change your password on first login for security purposes.
                </p>
              </div>

              <p style="margin: 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                To get started, please log in to the system using the link below:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login" 
                   style="display: inline-block; padding: 14px 32px; background-color: #800020; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Log In Now
                </a>
              </div>

              <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need assistance, please contact our support team at 
                <a href="mailto:nemsupport@nem-insurance.com" style="color: #800020; text-decoration: none;">nemsupport@nem-insurance.com</a> 
                or call <strong>234-02-014489560</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                <strong>NEM Insurance Plc</strong><br>
                199 Ikorodu Road, Obanikoro, Lagos, Nigeria
              </p>
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
    to: email,
    subject: 'Welcome to NEM Insurance Salvage Management System - Your Account Details',
    html,
    replyTo: 'nemsupport@nem-insurance.com',
  });
}

/**
 * GET /api/admin/users
 * List all users with optional filters
 * Only accessible by System Admins
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Check if user is System Admin
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only System Admins can view users.' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');

    // Build query conditions
    const conditions = [];

    // Filter by role
    if (roleFilter && roleFilter !== 'all') {
      const roles = roleFilter.split(',') as Array<'vendor' | 'claims_adjuster' | 'salvage_manager' | 'finance_officer' | 'system_admin'>;
      conditions.push(inArray(users.role, roles));
    }

    // Filter by status
    if (statusFilter && statusFilter !== 'all') {
      const statuses = statusFilter.split(',') as Array<'unverified_tier_0' | 'phone_verified_tier_0' | 'verified_tier_1' | 'verified_tier_2' | 'suspended' | 'deleted'>;
      conditions.push(inArray(users.status, statuses));
    }

    // Search by name, email, or phone
    if (searchQuery) {
      conditions.push(
        or(
          ilike(users.fullName, `%${searchQuery}%`),
          ilike(users.email, `%${searchQuery}%`),
          ilike(users.phone, `%${searchQuery}%`)
        )
      );
    }

    // Fetch users
    const usersList = await db.query.users.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (users, { desc }) => [desc(users.createdAt)],
      columns: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        loginDeviceType: true,
      },
    });

    return NextResponse.json({
      success: true,
      users: usersList,
      count: usersList.length,
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new staff account (Claims Adjuster, Salvage Manager, Finance Officer)
 * Only accessible by System Admins
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Check if user is System Admin
    if (session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden. Only System Admins can create staff accounts.' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createStaffSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { fullName, email, phone, role } = validationResult.data;

    // Check if email already exists
    const existingUserByEmail = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Check if phone already exists
    const existingUserByPhone = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone, phone),
    });

    if (existingUserByPhone) {
      return NextResponse.json(
        { error: 'Phone number already registered' },
        { status: 409 }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Hash temporary password with bcrypt (12 rounds)
    const passwordHash = await hash(temporaryPassword, 12);

    // Create staff user record
    // Staff accounts don't need phone verification or KYC, so status is set based on role
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        phone,
        passwordHash,
        fullName,
        dateOfBirth: new Date('1990-01-01'), // Placeholder for staff accounts
        role,
        status: 'phone_verified_tier_0', // Staff don't need vendor tiers
        requirePasswordChange: 'true', // Force password change on first login
      })
      .returning();

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create audit log entry
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'staff_account_created',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress,
      deviceType: 'desktop',
      userAgent: userAgent.substring(0, 500),
      afterState: {
        staffUserId: newUser.id,
        staffEmail: email,
        staffRole: role,
        createdBy: session.user.id,
        createdByEmail: session.user.email,
      },
    });

    // Send temporary password email
    try {
      await sendTemporaryPasswordEmail(email, fullName, temporaryPassword, role);
    } catch (emailError) {
      console.error('Failed to send temporary password email:', emailError);
      // Don't fail the request if email fails - user can be notified manually
    }

    const elapsedTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        message: 'Staff account created successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          status: newUser.status,
          createdAt: newUser.createdAt,
        },
        temporaryPassword, // Include in response for admin to share if email fails
        provisioningTime: `${elapsedTime}ms`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Staff account creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create staff account',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
