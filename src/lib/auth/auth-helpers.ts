import { auth } from './next-auth.config';
import { kv } from '@vercel/kv';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * Get the current authenticated session
 * Use this in Server Components and API routes
 */
export async function getSession() {
  return await auth();
}

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return null;
  }

  // Try to get from Redis cache first
  const cacheKey = `user:${session.user.id}`;
  const cachedUser = await kv.get(cacheKey);
  
  if (cachedUser) {
    return cachedUser as typeof user;
  }

  // Fetch from database
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user) {
    // Cache for 5 minutes
    await kv.set(cacheKey, JSON.stringify(user), { ex: 300 });
    return user;
  }

  return null;
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRole: string | string[]) {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(user.role as string);
}

/**
 * Require authentication - throws error if not authenticated
 * Use in API routes
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return session;
}

/**
 * Require specific role - throws error if user doesn't have role
 * Use in API routes
 */
export async function requireRole(requiredRole: string | string[]) {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  if (!roles.includes(user.role as string)) {
    throw new Error('Forbidden: Insufficient permissions');
  }

  return user;
}

/**
 * Check account lockout status
 * Returns true if account is locked
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const lockoutKey = `lockout:${userId}`;
  const lockoutData = await kv.get(lockoutKey);
  
  if (!lockoutData) {
    return false;
  }

  return true;
}

/**
 * Record failed login attempt
 * Locks account after 5 failed attempts for 30 minutes
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  const attemptsKey = `login_attempts:${userId}`;
  const lockoutKey = `lockout:${userId}`;
  
  // Increment failed attempts
  const attempts = await kv.incr(attemptsKey);
  
  // Set expiry on first attempt (5 minutes)
  if (attempts === 1) {
    await kv.expire(attemptsKey, 300);
  }
  
  // Lock account after 5 failed attempts
  if (attempts >= 5) {
    await kv.set(lockoutKey, 'locked', { ex: 1800 }); // 30 minutes
    await kv.del(attemptsKey);
  }
}

/**
 * Clear failed login attempts on successful login
 */
export async function clearFailedLogins(userId: string): Promise<void> {
  const attemptsKey = `login_attempts:${userId}`;
  await kv.del(attemptsKey);
}

/**
 * Get device type from user agent
 */
export function getDeviceType(userAgent: string | null): 'mobile' | 'desktop' | 'tablet' {
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

/**
 * Invalidate user session (force logout)
 */
export async function invalidateSession(userId: string): Promise<void> {
  const sessionKey = `session:${userId}`;
  await kv.del(sessionKey);
}
