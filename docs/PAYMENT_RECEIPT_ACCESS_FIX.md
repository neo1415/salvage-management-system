# Payment Receipt Access Issues - Complete Fix

## Issues Identified

1. **404 Error on Payment Receipt Page** - `/api/payments/PAYMENT-*` returns 404
2. **401 Unauthorized Errors** - Multiple API calls failing with authentication errors
3. **Missing PWA Icons** - icon-192.png and other icons not found (404)
4. **Google Maps CSP Error** - Frame loading blocked by Content Security Policy

## Root Causes

### 1. Authentication Issue (401 Errors)
When users click the payment receipt link from their email, they may not be logged in. The payment details API route requires authentication:

```typescript
// src/app/api/payments/[id]/route.ts line 17-19
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Impact**: Users cannot view their payment receipt after winning an auction unless they're logged in.

### 2. Missing PWA Icons
The manifest.json references icons that don't exist:
- `/icons/icon-192.png` ❌
- `/icons/icon-512.png` ❌
- `/icons/icon-1024.png` ❌
- `/icons/icon-2048.png` ❌

Only exists: `/icons/Nem-insurance-Logo.jpg` ✓

### 3. Google Maps CSP Restriction
The Content Security Policy `frame-src` directive doesn't include Google Maps domains, causing the map embed to fail.

## Solutions

### Fix 1: Add Public Payment Receipt Route (Recommended)

Create a public payment receipt route that doesn't require authentication but uses a secure token:

```typescript
// src/app/api/payments/receipt/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    // Decode token to get payment ID
    // Token format: base64(paymentId:timestamp:signature)
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [paymentId, timestamp, signature] = decoded.split(':');
    
    // Verify signature
    const secret = process.env.PAYMENT_RECEIPT_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${paymentId}:${timestamp}`)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }
    
    // Check token expiry (30 days)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Token expired' }, { status: 403 });
    }
    
    // Fetch payment details (same as authenticated route)
    const [payment] = await db
      .select({
        payment: payments,
        // ... rest of the query
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    // Return payment details
    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment receipt:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve payment receipt' },
      { status: 500 }
    );
  }
}
```

### Fix 2: Generate Secure Receipt Tokens

Update the email template to use secure tokens:

```typescript
// src/features/notifications/templates/payment-confirmation.template.ts
// Add token generation helper
function generateReceiptToken(paymentId: string): string {
  const timestamp = Date.now().toString();
  const secret = process.env.PAYMENT_RECEIPT_SECRET || 'default-secret';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${paymentId}:${timestamp}`)
    .digest('hex');
  
  const token = Buffer.from(`${paymentId}:${timestamp}:${signature}`).toString('base64');
  return token;
}

// Update the link in the template (line 75)
const receiptToken = generateReceiptToken(paymentId);
<a href="${appUrl}/receipt/${receiptToken}">View Payment Receipt</a>
```

### Fix 3: Create PWA Icons

Generate the missing icons from the existing logo:

```bash
# Using ImageMagick or similar tool
convert public/icons/Nem-insurance-Logo.jpg -resize 192x192 public/icons/icon-192.png
convert public/icons/Nem-insurance-Logo.jpg -resize 512x512 public/icons/icon-512.png
convert public/icons/Nem-insurance-Logo.jpg -resize 1024x1024 public/icons/icon-1024.png
convert public/icons/Nem-insurance-Logo.jpg -resize 2048x2048 public/icons/icon-2048.png
```

Or use an online tool like https://realfavicongenerator.net/

### Fix 4: Update CSP for Google Maps ✅ DONE

Already fixed in `next.config.ts`:

```typescript
"frame-src 'self' ... https://www.google.com https://maps.google.com",
```

## Alternative Solution: Redirect to Login

If you prefer to keep authentication required, add a redirect to login with return URL:

```typescript
// src/app/(dashboard)/vendor/payments/[id]/page.tsx
useEffect(() => {
  if (!session) {
    // Redirect to login with return URL
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
  }
}, [session, router]);
```

## Implementation Priority

1. **High Priority**: Fix Google Maps CSP ✅ DONE
2. **High Priority**: Generate PWA icons (affects all users)
3. **High Priority**: Fix payment receipt access (affects auction winners)
4. **Medium Priority**: Add proper error messages for unauthenticated users

## Testing Checklist

- [ ] Win an auction and receive payment confirmation email
- [ ] Click "View Payment Receipt" link from email
- [ ] Verify receipt loads without 401 errors
- [ ] Check that Google Maps embed works on auction detail pages
- [ ] Verify PWA icons load correctly (check browser console)
- [ ] Test on mobile devices
- [ ] Test with logged-out users

## Environment Variables Needed

Add to `.env`:

```bash
# Secure token for public payment receipts
PAYMENT_RECEIPT_SECRET=your-secure-random-string-here
```

Generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
