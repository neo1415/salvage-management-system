# Vendor Registration Fee System - Implementation Complete

## Summary

Successfully implemented a vendor registration fee system that charges ₦12,500 AFTER Tier 1 KYC (BVN verification) but BEFORE Tier 2 KYC access. The implementation follows existing codebase patterns and integrates seamlessly with the current Paystack payment flow.

---

## What Was Implemented

### 1. Database Changes

**Migration File:** `src/lib/db/migrations/0030_add_vendor_registration_fee.sql`

- Added 4 new columns to `vendors` table:
  - `registration_fee_paid` (boolean, default: false)
  - `registration_fee_amount` (numeric)
  - `registration_fee_paid_at` (timestamp)
  - `registration_fee_reference` (varchar)
- Made `auction_id` nullable in `payments` table (for registration fees)
- Added indexes for performance
- Backfilled existing vendors (grandfathered in, no payment required)

**Schema Updates:**
- `src/lib/db/schema/vendors.ts` - Added registration fee columns
- `src/lib/db/schema/payments.ts` - Made auctionId nullable

### 2. Registration Fee Service

**File:** `src/features/vendors/services/registration-fee.service.ts`

**Key Methods:**
- `initializeRegistrationFeePayment()` - Creates payment and initializes Paystack
- `handleRegistrationFeeWebhook()` - Processes webhook and updates vendor status
- `checkRegistrationFeePaid()` - Checks if vendor has paid
- `generatePaymentReference()` - Creates unique reference (REG-{vendorId}-{timestamp})

**Features:**
- Idempotency protection (prevents duplicate payments)
- Atomic transactions (payment + vendor update)
- Email + SMS notifications
- Error handling and rollback

### 3. API Endpoints

**POST /api/vendors/registration-fee/initialize**
- Initializes registration fee payment
- Checks BVN verification status
- Creates Paystack transaction
- Returns authorization URL

**GET /api/vendors/registration-fee/status**
- Returns payment status for current vendor
- Shows amount, paid date, reference

### 4. Webhook Integration

**File:** `src/app/api/webhooks/paystack/route.ts` (UPDATED)

Added handler for `REG-*` payment references:
```typescript
if (reference.startsWith('REG-')) {
  await registrationFeeService.handleRegistrationFeeWebhook(reference, true);
}
```

---

## Payment Flow

```
1. User completes Tier 1 KYC (BVN verification)
   ↓
2. User clicks "Pay Registration Fee" button
   ↓
3. POST /api/vendors/registration-fee/initialize
   ├─ Creates pending payment record (auctionId = null)
   ├─ Generates reference: REG-{vendorId}-{timestamp}
   ├─ Initializes Paystack transaction
   └─ Returns authorization URL
   ↓
4. User redirected to Paystack payment page
   ↓
5. User completes payment
   ↓
6. Paystack sends webhook to /api/webhooks/paystack
   ├─ Verifies signature
   ├─ Routes to registration fee handler (REG-* pattern)
   ├─ Updates payment status: verified
   ├─ Updates vendor: registrationFeePaid = true
   ├─ Sends SMS + Email notifications
   └─ Returns success
   ↓
7. User redirected back to app
   ↓
8. User can now access Tier 2 KYC ✅
```

---

## Files Created (7)

1. `src/lib/db/migrations/0030_add_vendor_registration_fee.sql`
2. `src/features/vendors/services/registration-fee.service.ts`
3. `src/app/api/vendors/registration-fee/initialize/route.ts`
4. `src/app/api/vendors/registration-fee/status/route.ts`
5. `docs/VENDOR_REGISTRATION_FEE_INVESTIGATION_COMPLETE.md`
6. `docs/VENDOR_REGISTRATION_FEE_IMPLEMENTATION_COMPLETE.md`
7. `scripts/investigate-vendor-registration-fee.ts` (diagnostic)

## Files Modified (3)

1. `src/lib/db/schema/vendors.ts` - Added registration fee columns
2. `src/lib/db/schema/payments.ts` - Made auctionId nullable
3. `src/app/api/webhooks/paystack/route.ts` - Added REG- handler

---

## Next Steps (UI Implementation)

### 1. Create Payment Modal Component

**File:** `src/components/vendor/registration-fee-modal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegistrationFeeModal({ onClose }: { onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handlePayNow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vendors/registration-fee/initialize', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to initialize payment');
      }

      // Redirect to Paystack
      window.location.href = result.data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initialization failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Complete Your Registration
        </h2>
        
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600">✓</span>
            </div>
            <span className="text-gray-700">BVN Verified</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600">⏳</span>
            </div>
            <span className="text-gray-700">Registration Fee: ₦12,500</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">What You'll Unlock:</h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li className="flex items-start gap-2">
              <span>✓</span>
              <span>Access Tier 2 KYC verification</span>
            </li>
            <li className="flex items-start gap-2">
              <span>✓</span>
              <span>Unlimited bidding on high-value items</span>
            </li>
            <li className="flex items-start gap-2">
              <span>✓</span>
              <span>Priority customer support</span>
            </li>
            <li className="flex items-start gap-2">
              <span>✓</span>
              <span>Leaderboard eligibility</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Later
          </button>
          <button
            onClick={handlePayNow}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-[#FFD700] text-[#800020] font-bold rounded-lg hover:bg-[#FFC700] disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. Update Tier 1 KYC Success Page

**File:** `src/app/(dashboard)/vendor/kyc/tier1/page.tsx` (UPDATE)

Add modal trigger after BVN verification success:

```typescript
// After successful BVN verification
setSuccess(true);

// Show registration fee modal after 2 seconds
setTimeout(() => {
  setShowRegistrationFeeModal(true);
}, 2000);
```

### 3. Create Registration Fee Page

**File:** `src/app/(dashboard)/vendor/registration-fee/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegistrationFeeModal } from '@/components/vendor/registration-fee-modal';

export default function RegistrationFeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('payment');
  
  const [status, setStatus] = useState<'loading' | 'paid' | 'unpaid'>('loading');

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch('/api/vendors/registration-fee/status');
      const result = await response.json();
      
      if (result.data.paid) {
        setStatus('paid');
        // Redirect to Tier 2 KYC after 2 seconds
        setTimeout(() => {
          router.push('/vendor/kyc/tier2');
        }, 2000);
      } else {
        setStatus('unpaid');
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      setStatus('unpaid');
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-600 mb-4">
            ✅ Payment Confirmed!
          </h1>
          <p className="text-gray-700">
            Redirecting you to Tier 2 KYC...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <RegistrationFeeModal onClose={() => router.push('/vendor/dashboard')} />
    </div>
  );
}
```

### 4. Add Middleware Protection

**File:** `src/middleware.ts` (UPDATE)

```typescript
// Add this check before Tier 2 KYC access
if (pathname.startsWith('/vendor/kyc/tier2')) {
  const session = await auth();
  if (session?.user) {
    // Check if registration fee is paid
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vendors/registration-fee/status`, {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });
    
    const result = await response.json();
    
    if (!result.data.paid) {
      return NextResponse.redirect(new URL('/vendor/registration-fee', request.url));
    }
  }
}
```

### 5. Create Admin Dashboard

**File:** `src/app/(dashboard)/admin/registration-fees/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function AdminRegistrationFeesPage() {
  const [fees, setFees] = useState([]);
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalVendors: 0,
    averageAmount: 0,
  });

  useEffect(() => {
    fetchRegistrationFees();
  }, []);

  const fetchRegistrationFees = async () => {
    // Fetch from API
    // Display in table with:
    // - Vendor name
    // - Amount paid
    // - Payment date
    // - Reference
    // - Export to CSV button
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Registration Fees</h1>
      
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-gray-600">Total Collected</p>
          <p className="text-2xl font-bold">₦{stats.totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-gray-600">Total Vendors</p>
          <p className="text-2xl font-bold">{stats.totalVendors}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-gray-600">Average Amount</p>
          <p className="text-2xl font-bold">₦{stats.averageAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Vendor</th>
              <th className="px-6 py-3 text-left">Amount</th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Reference</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee: any) => (
              <tr key={fee.id} className="border-t">
                <td className="px-6 py-4">{fee.vendorName}</td>
                <td className="px-6 py-4">₦{fee.amount.toLocaleString()}</td>
                <td className="px-6 py-4">{new Date(fee.paidAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 font-mono text-sm">{fee.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Testing

### 1. Run Database Migration

```bash
# Apply migration
psql -U postgres -d salvage_db -f src/lib/db/migrations/0030_add_vendor_registration_fee.sql

# Verify columns added
psql -U postgres -d salvage_db -c "\d vendors"
```

### 2. Test Payment Flow

```bash
# 1. Complete Tier 1 KYC (BVN verification)
# 2. Click "Pay Registration Fee"
# 3. Complete payment on Paystack test page
# 4. Verify webhook received
# 5. Check vendor.registrationFeePaid = true
# 6. Access Tier 2 KYC page
```

### 3. Test Webhook

```bash
# Use ngrok to expose local server
ngrok http 3000

# Update Paystack webhook URL to ngrok URL
# Test payment and verify webhook processing
```

---

## Environment Variables

Add to `.env`:

```bash
# Registration fee amount (in Naira)
REGISTRATION_FEE_AMOUNT=12500
```

---

## Security Checklist

- ✅ Webhook signature verification
- ✅ Idempotency protection
- ✅ SQL injection prevention (Drizzle ORM)
- ✅ XSS prevention (HTML escaping)
- ✅ CSRF protection (NextAuth)
- ✅ Atomic transactions
- ✅ Audit logging
- ✅ Error handling

---

## Rollback Instructions

If issues arise, run:

```sql
-- Rollback migration
ALTER TABLE vendors DROP COLUMN registration_fee_paid;
ALTER TABLE vendors DROP COLUMN registration_fee_amount;
ALTER TABLE vendors DROP COLUMN registration_fee_paid_at;
ALTER TABLE vendors DROP COLUMN registration_fee_reference;
ALTER TABLE payments ALTER COLUMN auction_id SET NOT NULL;
DROP INDEX IF EXISTS idx_vendors_registration_fee_paid;
DROP INDEX IF EXISTS idx_vendors_registration_fee_reference;
DROP INDEX IF EXISTS idx_payments_registration_fee;
```

---

## Success Metrics

Track these metrics:

1. **Payment Conversion Rate:** % of vendors who pay after BVN verification
2. **Average Time to Payment:** Time between BVN verification and fee payment
3. **Payment Success Rate:** % of successful Paystack transactions
4. **Tier 2 Completion Rate:** % of vendors who complete Tier 2 after paying
5. **Revenue Generated:** Total registration fees collected

---

## Status

**Backend Implementation:** ✅ COMPLETE  
**Frontend Implementation:** ⏳ PENDING (UI components needed)  
**Testing:** ⏳ PENDING  
**Deployment:** ⏳ PENDING

**Estimated Time to Complete UI:** 2-3 hours  
**Total Implementation Time:** 4-5 hours (backend complete)

---

## Support

For questions or issues:
- Check logs: `console.log` statements throughout
- Verify webhook: Check Paystack dashboard
- Test locally: Use Paystack test keys
- Debug: Use diagnostic scripts in `scripts/` folder

