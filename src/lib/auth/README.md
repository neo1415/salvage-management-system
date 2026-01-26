# Authentication System

This directory contains the authentication configuration and utilities for the Salvage Management System using NextAuth.js v5.

## Features

- **JWT-based authentication** with device-specific token expiry
  - Mobile: 2 hours
  - Desktop/Tablet: 24 hours
- **Multiple authentication providers**:
  - Credentials (email/phone + password)
  - Google OAuth
  - Facebook OAuth
- **Session management** with Redis caching
- **Account lockout** after 5 failed login attempts (30-minute cooldown)
- **Role-based access control** (RBAC)
- **Audit logging** for all authentication events

## Files

- `next-auth.config.ts` - NextAuth.js configuration with providers and callbacks
- `auth-helpers.ts` - Server-side authentication utilities
- `auth-provider.tsx` - Client-side session provider component
- `use-auth.ts` - Client-side authentication hooks
- `index.ts` - Main export file

## Environment Variables

Required environment variables in `.env`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret

# Vercel KV (Redis)
KV_REST_API_URL=your-kv-rest-api-url
KV_REST_API_TOKEN=your-kv-api-token
KV_REST_API_READ_ONLY_TOKEN=your-kv-read-only-token
```

## Usage

### Server-Side (API Routes, Server Components)

```typescript
import { getSession, getCurrentUser, requireAuth, requireRole } from '@/lib/auth';

// Get current session
const session = await getSession();

// Get current user
const user = await getCurrentUser();

// Require authentication (throws error if not authenticated)
const session = await requireAuth();

// Require specific role (throws error if user doesn't have role)
const user = await requireRole('salvage_manager');
```

### Client-Side (React Components)

```typescript
'use client';

import { useAuth, useRole, useRequireAuth } from '@/lib/auth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  // Check if user has role
  const isManager = useRole('salvage_manager');

  // Login with credentials
  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Logout
  const handleLogout = async () => {
    await logout();
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.name}!</p>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

### Protecting Routes with Middleware

The middleware automatically protects routes based on authentication status:

- Protected routes: `/vendor/*`, `/adjuster/*`, `/manager/*`, `/finance/*`, `/admin/*`
- Public routes: `/`, `/login`, `/register`, `/verify-otp`

### Wrapping App with Auth Provider

In your root layout (`src/app/layout.tsx`):

```typescript
import { AuthProvider } from '@/lib/auth';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## Session Management

Sessions are stored in Redis with device-specific expiry:

- **Mobile devices**: 2-hour expiry
- **Desktop/Tablet**: 24-hour expiry

Session data is cached in Redis for quick lookups and invalidated on logout.

## Account Lockout

After 5 failed login attempts, the account is locked for 30 minutes. Failed attempts are tracked in Redis with a 5-minute sliding window.

## Role-Based Access Control

Available roles:
- `vendor` - External buyers who bid on salvage items
- `claims_adjuster` - Insurance staff who create salvage cases
- `salvage_manager` - Insurance staff who approve cases and manage vendors
- `finance_officer` - Insurance staff who verify payments
- `system_admin` - Technical staff who manage system configuration

## Security Features

- **Password hashing** with bcrypt (12 rounds)
- **JWT tokens** with device-specific expiry
- **Session invalidation** on logout
- **Account lockout** after failed attempts
- **Audit logging** for all authentication events
- **Security headers** in middleware (X-Frame-Options, X-Content-Type-Options, etc.)

## Testing

Authentication is tested with:
- Unit tests for password validation
- Integration tests for login flow
- E2E tests for complete authentication flows

See `tests/unit/auth/` for test examples.
