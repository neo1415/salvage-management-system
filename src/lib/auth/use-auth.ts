'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Custom hook for authentication
 * Provides easy access to session data and auth functions
 * 
 * Usage:
 * ```tsx
 * const { user, isAuthenticated, isLoading, login, logout } = useAuth();
 * ```
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const login = async (emailOrPhone: string, password: string) => {
    const result = await signIn('credentials', {
      emailOrPhone,
      password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    return result;
  };

  const loginWithGoogle = async () => {
    await signIn('google', { callbackUrl: '/vendor/dashboard' });
  };

  const loginWithFacebook = async () => {
    await signIn('facebook', { callbackUrl: '/vendor/dashboard' });
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return {
    user: session?.user,
    session,
    isLoading,
    isAuthenticated,
    login,
    loginWithGoogle,
    loginWithFacebook,
    logout,
  };
}

/**
 * Hook to check if user has required role
 */
export function useRole(requiredRole: string | string[]) {
  const { user } = useAuth();

  if (!user) {
    return false;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(user.role);
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (!isLoading && !isAuthenticated) {
    router.push('/login');
  }

  return { isAuthenticated, isLoading };
}

/**
 * Hook to require specific role
 * Redirects to unauthorized page if user doesn't have role
 */
export function useRequireRole(requiredRole: string | string[]) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const hasRequiredRole = useRole(requiredRole);

  if (!isLoading && !hasRequiredRole) {
    router.push('/unauthorized');
  }

  return { user, isLoading, hasRequiredRole };
}
