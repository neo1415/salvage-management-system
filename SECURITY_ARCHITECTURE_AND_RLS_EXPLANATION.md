# Security Architecture Documentation
## NEM Insurance Salvage Management System

**Date**: March 25, 2026  
**Status**: Production  
**Security Model**: Application-Level Authorization

---

## Executive Summary

The NEM Salvage application uses **Application-Level Security** rather than Database-Level Row Level Security (RLS). This is an intentional architectural decision that is appropriate for our tech stack and provides robust security when properly implemented.

### Supabase RLS Warning: False Positive

**The Supabase RLS warning is a FALSE POSITIVE for our architecture.**

- We do NOT use Supabase's client-side SDK
- We do NOT use PostgREST for direct database access
- All database queries go through authenticated Next.js API routes
- Client-side code NEVER has direct database access

---

## Security Architecture Overview

### 1. Authentication Layer

**Technology**: NextAuth.js v5 with JWT tokens

**Implementation**:
- JWT tokens stored in HTTP-only cookies
- Secure cookie prefix in production (`__Secure-authjs.session-token`)
- Token validation on every request
- Automatic token refresh
- Session expiry management

**Location**: `src/lib/auth/next-auth.config.ts`

```typescript
// Example from codebase
const token = await getToken({
  req: request,
  secret: process.env.NEXTAUTH_SECRET,
  secureCookie: process.env.NODE_ENV === 'production',
});
```

---

### 2. Authorization Layer

**Middleware Protection** (`src/middleware.ts`):
- Intercepts ALL requests before they reach API routes
- Validates authentication status
- Enforces role-based access control
- Redirects unauthorized users

**Protected Routes**:
```typescript
const protectedRoutes = [
  '/vendor',      // Vendor dashboard and features
  '/manager',     // Salvage manager features
  '/adjuster',    // Claims adjuster features
  '/finance',     // Finance officer features
  '/admin',       // System admin features
];
```

**API Route Guards**:
Every API endpoint validates:
1. User is authenticated
2. User has correct role
3. User has permission for specific resource

---

### 3. Access Control Patterns

#### Pattern 1: Role-Based Access Control (RBAC)

**Example**: Admin-only endpoints
```typescript
// From: src/app/api/admin/users/route.ts
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

if (session.user.role !== 'system_admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

#### Pattern 2: Resource Ownership Validation

**Example**: Adjusters can only view their own cases
```typescript
// From: src/app/api/cases/[id]/route.ts
const userRole = session.user.role;
const isAdjuster = userRole === 'claims_adjuster';
const isOwner = caseData.createdBy === session.user.id;

if (isAdjuster && !isOwner) {
  return NextResponse.json(
    { error: 'You do not have permission to view this case' },
    { status: 403 }
  );
}
```

#### Pattern 3: Vendor-Specific Data Isolation

**Example**: Vendors only see their own auctions
```typescript
// From: src/app/api/vendor/won-auctions/route.ts
const vendorId = session.user.vendorId;
if (!vendorId) {
  return NextResponse.json({ error: 'Vendor profile not found' }, { status: 403 });
}

// Query filters by vendorId automatically
const wonAuctions = await db
  .select()
  .from(auctions)
  .where(eq(auctions.currentBidder, vendorId));
```

---

## Why Application-Level Security is Appropriate

### Our Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                       │
│  - No direct database access                           │
│  - No Supabase client SDK                              │
│  - Only makes HTTP requests to Next.js API             │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│  MIDDLEWARE (src/middleware.ts)                         │
│  - Validates JWT token                                  │
│  - Checks authentication                                │
│  - Enforces route protection                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  API ROUTES (src/app/api/**/route.ts)                   │
│  - Validates session                                    │
│  - Checks role permissions                              │
│  - Validates resource ownership                         │
│  - Executes authorized queries only                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DATABASE (Supabase PostgreSQL)                         │
│  - Accessed via Drizzle ORM                             │
│  - Connection string in server environment only         │
│  - Never exposed to client                              │
└─────────────────────────────────────────────────────────┘
```

### Why RLS is Not Needed

1. **No Direct Database Access**: Clients never query the database directly
2. **Server-Side Only**: All database operations happen server-side
3. **Validated Queries**: Every query is pre-validated by application logic
4. **Single Entry Point**: All data access goes through authenticated API routes

### When RLS Would Be Needed

RLS would be necessary if:
- ❌ Using Supabase client-side SDK (`@supabase/supabase-js`)
- ❌ Using PostgREST for direct database queries
- ❌ Exposing `SUPABASE_ANON_KEY` to client-side code
- ❌ Allowing client-side database queries

**We do NONE of these things.**

---

## Security Verification Checklist

### ✅ Current Security Measures

- [x] All API routes validate authentication
- [x] Role-based access control implemented
- [x] Resource ownership validation
- [x] Middleware protects all routes
- [x] JWT tokens in HTTP-only cookies
- [x] Secure cookies in production
- [x] Database connection string server-side only
- [x] No Supabase client SDK in use
- [x] Rate limiting on API routes
- [x] Audit logging for sensitive operations
- [x] Input validation with Zod schemas
- [x] SQL injection protection (Drizzle ORM)
- [x] XSS protection (Content Security Policy)
- [x] CSRF protection (SameSite cookies)

### 🔒 Additional Security Layers

**Rate Limiting** (`src/middleware.ts`):
```typescript
const RATE_LIMITS = {
  general: { maxAttempts: 200, windowSeconds: 60 },
  bidding: { maxAttempts: 20, windowSeconds: 60 },
  api: { maxAttempts: 200, windowSeconds: 60 },
};
```

**Security Headers**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy (CSP)
- Permissions-Policy

**Audit Logging**:
- All sensitive operations logged
- User ID, IP address, timestamp tracked
- Before/after state captured
- Immutable audit trail

---

## Defense-in-Depth: Optional RLS Implementation

While not required, RLS can be added as an extra security layer.

### Benefits of Adding RLS

1. **Defense if DATABASE_URL is exposed**: Extra protection layer
2. **Compliance requirements**: Some regulations require database-level security
3. **Multi-tenant isolation**: Additional guarantee of data separation
4. **Audit requirements**: Some auditors prefer database-level controls

### Drawbacks of Adding RLS

1. **Complexity**: Duplicate authorization logic (app + database)
2. **Maintenance**: Two places to update permissions
3. **Performance**: Additional database overhead
4. **Debugging**: Harder to troubleshoot permission issues
5. **Not needed**: Our architecture doesn't require it

### Recommendation

**For current architecture**: RLS is NOT necessary and adds unnecessary complexity.

**Consider RLS if**:
- Regulatory compliance requires it
- Adding Supabase client-side features
- Multiple applications access same database
- Audit requirements demand it

---

## Security Best Practices Currently Implemented

### 1. Principle of Least Privilege
- Users only access their own resources
- Role-based permissions enforced
- Vendors isolated from each other

### 2. Defense in Depth
- Multiple security layers (middleware + API guards)
- Rate limiting prevents abuse
- Audit logging tracks all actions

### 3. Secure by Default
- Authentication required by default
- Explicit authorization checks
- Fail-safe error handling

### 4. Input Validation
- Zod schemas validate all inputs
- SQL injection prevented by ORM
- XSS prevented by React + CSP

### 5. Secure Communication
- HTTPS enforced in production
- Secure cookies with HttpOnly flag
- SameSite cookie protection

---

## Monitoring and Incident Response

### Current Monitoring

1. **Audit Logs**: All sensitive operations logged to database
2. **Error Tracking**: Console errors logged (consider adding Sentry)
3. **Rate Limiting**: Automatic blocking of excessive requests

### Recommended Additions

1. **Security Monitoring Tool**: Snyk, Socket.dev, or Dependabot
2. **Runtime Protection**: Consider Arcjet or similar
3. **Log Aggregation**: CloudWatch, Datadog, or LogRocket
4. **Alerting**: Set up alerts for suspicious activity

---

## Conclusion

### Supabase RLS Warning: Action Required

**Recommended Action**: Acknowledge and dismiss the warning in Supabase dashboard.

**Reasoning**:
1. Our architecture doesn't use Supabase client-side features
2. All database access is server-side through authenticated API routes
3. Application-level security is properly implemented
4. RLS would be redundant and add unnecessary complexity

### Security Posture: STRONG ✅

The application has robust security through:
- Comprehensive authentication (NextAuth.js)
- Multi-layer authorization (middleware + API guards)
- Resource ownership validation
- Rate limiting and audit logging
- Security headers and CSP

### Next Steps

1. ✅ Dismiss Supabase RLS warning (false positive)
2. 📋 Consider adding security monitoring tool (Snyk/Socket.dev)
3. 📋 Set up automated dependency scanning
4. 📋 Implement runtime security monitoring (optional)
5. 📋 Regular security audits (quarterly recommended)

---

## References

- NextAuth.js Documentation: https://next-auth.js.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- Next.js Security: https://nextjs.org/docs/app/building-your-application/configuring/security

---

**Document Version**: 1.0  
**Last Updated**: March 25, 2026  
**Next Review**: June 25, 2026
