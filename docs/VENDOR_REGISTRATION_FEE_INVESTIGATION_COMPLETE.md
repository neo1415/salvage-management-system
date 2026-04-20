# Vendor Registration Fee System - Investigation Complete

## Executive Summary

This document contains the complete investigation results for implementing a vendor registration fee system in the salvage auction marketplace. The fee will be charged AFTER Tier 1 KYC (BVN verification) but BEFORE Tier 2 KYC access.

---

## 1. Current Authentication & KYC Flow

### Registration Flow
```
1. User Registration (/api/auth/register)
   ├─ Creates user record (status: unverified_tier_0)
   ├─ Creates vendor record (tier: tier1_bvn, status: pending)
   ├─ Sends OTP for phone verification
   └─ Redirects to /verify-otp

2. Phone Verification (/verify-otp)
   ├─ User enters OTP
   ├─ Updates user status: phone_verified_tier_0
   └─ Redirects to /vendor/dashboard

3. Tier 1 KYC - BVN Verification (/vendor/kyc/tier1)
   ├─ User enters 11-digit BVN
   ├─ API: /api/vendors/verify-bvn
   ├─ Verifies BVN via Paystack Identity API
   ├─ Updates vendor: tier=tier1_bvn, status=approved, bvnVerifiedAt=now
   ├─ Updates user: status=verified_tier_1
   ├─ Sends SMS + Email notifications
   └─ Redirects to /vendor/dashboard
   
   ✅ REGISTRATION FEE GATE GOES HERE ✅

4. Tier 2 KYC - Full Verification (/vendor/kyc/tier2)
   ├─ Dojah widget for NIN, selfie, biometrics
   ├─ API: /api/kyc/complete
   ├─ Updates vendor: tier=tier2_full, tier2ApprovedAt=now
   ├─ Updates user: status=verified_tier_2
   └─ Unlocks unlimited bidding
```

---

## 2. Database Schema Analysis

### 2.1 Vendors Table (src/lib/db/schema/vendors.ts)

**Existing Columns:**
```typescript
- id: uuid (PK)
- userId: uuid (FK to users)
- businessName: varchar(255)
- tier: vendor_tier ('tier1_bvn' | 'tier2_full')
- status: vendor_status ('pending' | 'approved' | 'suspended')
- bvnEncrypted: varchar(255)
- bvnVerifiedAt: timestamp
- tier2ApprovedAt: timestamp
- ... (other KYC fields)
```

**NEW COLUMNS NEEDED:**
```typescript
- registrationFeePaid: boolean (default: false)
- registrationFeeAmount: numeric(12, 2)
- registrationFeePaidAt: timestamp
- registrationFeeReference: varchar(255) // Paystack reference
```

### 2.2 Users Table (src/lib/db/schema/users.ts)

**Status Enum:**
```typescript
'unverified_tier_0'      // After registration, before phone verification
'phone_verified_tier_0'  // After phone verification
'verified_tier_1'        // After BVN verification + REGISTRATION FEE
'verified_tier_2'        // After Tier 2 KYC
'suspended'
'deleted'
```

### 2.3 Payments Table (src/lib/db/schema/payments.ts)

**Current Structure:**
```typescript
- id: uuid (PK)
- auctionId: uuid (FK) // Will be NULL for registration fees
- vendorId: uuid (FK)
- amount: numeric(12, 2)
- paymentMethod: payment_method ('paystack' | 'flutterwave' | 'bank_transfer' | 'escrow_wallet')
- paymentReference: varchar(255)
- status: payment_status ('pending' | 'verified' | 'rejected' | 'overdue')
- createdAt: timestamp
- updatedAt: timestamp
```

**Note:** The payments table is currently auction-centric. We need to make `auctionId` nullable for registration fees.

---

## 3. Existing Paystack Integration Pattern

### 3.1 Payment Initialization Pattern

**Location:** `src/features/auction-deposit/services/payment.service.ts`

```typescript
async initializePaystackPayment(params) {
  // 1. Create pending payment record
  const [payment] = await db.insert(payments).values({
    auctionId,
    vendorId,
    amount: finalBid.toFixed(2),
    paymentMethod: 'paystack',
    paymentReference: idempotencyKey,
    status: 'pending',
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  // 2. Initialize Paystack transaction
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountInKobo, // Amount in kobo (₦ * 100)
      reference: idempotencyKey,
      callback_url: `${APP_URL}/vendor/auctions/${auctionId}?payment=success`,
      metadata: {
        paymentId: payment.id,
        auctionId,
        vendorId,
        // ... other metadata
      },
    }),
  });

  // 3. Return authorization URL
  return {
    paymentId: payment.id,
    authorizationUrl: paystackData.data.authorization_url,
    accessCode: paystackData.data.access_code,
  };
}
```

### 3.2 Webhook Handler Pattern

**Location:** `src/app/api/webhooks/paystack/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Verify webhook signature
  const signature = request.headers.get('x-paystack-signature');
  const rawBody = await request.text();
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse payload
  const payload: PaystackWebhookPayload = JSON.parse(rawBody);
  
  // 3. Route based on reference pattern
  const reference = payload.data.reference;
  
  if (reference.startsWith('PAY-') || reference.startsWith('PAY_')) {
    // Auction payment
    await paymentService.handlePaystackWebhook(reference, true);
  } else if (reference.startsWith('WF-')) {
    // Wallet funding
    await processPaystackWebhook(payload, signature, rawBody);
  }
  // ADD: else if (reference.startsWith('REG-')) { ... }
  
  return NextResponse.json({ status: 'success' }, { status: 200 });
}
```

---

## 4. Implementation Plan

### Phase 1: Database Migration

**File:** `src/lib/db/migrations/0030_add_vendor_registration_fee.sql`

```sql
-- Add registration fee columns to vendors table
ALTER TABLE vendors
ADD COLUMN registration_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN registration_fee_amount NUMERIC(12, 2),
ADD COLUMN registration_fee_paid_at TIMESTAMP,
ADD COLUMN registration_fee_reference VARCHAR(255);

-- Make auctionId nullable in payments table (for registration fees)
ALTER TABLE payments
ALTER COLUMN auction_id DROP NOT NULL;

-- Add index for registration fee lookups
CREATE INDEX idx_vendors_registration_fee_paid ON vendors(registration_fee_paid);
CREATE INDEX idx_vendors_registration_fee_reference ON vendors(registration_fee_reference);

-- Add comment
COMMENT ON COLUMN vendors.registration_fee_paid IS 'Whether vendor has paid the one-time registration fee';
COMMENT ON COLUMN vendors.registration_fee_amount IS 'Amount paid for registration fee (₦10,000-15,000)';
COMMENT ON COLUMN vendors.registration_fee_paid_at IS 'Timestamp when registration fee was paid';
COMMENT ON COLUMN vendors.registration_fee_reference IS 'Paystack payment reference for registration fee';
```

### Phase 2: Schema Updates

**File:** `src/lib/db/schema/vendors.ts`

```typescript
export const vendors = pgTable('vendors', {
  // ... existing fields ...
  
  // Registration Fee
  registrationFeePaid: boolean('registration_fee_paid').notNull().default(false),
  registrationFeeAmount: numeric('registration_fee_amount', { precision: 12, scale: 2 }),
  registrationFeePaidAt: timestamp('registration_fee_paid_at'),
  registrationFeeReference: varchar('registration_fee_reference', { length: 255 }),
  
  // ... rest of fields ...
});
```

**File:** `src/lib/db/schema/payments.ts`

```typescript
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .references(() => auctions.id, { onDelete: 'cascade' }), // REMOVED .notNull()
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  // ... rest of fields ...
});
```

### Phase 3: Registration Fee Service

**File:** `src/features/vendors/services/registration-fee.service.ts`

```typescript
export class RegistrationFeeService {
  private readonly FEE_AMOUNT = 12500; // ₦12,500 (middle of ₦10k-15k range)
  
  async initializeRegistrationFeePayment(vendorId: string, userEmail: string): Promise<{
    paymentId: string;
    authorizationUrl: string;
    accessCode: string;
    amount: number;
  }>;
  
  async handleRegistrationFeeWebhook(reference: string, success: boolean): Promise<void>;
  
  async checkRegistrationFeePaid(vendorId: string): Promise<boolean>;
}
```

### Phase 4: API Endpoints

**File:** `src/app/api/vendors/registration-fee/initialize/route.ts`

```typescript
POST /api/vendors/registration-fee/initialize
- Checks if fee already paid
- Creates pending payment record (auctionId = null)
- Initializes Paystack transaction (reference: REG-{uuid})
- Returns authorization URL
```

**File:** `src/app/api/vendors/registration-fee/status/route.ts`

```typescript
GET /api/vendors/registration-fee/status
- Returns { paid: boolean, amount: number, paidAt: timestamp }
```

### Phase 5: Middleware Protection

**File:** `src/middleware.ts` (UPDATE)

```typescript
// Block Tier 2 KYC access if registration fee not paid
if (pathname.startsWith('/vendor/kyc/tier2')) {
  const vendor = await getVendor(session.user.id);
  if (!vendor.registrationFeePaid) {
    return NextResponse.redirect(new URL('/vendor/registration-fee', request.url));
  }
}
```

### Phase 6: UI Components

**File:** `src/app/(dashboard)/vendor/registration-fee/page.tsx`

```typescript
// Payment modal shown after Tier 1 KYC success
// Shows:
// - Fee amount (₦12,500)
// - Benefits of paying (access to Tier 2 KYC)
// - "Pay Now" button → Paystack modal
// - Payment status tracking
```

**File:** `src/components/vendor/registration-fee-gate.tsx`

```typescript
// Component to show on Tier 2 KYC page if fee not paid
// Redirects to payment page
```

### Phase 7: Webhook Update

**File:** `src/app/api/webhooks/paystack/route.ts` (UPDATE)

```typescript
// Add registration fee handler
if (reference.startsWith('REG-')) {
  await registrationFeeService.handleRegistrationFeeWebhook(reference, true);
}
```

### Phase 8: Admin Dashboard

**File:** `src/app/(dashboard)/admin/registration-fees/page.tsx`

```typescript
// Admin view to see:
// - Total registration fees collected
// - List of vendors who paid
// - Payment dates and references
// - Export to CSV
```

---

## 5. Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR REGISTRATION FLOW                  │
└─────────────────────────────────────────────────────────────┘

1. User Registration
   ↓
2. Phone Verification (OTP)
   ↓
3. Tier 1 KYC (BVN Verification)
   ↓
   ✅ BVN Verified Successfully
   ↓
   ┌─────────────────────────────────────────────────────────┐
   │         🚪 REGISTRATION FEE GATE (NEW)                  │
   │                                                          │
   │  Modal appears:                                         │
   │  "Complete Your Registration"                           │
   │                                                          │
   │  ✓ BVN Verified                                        │
   │  ⏳ Registration Fee: ₦12,500                          │
   │                                                          │
   │  Benefits:                                              │
   │  • Access Tier 2 KYC                                   │
   │  • Unlock unlimited bidding                            │
   │  • Priority support                                     │
   │                                                          │
   │  [Pay Now with Paystack] ──────────────────────┐       │
   └─────────────────────────────────────────────────│───────┘
                                                      │
                                                      ↓
                                            Paystack Payment Modal
                                                      │
                                                      ↓
                                            Payment Successful
                                                      │
                                                      ↓
                                            Webhook: REG-{uuid}
                                                      │
                                                      ↓
                                    Update vendor.registrationFeePaid = true
                                    Update vendor.registrationFeePaidAt = now
                                    Update vendor.registrationFeeReference
                                                      │
                                                      ↓
                                            Redirect to Dashboard
                                                      │
                                                      ↓
4. Tier 2 KYC Access Unlocked ✅
   (Middleware checks registrationFeePaid = true)
```

---

## 6. Key Implementation Details

### 6.1 Payment Reference Format

```typescript
// Registration fee payments
const reference = `REG-${vendorId.substring(0, 8)}-${Date.now()}`;
// Example: REG-a1b2c3d4-1704067200000
```

### 6.2 Idempotency

```typescript
// Check if payment already exists
const existingPayment = await db
  .select()
  .from(payments)
  .where(
    and(
      eq(payments.vendorId, vendorId),
      eq(payments.paymentReference, reference),
      isNull(payments.auctionId) // Registration fee payments have no auction
    )
  )
  .limit(1);
```

### 6.3 Cache Strategy

```typescript
// Cache registration fee status in Redis
const cacheKey = `vendor:${vendorId}:registration_fee_paid`;
await redis.set(cacheKey, 'true', { ex: 3600 }); // 1 hour TTL

// Check cache first in middleware
const cached = await redis.get(cacheKey);
if (cached === 'true') {
  return NextResponse.next(); // Allow access
}
```

### 6.4 Webhook Signature Verification

```typescript
// Same as existing auction payments
function verifySignature(payload: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/unit/vendors/registration-fee.service.test.ts
describe('RegistrationFeeService', () => {
  it('should initialize payment with correct amount');
  it('should handle webhook and update vendor record');
  it('should check payment status correctly');
  it('should prevent duplicate payments');
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/registration-fee-flow.test.ts
describe('Registration Fee Flow', () => {
  it('should complete full payment flow');
  it('should unlock Tier 2 KYC after payment');
  it('should block Tier 2 KYC without payment');
  it('should handle webhook correctly');
});
```

### 7.3 E2E Tests

```typescript
// tests/e2e/vendor-registration-fee.e2e.test.ts
describe('Vendor Registration Fee E2E', () => {
  it('should show payment modal after BVN verification');
  it('should redirect to Paystack payment page');
  it('should update status after successful payment');
  it('should allow Tier 2 KYC access after payment');
});
```

---

## 8. Environment Variables

```bash
# .env
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Registration fee amount (in Naira)
REGISTRATION_FEE_AMOUNT=12500
```

---

## 9. Security Considerations

1. **Webhook Signature Verification:** Always verify Paystack webhook signatures
2. **Idempotency:** Prevent duplicate payments using unique references
3. **SQL Injection:** Use parameterized queries (Drizzle ORM handles this)
4. **XSS Prevention:** Sanitize all user inputs
5. **CSRF Protection:** Use NextAuth CSRF tokens
6. **Rate Limiting:** Limit payment initialization attempts
7. **Audit Logging:** Log all payment attempts and status changes

---

## 10. Rollback Plan

If issues arise:

1. **Database Rollback:**
   ```sql
   -- Rollback migration
   ALTER TABLE vendors DROP COLUMN registration_fee_paid;
   ALTER TABLE vendors DROP COLUMN registration_fee_amount;
   ALTER TABLE vendors DROP COLUMN registration_fee_paid_at;
   ALTER TABLE vendors DROP COLUMN registration_fee_reference;
   ALTER TABLE payments ALTER COLUMN auction_id SET NOT NULL;
   ```

2. **Feature Flag:**
   ```typescript
   const REGISTRATION_FEE_ENABLED = process.env.REGISTRATION_FEE_ENABLED === 'true';
   ```

3. **Middleware Bypass:**
   ```typescript
   if (!REGISTRATION_FEE_ENABLED) {
     return NextResponse.next(); // Skip fee check
   }
   ```

---

## 11. Success Metrics

- **Payment Conversion Rate:** % of vendors who complete payment after BVN verification
- **Average Time to Payment:** Time between BVN verification and fee payment
- **Payment Success Rate:** % of successful Paystack transactions
- **Tier 2 KYC Completion Rate:** % of vendors who complete Tier 2 after paying fee
- **Revenue Generated:** Total registration fees collected

---

## 12. Next Steps

1. ✅ Investigation Complete
2. ⏳ Create database migration
3. ⏳ Update schema files
4. ⏳ Implement registration fee service
5. ⏳ Create API endpoints
6. ⏳ Add middleware protection
7. ⏳ Build UI components
8. ⏳ Update webhook handler
9. ⏳ Create admin dashboard
10. ⏳ Write tests
11. ⏳ Deploy to staging
12. ⏳ Test end-to-end
13. ⏳ Deploy to production

---

## 13. Files to Create/Modify

### New Files (9)
1. `src/lib/db/migrations/0030_add_vendor_registration_fee.sql`
2. `src/features/vendors/services/registration-fee.service.ts`
3. `src/app/api/vendors/registration-fee/initialize/route.ts`
4. `src/app/api/vendors/registration-fee/status/route.ts`
5. `src/app/(dashboard)/vendor/registration-fee/page.tsx`
6. `src/components/vendor/registration-fee-gate.tsx`
7. `src/app/(dashboard)/admin/registration-fees/page.tsx`
8. `tests/unit/vendors/registration-fee.service.test.ts`
9. `tests/integration/registration-fee-flow.test.ts`

### Modified Files (4)
1. `src/lib/db/schema/vendors.ts` - Add registration fee columns
2. `src/lib/db/schema/payments.ts` - Make auctionId nullable
3. `src/app/api/webhooks/paystack/route.ts` - Add REG- handler
4. `src/middleware.ts` - Add Tier 2 KYC protection

---

**Investigation Status:** ✅ COMPLETE  
**Ready for Implementation:** ✅ YES  
**Estimated Implementation Time:** 6-8 hours  
**Risk Level:** LOW (follows existing patterns)

