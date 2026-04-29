import { hash } from 'bcryptjs';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { RegistrationInput } from '@/lib/utils/validation';

export interface RegistrationResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Auth Service
 * Handles user authentication and registration
 */
export class AuthService {
  /**
   * Register a new vendor user
   * @param input - Registration input data
   * @param ipAddress - IP address of the user
   * @param deviceType - Device type (mobile, desktop, tablet)
   * @returns Registration result with user ID or error
   */
  async register(
    input: RegistrationInput,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet'
  ): Promise<RegistrationResult> {
    try {
      // Check if email already exists (excluding soft-deleted users)
      const existingUserByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUserByEmail.length > 0) {
        // If user is soft-deleted, provide helpful error message
        if (existingUserByEmail[0].status === 'deleted') {
          return {
            success: false,
            error: 'This email was previously registered and deleted. Please contact support to reactivate your account or use a different email.',
          };
        }
        
        return {
          success: false,
          error: 'Email already registered',
        };
      }

      // Check if phone already exists (excluding soft-deleted users)
      const existingUserByPhone = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);

      if (existingUserByPhone.length > 0) {
        // If user is soft-deleted, provide helpful error message
        if (existingUserByPhone[0].status === 'deleted') {
          return {
            success: false,
            error: 'This phone number was previously registered and deleted. Please contact support to reactivate your account or use a different phone number.',
          };
        }
        
        return {
          success: false,
          error: 'Phone number already registered',
        };
      }

      // Hash password with bcrypt (12 rounds)
      const passwordHash = await hash(input.password, 12);

      // Convert dateOfBirth to Date if it's not already
      const dateOfBirth = input.dateOfBirth instanceof Date 
        ? input.dateOfBirth 
        : new Date(input.dateOfBirth);

      // Use transaction to ensure both user and vendor records are created atomically
      const result = await db.transaction(async (tx) => {
        // Create user record
        const [newUser] = await tx
          .insert(users)
          .values({
            email: input.email,
            phone: input.phone,
            passwordHash,
            fullName: input.fullName,
            dateOfBirth,
            role: 'vendor',
            status: 'unverified_tier_0',
          })
          .returning();

        // Create vendor profile record
        const [newVendor] = await tx
          .insert(vendors)
          .values({
            userId: newUser.id,
            tier: 'tier1_bvn',
            status: 'pending',
            registrationFeePaid: false,
            performanceStats: {
              totalBids: 0,
              totalWins: 0,
              winRate: 0,
              avgPaymentTimeHours: 0,
              onTimePickupRate: 0,
              fraudFlags: 0,
            },
            rating: '0.00',
          })
          .returning();

        // Create audit log entry
        await tx.insert(auditLogs).values({
          userId: newUser.id,
          actionType: 'user_registration',
          entityType: 'user',
          entityId: newUser.id,
          ipAddress,
          deviceType,
          userAgent: 'web',
          afterState: {
            email: input.email,
            phone: input.phone,
            registrationMethod: 'standard',
            vendorId: newVendor.id,
          },
        });

        return { user: newUser, vendor: newVendor };
      });

      console.log('✅ User and vendor profile created successfully:', {
        userId: result.user.id,
        vendorId: result.vendor.id,
        email: input.email,
      });

      return {
        success: true,
        userId: result.user.id,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed. Please try again.',
      };
    }
  }

  /**
   * Check if email exists
   * @param email - Email to check
   * @returns True if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Check if phone exists
   * @param phone - Phone to check
   * @returns True if phone exists
   */
  async phoneExists(phone: string): Promise<boolean> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    return result.length > 0;
  }
}

export const authService = new AuthService();

// Re-export OAuth service for convenience
export { oauthService } from './oauth.service';
