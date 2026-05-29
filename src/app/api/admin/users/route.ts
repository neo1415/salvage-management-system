import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { hash } from 'bcryptjs';
import { emailService } from '@/features/notifications/services/email.service';
import { z } from 'zod';
import { eq, or, ilike, and, inArray, ne, isNotNull, isNull, sql } from 'drizzle-orm';
import { vendors } from '@/lib/db/schema/vendors';
import { resolveVendorUserStatus } from '@/lib/utils/vendor-user-status';
import { appPath } from '@/features/notifications/templates/email-urls';
import { brandLegalName, brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

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
  const loginUrl = appPath('/login');

  const branding = await getEmailBranding();
  const supportEmail = getSupportEmail(branding);
  const supportPhone = getSupportPhone(branding);
  const html = await wrapProfessionalEmail(
    `Welcome to ${branding.brandName}`,
    `
      <p>Hello <strong>${fullName}</strong>,</p>
      <p>Your staff account has been created for ${branding.brandName}. You have been assigned the role of <strong>${roleDisplay}</strong>.</p>
      <div style="background-color: #f8f9fa; border-left: 4px solid ${branding.primaryColor}; padding: 20px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0 0 10px; color: #333333; font-size: 14px; font-weight: bold;">Your Login Credentials:</p>
        <p style="margin: 0 0 5px; color: #555555; font-size: 14px;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0; color: #555555; font-size: 14px;"><strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 16px; color: ${branding.primaryColor};">${temporaryPassword}</code></p>
      </div>
      <div style="background-color: #fff3cd; border: 1px solid ${branding.accentColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-size: 14px;"><strong>Important:</strong> You will be required to change your password on first login for security purposes.</p>
      </div>
      <p>To get started, please log in to the system using the link below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${branding.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Log In Now</a>
      </div>
      <p style="font-size: 14px; color: #666666;">If you have any questions or need assistance, contact ${supportEmail} or ${supportPhone}.</p>
      <p style="margin-top: 30px;">Best regards,<br><strong>${brandTeamName(branding)}</strong></p>
      <p style="font-size: 12px; color: #999999;">${brandLegalName(branding)}</p>
    `,
    `Your ${branding.brandName} staff account has been created.`
  );
  await emailService.sendEmail({
    to: email,
    subject: `Welcome to ${branding.brandName} - Your Account Details`,
    html,
    category: 'auth',
    replyTo: supportEmail,
  });
}

/**
 * GET /api/admin/users
 * List all users with optional filters and pagination
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    // Build query conditions
    const conditions = [];

    // Filter by role
    if (roleFilter && roleFilter !== 'all') {
      const roles = roleFilter.split(',') as Array<'vendor' | 'claims_adjuster' | 'salvage_manager' | 'finance_officer' | 'system_admin'>;
      conditions.push(inArray(users.role, roles));
    }

    // Filter by status (includes vendor KYC-derived tiers)
    if (statusFilter && statusFilter !== 'all') {
      const statuses = statusFilter.split(',') as Array<'unverified_tier_0' | 'phone_verified_tier_0' | 'verified_tier_1' | 'verified_tier_2' | 'suspended' | 'deleted'>;
      const statusConditions = statuses.flatMap((status) => {
        if (status === 'verified_tier_2') {
          return [
            eq(users.status, 'verified_tier_2'),
            and(
              eq(users.role, 'vendor'),
              or(isNotNull(vendors.tier2ApprovedAt), eq(vendors.tier, 'tier2_full'))
            ),
          ];
        }
        if (status === 'verified_tier_1') {
          return [
            eq(users.status, 'verified_tier_1'),
            and(
              eq(users.role, 'vendor'),
              isNotNull(vendors.bvnVerifiedAt),
              isNull(vendors.tier2ApprovedAt),
              ne(vendors.tier, 'tier2_full')
            ),
          ];
        }
        return [eq(users.status, status)];
      });
      conditions.push(or(...statusConditions));
    } else {
      conditions.push(ne(users.status, 'deleted'));
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

    // Calculate offset
    const offset = (page - 1) * pageSize;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        profilePictureUrl: users.profilePictureUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        loginDeviceType: users.loginDeviceType,
        vendorBvnVerifiedAt: vendors.bvnVerifiedAt,
        vendorTier: vendors.tier,
        vendorTier2ApprovedAt: vendors.tier2ApprovedAt,
      })
      .from(users)
      .leftJoin(vendors, eq(vendors.userId, users.id))
      .where(whereClause)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(pageSize + 1)
      .offset(offset);

    const hasMore = usersList.length > pageSize;
    const raw = hasMore ? usersList.slice(0, pageSize) : usersList;

    const data = raw.map((row) => {
      const vendorSnapshot =
        row.role === 'vendor' && row.vendorTier
          ? {
              bvnVerifiedAt: row.vendorBvnVerifiedAt,
              tier: row.vendorTier,
              tier2ApprovedAt: row.vendorTier2ApprovedAt,
            }
          : null;

      const displayStatus = resolveVendorUserStatus(row.status, vendorSnapshot);

      return {
        id: row.id,
        email: row.email,
        phone: row.phone,
        fullName: row.fullName,
        role: row.role,
        status: row.status,
        displayStatus,
        profilePictureUrl: row.profilePictureUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastLoginAt: row.lastLoginAt,
        loginDeviceType: row.loginDeviceType,
      };
    });

    const totalCountResult = await db
      .select({ id: users.id })
      .from(users)
      .leftJoin(vendors, eq(vendors.userId, users.id))
      .where(whereClause);

    return NextResponse.json({
      success: true,
      users: data,
      count: data.length,
      totalCount: totalCountResult.length,
      hasMore,
      page,
      pageSize,
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
