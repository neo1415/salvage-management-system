# Force Password Change for New Staff Accounts - Implementation Plan

## Overview
When an admin creates a new staff account (adjuster, manager, finance, admin), the user should be forced to change their password on first login for security reasons.

## Status
**DOCUMENTED - NOT YET IMPLEMENTED**

This is a lower priority feature that has been documented for future implementation.

---

## Implementation Steps

### 1. Database Schema Changes

Add `requiresPasswordChange` field to the `users` table:

```sql
-- Migration: Add requiresPasswordChange field
ALTER TABLE users 
ADD COLUMN requires_password_change BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX idx_users_requires_password_change 
ON users(requires_password_change) 
WHERE requires_password_change = TRUE;
```

Update the Drizzle schema in `src/lib/db/schema/users.ts`:

```typescript
export const users = pgTable('users', {
  // ... existing fields ...
  requiresPasswordChange: boolean('requires_password_change').default(false),
});
```

### 2. Admin User Creation API Update

Modify `src/app/api/admin/users/route.ts` to set `requiresPasswordChange: true` when creating staff accounts:

```typescript
// In POST handler
const newUser = await db.insert(users).values({
  // ... existing fields ...
  requiresPasswordChange: true, // Force password change for new staff
}).returning();

// Send email notification
await sendPasswordChangeRequiredEmail(newUser.email, temporaryPassword);
```

### 3. Middleware Check

Update `src/middleware.ts` to check for `requiresPasswordChange` and redirect:

```typescript
// After authentication check
if (session?.user) {
  const user = await getUserById(session.user.id);
  
  if (user?.requiresPasswordChange && !request.nextUrl.pathname.startsWith('/auth/change-password')) {
    return NextResponse.redirect(new URL('/auth/change-password', request.url));
  }
}
```

### 4. Change Password Page

Create `src/app/(auth)/change-password/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/components/ui/toast';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change password');
      }

      toast.success('Password changed successfully', 'You can now access your account.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Change Your Password</h1>
          <p className="mt-2 text-gray-600">
            For security reasons, you must change your password before accessing your account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              {...register('currentPassword')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              placeholder="Enter current password"
            />
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              {...register('newPassword')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              placeholder="Enter new password"
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              {...register('confirmPassword')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              placeholder="Confirm new password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] disabled:bg-gray-400 transition-colors"
          >
            {isSubmitting ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 5. Update Change Password API

Modify `src/app/api/auth/change-password/route.ts` to clear the `requiresPasswordChange` flag:

```typescript
// After successful password change
await db.update(users)
  .set({
    password: hashedPassword,
    requiresPasswordChange: false, // Clear the flag
    updatedAt: new Date(),
  })
  .where(eq(users.id, session.user.id));
```

### 6. Email Notification

Create email template `src/features/notifications/templates/password-change-required.template.ts`:

```typescript
import { baseEmailTemplate } from './base.template';

export function passwordChangeRequiredTemplate(
  userName: string,
  temporaryPassword: string,
  loginUrl: string
): string {
  const content = `
    <h2 style="color: #800020; margin-bottom: 20px;">Welcome to Salvage Management System</h2>
    
    <p>Hello ${userName},</p>
    
    <p>Your account has been created by an administrator. For security reasons, you must change your password on first login.</p>
    
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Temporary Password:</strong></p>
      <p style="font-family: monospace; font-size: 18px; color: #800020; margin: 10px 0;">
        ${temporaryPassword}
      </p>
    </div>
    
    <p><strong>Important Security Notes:</strong></p>
    <ul>
      <li>This is a temporary password that must be changed on first login</li>
      <li>You will be redirected to change your password immediately after logging in</li>
      <li>Choose a strong password that meets our security requirements</li>
      <li>Never share your password with anyone</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" 
         style="background-color: #800020; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Login Now
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      If you did not expect this email or have any questions, please contact your administrator.
    </p>
  `;

  return baseEmailTemplate('Account Created - Password Change Required', content);
}
```

### 7. Testing Checklist

- [ ] Admin can create staff account with temporary password
- [ ] New staff user receives email with temporary password
- [ ] User is redirected to change password page on first login
- [ ] User cannot access other pages until password is changed
- [ ] Password validation works correctly (8+ chars, uppercase, lowercase, number, special char)
- [ ] After password change, user can access their dashboard
- [ ] `requiresPasswordChange` flag is cleared after successful change
- [ ] Audit log records password change event

---

## Security Considerations

1. **Temporary Password Generation**: Use cryptographically secure random password generator
2. **Password Complexity**: Enforce strong password requirements
3. **Email Security**: Send temporary password via secure email (consider expiry time)
4. **Audit Logging**: Log all password change events
5. **Session Management**: Invalidate old sessions after password change
6. **Rate Limiting**: Prevent brute force attacks on change password endpoint

---

## Future Enhancements

1. **Password Expiry**: Add password expiry after 90 days
2. **Password History**: Prevent reuse of last 5 passwords
3. **Two-Factor Authentication**: Add 2FA requirement for staff accounts
4. **Password Reset Link**: Send secure reset link instead of temporary password
5. **Account Lockout**: Lock account after multiple failed password change attempts

---

## Related Files

- `src/lib/db/schema/users.ts` - User schema
- `src/app/api/admin/users/route.ts` - Staff account creation
- `src/middleware.ts` - Authentication middleware
- `src/app/api/auth/change-password/route.ts` - Password change API
- `src/features/notifications/templates/` - Email templates

---

## Priority: LOW
This feature is documented for future implementation. Focus on Issues 1-3 first.
