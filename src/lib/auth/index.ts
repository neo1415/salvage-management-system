// Server-side auth utilities
export {
  getSession,
  getCurrentUser,
  hasRole,
  requireAuth,
  requireRole,
  isAccountLocked,
  recordFailedLogin,
  clearFailedLogins,
  getDeviceType,
  invalidateSession,
} from './auth-helpers';

// Auth configuration
export { authConfig } from './next-auth.config';
// Alias for NextAuth compatibility
export { authConfig as authOptions } from './next-auth.config';
// NextAuth v5 auth function
export { auth, signIn, signOut, handlers } from './next-auth.config';

// Client-side auth utilities
export { AuthProvider } from './auth-provider';
export { useAuth, useRole, useRequireAuth, useRequireRole } from './use-auth';
