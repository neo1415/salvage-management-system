import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';

export interface OAuthProfile {
  email: string;
  name: string;
  provider: 'google' | 'facebook';
  providerId: string;
  picture?: string;
  phone?: string;
}

export interface OAuthRegistrationResult {
  success: boolean;
  userId?: string;
  needsPhoneNumber?: boolean;
  error?: string;
}

/**
 * OAuth Service
 * Handles OAuth registration and callback processing
 */
export class OAuthService {
  /**
   * Handle OAuth registration callback
   * Creates user account from OAuth provider data
   * 
   * @param profile - OAuth profile data from provider
   * @param ipAddress - IP address of the user
   * @param deviceType - Device type (mobile, desktop, tablet)
   * @param userAgent - User agent string
   * @returns Registration result with user ID or error
   */
  async handleOAuthRegistration(
    profile: OAuthProfile,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet',
    userAgent: string
  ): Promise<OAuthRegistrationResult> {
    try {
      // Check if user already exists by email
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);

      if (existingUser) {
        // User already exists, update last login
        await db
          .update(users)
          .set({
            lastLoginAt: new Date(),
            loginDeviceType: deviceType,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        // Create audit log for OAuth login
        await db.insert(auditLogs).values({
          userId: existingUser.id,
          actionType: 'oauth_login',
          entityType: 'user',
          entityId: existingUser.id,
          ipAddress,
          deviceType,
          userAgent,
          afterState: {
            provider: profile.provider,
            email: profile.email,
          },
        });

        return {
          success: true,
          userId: existingUser.id,
          needsPhoneNumber: !existingUser.phone,
        };
      }

      // Check if phone number is provided
      if (!profile.phone) {
        // Return flag indicating phone number is needed
        return {
          success: false,
          needsPhoneNumber: true,
          error: 'Phone number required',
        };
      }

      // Check if phone already exists
      const [existingUserByPhone] = await db
        .select()
        .from(users)
        .where(eq(users.phone, profile.phone))
        .limit(1);

      if (existingUserByPhone) {
        return {
          success: false,
          error: 'Phone number already registered',
        };
      }

      // Create new user with OAuth data
      const [newUser] = await db
        .insert(users)
        .values({
          email: profile.email,
          phone: profile.phone,
          passwordHash: '', // No password for OAuth users
          fullName: profile.name,
          dateOfBirth: new Date('1990-01-01'), // Placeholder, will be updated during KYC
          role: 'vendor',
          status: 'unverified_tier_0',
          loginDeviceType: deviceType,
          lastLoginAt: new Date(),
        })
        .returning();

      // Create audit log entry
      await db.insert(auditLogs).values({
        userId: newUser.id,
        actionType: 'oauth_registration',
        entityType: 'user',
        entityId: newUser.id,
        ipAddress,
        deviceType,
        userAgent,
        afterState: {
          email: profile.email,
          phone: profile.phone,
          provider: profile.provider,
          providerId: profile.providerId,
          registrationMethod: 'oauth',
        },
      });

      return {
        success: true,
        userId: newUser.id,
        needsPhoneNumber: false,
      };
    } catch (error) {
      console.error('OAuth registration error:', error);
      return {
        success: false,
        error: 'OAuth registration failed. Please try again.',
      };
    }
  }

  /**
   * Complete OAuth registration by adding phone number
   * Called when OAuth provider doesn't provide phone number
   * 
   * @param email - User email from OAuth
   * @param phone - Phone number provided by user
   * @param dateOfBirth - Date of birth provided by user
   * @param ipAddress - IP address of the user
   * @param deviceType - Device type
   * @param userAgent - User agent string
   * @returns Registration result
   */
  async completeOAuthRegistration(
    email: string,
    phone: string,
    dateOfBirth: Date,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet',
    userAgent: string
  ): Promise<OAuthRegistrationResult> {
    try {
      // Check if phone already exists
      const [existingUserByPhone] = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);

      if (existingUserByPhone) {
        return {
          success: false,
          error: 'Phone number already registered',
        };
      }

      // Find user by email (should exist from OAuth callback)
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return {
          success: false,
          error: 'User not found. Please try registering again.',
        };
      }

      // Update user with phone number and date of birth
      await db
        .update(users)
        .set({
          phone,
          dateOfBirth,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Create audit log entry
      await db.insert(auditLogs).values({
        userId: user.id,
        actionType: 'oauth_registration_completed',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
        deviceType,
        userAgent,
        beforeState: {
          phone: null,
        },
        afterState: {
          phone,
          dateOfBirth: dateOfBirth.toISOString(),
        },
      });

      return {
        success: true,
        userId: user.id,
        needsPhoneNumber: false,
      };
    } catch (error) {
      console.error('Complete OAuth registration error:', error);
      return {
        success: false,
        error: 'Failed to complete registration. Please try again.',
      };
    }
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User object or null
   */
  async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }
}

export const oauthService = new OAuthService();
