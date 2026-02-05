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
import { redis } from '@/lib/redis/client';

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
  afterState?: Record<string, unknown>
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
      async authorize(credentials, _req) {
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

        // Fetch vendor profile if user is a vendor
        let vendorId: string | undefined;
        if (user.role === 'vendor') {
          const { vendors } = await import('@/lib/db/schema/vendors');
          const [vendor] = await db
            .select({ id: vendors.id })
            .from(vendors)
            .where(eq(vendors.userId, user.id))
            .limit(1);
          
          vendorId = vendor?.id;
        }

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
          phone: user.phone,
          dateOfBirth: user.dateOfBirth?.toISOString().split('T')[0],
          requirePasswordChange: user.requirePasswordChange === 'true',
          vendorId,
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
    error: '/auth/error',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, check if user exists or handle new registration
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
          // Existing user - allow login
          user.id = existingUser.id;
          user.role = existingUser.role;
          user.status = existingUser.status;
          user.phone = existingUser.phone;
          
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

        // New OAuth user - store temporary data in Redis for completion flow
        // DO NOT create user account yet - they need to verify phone with OTP first
        const tempKey = `oauth_temp:${email}`;
        const tempData = {
          email,
          name: user.name || 'OAuth User',
          provider: account.provider,
          providerId: account.providerAccountId,
          picture: user.image,
          createdAt: Date.now(),
        };
        
        // Store for 15 minutes
        await redis.set(tempKey, JSON.stringify(tempData), { ex: 15 * 60 });
        
        // Return false to deny sign in, which will redirect to error page
        // The error page will detect this and redirect to complete-oauth
        return `/auth/complete-oauth?email=${encodeURIComponent(email)}`;
      }

      return true;
    },

    async jwt({ token, user, account: _account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = user.role || 'vendor';
        token.status = user.status || 'unverified_tier_0';
        token.email = user.email || '';
        token.phone = user.phone;
        token.dateOfBirth = user.dateOfBirth;
        token.requirePasswordChange = user.requirePasswordChange || false;
        token.needsPhoneNumber = user.needsPhoneNumber || false;
        token.vendorId = user.vendorId;
        
        // Generate a unique session identifier to bind this token to this specific login
        // This prevents token reuse across different browser contexts
        token.sessionId = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Generate access token as a JWT that Socket.IO can verify
        // Use the same secret as NextAuth for consistency
        const jwt = require('jsonwebtoken');
        token.accessToken = jwt.sign(
          {
            sub: user.id,
            role: user.role,
            vendorId: user.vendorId,
            email: user.email,
          },
          process.env.NEXTAUTH_SECRET!,
          {
            expiresIn: '24h',
          }
        );
        
        // Set token expiry based on device type
        const deviceType = getDeviceType(token.userAgent as string | null);
        const expirySeconds = getTokenExpiry(deviceType);
        token.exp = Math.floor(Date.now() / 1000) + expirySeconds;
        
        // Skip validation on initial sign-in since user object is present and trusted
        return token;
      }

      // Validate token integrity on subsequent requests (when user object is not present)
      // This ensures the token hasn't been tampered with and the user still exists
      if (token.id && !user) {
        // Verify the user still exists and hasn't been deleted/suspended
        const [currentUser] = await db
          .select({
            id: users.id,
            role: users.role,
            status: users.status,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);

        // If user doesn't exist or is deleted, invalidate the token
        if (!currentUser || currentUser.status === 'deleted') {
          console.warn(`[JWT] Invalid token for user ${token.id} - user not found or deleted`);
          throw new Error('Invalid session');
        }

        // Verify the token's user ID matches the database user ID
        // This prevents token tampering
        if (currentUser.id !== token.id) {
          console.error(`[JWT] Token user ID mismatch! Token: ${token.id}, DB: ${currentUser.id}`);
          throw new Error('Session validation failed');
        }

        // Verify the token's email matches the database email
        // This catches cases where the wrong user's token is being used
        if (currentUser.email !== token.email) {
          console.error(`[JWT] Token email mismatch! Token: ${token.email}, DB: ${currentUser.email}`);
          throw new Error('Session validation failed');
        }
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
          token.phone = updatedUser.phone;
          token.requirePasswordChange = updatedUser.requirePasswordChange === 'true';
          
          // Refresh vendorId if user is a vendor
          if (updatedUser.role === 'vendor') {
            const { vendors } = await import('@/lib/db/schema/vendors');
            const [vendor] = await db
              .select({ id: vendors.id })
              .from(vendors)
              .where(eq(vendors.userId, updatedUser.id))
              .limit(1);
            
            token.vendorId = vendor?.id;
          }
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
        session.user.phone = token.phone as string | undefined;
        session.user.dateOfBirth = token.dateOfBirth as string | undefined;
        session.user.requirePasswordChange = token.requirePasswordChange as boolean;
        session.user.needsPhoneNumber = token.needsPhoneNumber as boolean;
        session.user.vendorId = token.vendorId as string | undefined;
        
        // Include access token in session for Socket.io authentication
        session.accessToken = token.accessToken as string;
        
        // Include session ID for tracking
        session.sessionId = token.sessionId as string;
      }

      // Store session in Redis using the unique session ID
      // This prevents session collision between different users
      if (session.user?.id && token?.sessionId) {
        const sessionKey = `session:${token.sessionId}`;
        
        interface TokenWithUserAgent {
          userAgent?: string | null;
        }
        
        const deviceType = getDeviceType((token as TokenWithUserAgent).userAgent as string | null);
        const expirySeconds = getTokenExpiry(deviceType);
        
        // Store session with user ID validation data
        const sessionData = {
          ...session,
          userId: session.user.id, // Explicit user ID for validation
          email: session.user.email, // Email for cross-validation
          createdAt: Date.now(),
        };
        
        await kv.set(sessionKey, JSON.stringify(sessionData), {
          ex: expirySeconds,
        });
        
        // Also maintain a user-to-session mapping for logout
        const userSessionKey = `user:${session.user.id}:session`;
        await kv.set(userSessionKey, token.sessionId as string, {
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

  // Explicit cookie configuration to prevent session hijacking
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-authjs.session-token' 
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax', // Prevents CSRF while allowing normal navigation
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        // Domain is intentionally NOT set to ensure cookies are bound to exact host
        // This prevents cookie sharing across subdomains or different browser contexts
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.callback-url'
        : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Host-authjs.csrf-token'
        : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  events: {
    async signIn({ user, account, isNewUser: _isNewUser }) {
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
      // Remove session from Redis using both keys
      if ('token' in message && message.token?.id) {
        const userId = message.token.id as string;
        const sessionId = message.token.sessionId as string;
        
        // Remove the session by session ID
        if (sessionId) {
          const sessionKey = `session:${sessionId}`;
          await kv.del(sessionKey);
        }
        
        // Remove the user-to-session mapping
        const userSessionKey = `user:${userId}:session`;
        await kv.del(userSessionKey);
        
        // Also remove old-style session key for backwards compatibility
        const oldSessionKey = `session:${userId}`;
        await kv.del(oldSessionKey);
        
        // Create audit log for logout
        try {
          await db.insert(auditLogs).values({
            userId,
            actionType: 'logout',
            entityType: 'user',
            entityId: userId,
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
