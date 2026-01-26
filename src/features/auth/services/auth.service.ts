import { hash } from 'bcryptjs';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, or } from 'drizzle-orm';
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
      // Check if email already exists
      const existingUserByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUserByEmail.length > 0) {
        return {
          success: false,
          error: 'Email already registered',
        };
      }

      // Check if phone already exists
      const existingUserByPhone = await db
        .select()
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);

      if (existingUserByPhone.length > 0) {
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

      // Create user record
      const [newUser] = await db
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

      // Create audit log entry
      await db.insert(auditLogs).values({
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
        },
      });

      return {
        success: true,
        userId: newUser.id,
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
