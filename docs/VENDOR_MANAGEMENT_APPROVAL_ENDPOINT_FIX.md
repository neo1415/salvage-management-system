# Vendor Management Approval Endpoint - Import Fix

## Problem

Build error when trying to approve vendors:
```
Module not found: Can't resolve '@/lib/email/send'
Module not found: Can't resolve '@/lib/sms/send'
```

## Root Cause

The approval endpoint (`src/app/api/vendors/[id]/approve/route.ts`) was using incorrect import paths for email and SMS services. The correct services are located in `@/features/notifications/services/`.

## Solution

Updated the imports to use the correct notification services:

### Before (Incorrect)
```typescript
import { sendEmail } from '@/lib/email/send';
import { sendSMS } from '@/lib/sms/send';
```

### After (Correct)
```typescript
import { emailService } from '@/features/notifications/services/email.service';
import { smsService } from '@/features/notifications/services/sms.service';
```

### Updated Function Calls

**Email Service:**
```typescript
// Before
await sendEmail({ to, subject, html });

// After
await emailService.sendEmail({ to, subject, html });
```

**SMS Service:**
```typescript
// Before
await sendSMS({ to, message });

// After
await smsService.sendSMS({ to, message });
```

## Files Modified

- `src/app/api/vendors/[id]/approve/route.ts`

## Testing

1. Restart the development server
2. Navigate to `/manager/vendors`
3. Click on a vendor to review
4. Try approving or rejecting the vendor
5. Verify that email and SMS notifications are sent

## Related Files

- `src/features/notifications/services/email.service.ts` - Email service implementation
- `src/features/notifications/services/sms.service.ts` - SMS service implementation

## Status

✅ **FIXED** - Build error resolved, imports corrected
