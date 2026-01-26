import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, or } from 'drizzle-orm';
import { kv } from '@vercel/kv';
import { redis, rateLimiter } from '@/lib/redis/client';

// Device type detection helper
function getDeviceType(userAgent: string | null): 'mobile' | 'desktop' | 'tablet' {
  if (!userAgent) return 'desktop';
  
  const ua = userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// JWT token expiry based on device type
function getTokenExpiry(deviceType: 'mobile' | 'desktop' | 'tablet'): number {
  // Mobile: 2 hours, Desktop/Tablet: 24 hours
  return deviceType === 'mobile' ? 2 * 60 * 60 : 24 * 60 * 60;
}

// Account lockout utilities
const LOCKOUT_DURATION = 30 * 60; // 30 minutes in seconds
const MAX_FAILED_ATTEMPTS = 5;

async function checkAccountLockout(identifier: string): Promise<{ locked: boolean; remainingTime?: number }> {
  const lockoutKey = `lockout:${identifier}`;
  const ttl = await redis.ttl(lockoutKey);
  
  if (ttl > 0) {
    return { locked: true, remainingTime: ttl };
  }
  
  return { locked: false };
}

async function recordFailedLogin(identifier: string): Promise<number> {
  const failedKey = `failed_login:${identifier}`;
  const attempts = await redis.incr(failedKey);
  
  if (attempts === 1) {
    // Set expiry for failed attempts counter (30 minutes)
    await redis.expire(failedKey, LOCKOUT_DURATION);
  }
  
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    const lockoutKey = `lockout:${identifier}`;
    await redis.set(lockoutKey, 'locked', { ex: LOCKOUT_DURATION });
    // Reset failed attempts counter
    await redis.del(failedKey);
  }
  
  return attempts;
}

async function resetFailedLogins(identifier: string): Promise<void> {
  const failedKey = `failed_login:${identifier}`;
  await redis.del(failedKey);
}

async function createAuditLog(
  userId: string,
  actionType: string,
  ipAddress: string,
  deviceType: 'mobile' | 'desktop' | 'tablet',
  userAgent: string,
  afterState?: Record<string, any>
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId,
      actionType,
      entityType: 'user',
      entityId: userId,
      ipAddress,
      deviceType,
      userAgent: userAgent.substring(0, 500), // Truncate to fit varchar(500)
      afterState,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Credentials provider for email/phone + password login
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        emailOrPhone: { label: 'Email or Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
        ipAddress: { label: 'IP Address', type: 'hidden' },
        userAgent: { label: 'User Agent', type: 'hidden' },
      },
      async authorize(credentials, req) {
        if (!credentials?.emailOrPhone || !credentials?.password) {
          throw new Error('Email/Phone and password are required');
        }

        const emailOrPhone = credentials.emailOrPhone as string;
        const password = credentials.password as string;
        const ipAddress = (credentials.ipAddress as string) || 'unknown';
        const userAgent = (credentials.userAgent as string) || '';

        // Check account lockout
        const lockoutStatus = await checkAccountLockout(emailOrPhone);
        if (lockoutStatus.locked) {
          const remainingMinutes = Math.ceil((lockoutStatus.remainingTime || 0) / 60);
          throw new Error(`Account locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`);
        }

        // Find user by email OR phone
        const [user] = await db
          .select()
          .from(users)
          .where(
            or(
              eq(users.email, emailOrPhone),
              eq(users.phone, emailOrPhone)
            )
          )
          .limit(1);

        if (!user) {
          // Record failed login attempt
          await recordFailedLogin(emailOrPhone);
          throw new Error('Invalid credentials');
        }

        // Verify password
        const isValidPassword = await compare(password, user.passwordHash);
        if (!isValidPassword) {
          // Record failed login attempt
          const attempts = await recordFailedLogin(emailOrPhone);
          
          // Create audit log for failed login
          const deviceType = getDeviceType(userAgent);
          await createAuditLog(
            user.id,
            'login_failed',
            ipAddress,
            deviceType,
            userAgent,
            {
              reason: 'invalid_password',
              attempts,
              identifier: emailOrPhone,
            }
          );
          
          const remainingAttempts = MAX_FAILED_ATTEMPTS - attempts;
          if (remainingAttempts > 0) {
            throw new Error(`Invalid credentials. ${remainingAttempts} attempts remaining before account lockout.`);
          } else {
            throw new Error('Account locked due to too many failed login attempts. Please try again in 30 minutes.');
          }
        }

        // Check if account is suspended or deleted
        if (user.status === 'suspended') {
          throw new Error('Account suspended. Please contact support.');
        }
        
        if (user.status === 'deleted') {
          throw new Error('Account not found.');
        }

        // Reset failed login attempts on successful login
        await resetFailedLogins(emailOrPhone);

        // Update last login timestamp and device type
        const deviceType = getDeviceType(userAgent);
        await db
          .update(users)
          .set({
            lastLoginAt: new Date(),
            loginDeviceType: deviceType,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Create audit log for successful login
        await createAuditLog(
          user.id,
          'login_successful',
          ipAddress,
          deviceType,
          userAgent,
          {
            loginMethod: 'credentials',
            identifier: emailOrPhone,
          }
        );

        // Return user object for session
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          status: user.status,
        };
      },
    }),

    // Google OAuth provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // Facebook OAuth provider
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
  ],

  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, check if user exists or create new user
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        const email = user.email;
        if (!email) {
          return false;
        }

        // Check if user exists
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          // Update user ID for session
          user.id = existingUser.id;
          user.role = existingUser.role;
          user.status = existingUser.status;
          
          // Update last login
          await db
            .update(users)
            .set({
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));
          
          return true;
        }

        // New OAuth user - extract phone from profile if available
        let phone: string | undefined;
        
        if (account.provider === 'google' && profile) {
          // Google may provide phone in profile
          phone = (profile as any).phone_number || (profile as any).phoneNumber;
        } else if (account.provider === 'facebook' && profile) {
          // Facebook may provide phone in profile
          phone = (profile as any).phone;
        }

        // If no phone number, user will need to provide it after OAuth
        // Store temporary OAuth data in session for completion flow
        if (!phone) {
          // Allow sign-in but flag that phone is needed
          // This will be handled in the session callback
          user.needsPhoneNumber = true;
          return true;
        }

        // Create new user with OAuth data
        try {
          const [newUser] = await db
            .insert(users)
            .values({
              email: email,
              phone: phone,
              passwordHash: '', // No password for OAuth users
              fullName: user.name || 'OAuth User',
              dateOfBirth: new Date('1990-01-01'), // Placeholder
              role: 'vendor',
              status: 'unverified_tier_0',
              lastLoginAt: new Date(),
            })
            .returning();

          user.id = newUser.id;
          user.role = newUser.role;
          user.status = newUser.status;

          return true;
        } catch (error) {
          console.error('OAuth user creation error:', error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role || 'vendor';
        token.status = user.status || 'unverified_tier_0';
        token.email = user.email || '';
        
        // Set token expiry based on device type
        const deviceType = getDeviceType(token.userAgent as string | null);
        const expirySeconds = getTokenExpiry(deviceType);
        token.exp = Math.floor(Date.now() / 1000) + expirySeconds;
      }

      // Update session
      if (trigger === 'update') {
        // Refresh user data from database
        const [updatedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);

        if (updatedUser) {
          token.role = updatedUser.role;
          token.status = updatedUser.status;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.email = token.email as string;
      }

      // Store session in Redis for quick lookups
      if (session.user?.id && token) {
        const sessionKey = `session:${session.user.id}`;
        const deviceType = getDeviceType((token as any).userAgent as string | null);
        const expirySeconds = getTokenExpiry(deviceType);
        
        await kv.set(sessionKey, JSON.stringify(session), {
          ex: expirySeconds,
        });
      }

      return session;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (will be overridden by device-specific expiry)
  },

  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours (will be overridden by device-specific expiry)
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Update last login timestamp (already done in authorize for credentials)
      // For OAuth, update here
      if (user.id && account?.provider !== 'credentials') {
        await db
          .update(users)
          .set({
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
    },

    async signOut(message) {
      // Remove session from Redis
      if ('token' in message && message.token?.id) {
        const sessionKey = `session:${message.token.id}`;
        await kv.del(sessionKey);
        
        // Create audit log for logout
        try {
          await db.insert(auditLogs).values({
            userId: message.token.id as string,
            actionType: 'logout',
            entityType: 'user',
            entityId: message.token.id as string,
            ipAddress: 'unknown',
            deviceType: 'desktop',
            userAgent: 'unknown',
          });
        } catch (error) {
          console.error('Failed to create logout audit log:', error);
        }
      }
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export NextAuth instance for use in API routes and server components
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
