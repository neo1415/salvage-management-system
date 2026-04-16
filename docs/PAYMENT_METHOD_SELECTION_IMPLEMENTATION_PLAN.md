# Payment Method Selection Implementation Plan

## Current Issue Summary

After signing documents, the system automatically deducts the full payment (₦230k) from the vendor's wallet without giving them a choice of payment method. This violates Requirements 13-16 of the auction deposit spec.

## What Should Happen (Per Spec)

After signing documents, vendor should see a payment modal with 3 options:
1. **Wallet Only** - Pay remaining amount from wallet (if balance sufficient)
2. **Paystack Only** - Pay remaining amount via card/bank transfer
3. **Hybrid** - Use available wallet balance + Paystack for remainder

## Root Cause

**File:** `src/features/documents/services/document.service.ts`
**Function:** `triggerFundReleaseOnDocumentCompletion()` (line 877-1150)

When all documents are signed, this function:
1. ✅ Checks if all documents signed
2. ❌ Immediately calls `escrowService.releaseFunds()` - auto-deducts from wallet
3. ❌ No payment modal shown
4. ❌ No vendor choice recorded

## Implementation Plan

### Phase 1: Update Document Signing Flow (2-3 hours)

**File:** `src/features/documents/services/document.service.ts`

**Current Code (line ~897):**
```typescript
console.log(`✅ All documents signed for auction ${auctionId}. Proceeding with fund release...`);
await escrowService.releaseFunds(vendorId, amount, auctionId, userId);
```

**New Code:**
```typescript
console.log(`✅ All documents signed for auction ${auctionId}. Updating status to awaiting_payment...`);

// Update auction status to awaiting_payment
await db
  .update(auctions)
  .set({ 
    status: 'awaiting_payment',
    updatedAt: new Date()
  })
  .where(eq(auctions.id, auctionId));

// Update payment status to awaiting_method_selection
await db
  .update(payments)
  .set({
    status: 'awaiting_method_selection',
    updatedAt: new Date()
  })
  .where(eq(payments.id, payment.id));

// Send notification to vendor to choose payment method
const { createNotification } = await import('@/features/notifications/services/notification.service');
await createNotification({
  userId,
  type: 'PAYMENT_METHOD_SELECTION_REQUIRED',
  title: 'Choose Payment Method',
  message: `All documents signed! Choose how to pay the remaining ₦${(amount - depositAmount).toLocaleString()}`,
  data: {
    auctionId,
    paymentId: payment.id,
    remainingAmount: amount - depositAmount,
  },
});

console.log(`✅ Vendor notified to choose payment method for auction ${auctionId}`);
```

### Phase 2: Create Payment Options Modal Component (3-4 hours)

**File:** `src/components/vendor/payment-method-modal.tsx` (NEW)

**Features:**
- Display final bid amount
- Display deposit already committed
- Calculate remaining amount (bid - deposit)
- Show vendor's available wallet balance
- 3 radio button options:
  - Wallet Only (disabled if balance < remaining)
  - Paystack Only (always enabled)
  - Hybrid (show calculation: wallet portion + Paystack portion)
- Submit button triggers payment API

**Component Structure:**
```typescript
interface PaymentMethodModalProps {
  auctionId: string;
  paymentId: string;
  finalBid: number;
  depositAmount: number;
  availableBalance: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentMethodModal({
  auctionId,
  paymentId,
  finalBid,
  depositAmount,
  availableBalance,
  onSuccess,
  onCancel
}: PaymentMethodModalProps) {
  const remainingAmount = finalBid - depositAmount;
  const [selectedMethod, setSelectedMethod] = useState<'wallet' | 'paystack' | 'hybrid'>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);

  const walletPortion = Math.min(availableBalance, remainingAmount);
  const paystackPortion = remainingAmount - walletPortion;

  const canUseWalletOnly = availableBalance >= remainingAmount;

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/payment/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          method: selectedMethod,
        }),
      });

      if (!response.ok) throw new Error('Payment failed');

      const result = await response.json();

      if (selectedMethod === 'wallet') {
        // Wallet payment complete
        onSuccess();
      } else {
        // Redirect to Paystack
        window.location.href = result.paystackUrl;
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Payment Method</DialogTitle>
          <DialogDescription>
            Select how you'd like to pay the remaining amount
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Final Bid:</span>
              <span className="font-semibold">₦{finalBid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Deposit (frozen):</span>
              <span className="text-green-600">-₦{depositAmount.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Remaining to Pay:</span>
              <span className="font-bold text-lg">₦{remainingAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Available Wallet Balance:</span>
              <span className="font-semibold">₦{availableBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Options */}
          <RadioGroup value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as any)}>
            {/* Wallet Only */}
            <div className={`border rounded-lg p-4 ${!canUseWalletOnly ? 'opacity-50' : ''}`}>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="wallet" disabled={!canUseWalletOnly} />
                <div className="flex-1">
                  <Label className="font-semibold">Wallet Only</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Pay ₦{remainingAmount.toLocaleString()} from your wallet
                  </p>
                  {!canUseWalletOnly && (
                    <p className="text-sm text-red-600 mt-1">
                      Insufficient balance (need ₦{(remainingAmount - availableBalance).toLocaleString()} more)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Paystack Only */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="paystack" />
                <div className="flex-1">
                  <Label className="font-semibold">Paystack Only</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Pay ₦{remainingAmount.toLocaleString()} via card or bank transfer
                  </p>
                </div>
              </div>
            </div>

            {/* Hybrid */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="hybrid" />
                <div className="flex-1">
                  <Label className="font-semibold">Hybrid Payment</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Use wallet balance + Paystack for remainder
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">From wallet:</span>
                      <span className="font-medium">₦{walletPortion.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Via Paystack:</span>
                      <span className="font-medium">₦{paystackPortion.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Proceed to Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 3: Create Payment Processing API (3-4 hours)

**File:** `src/app/api/auctions/[id]/payment/process/route.ts` (NEW or UPDATE)

**Endpoint:** `POST /api/auctions/[id]/payment/process`

**Request Body:**
```typescript
{
  paymentId: string;
  method: 'wallet' | 'paystack' | 'hybrid';
}
```

**Logic:**
```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auctionId = params.id;
    const { paymentId, method } = await request.json();

    // Validate payment exists and belongs to user
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.auctionId, auctionId)
        )
      )
      .limit(1);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Get vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendor || vendor.id !== payment.vendorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get deposit amount from bids
    const [bid] = await db
      .select()
      .from(bids)
      .where(
        and(
          eq(bids.auctionId, auctionId),
          eq(bids.vendorId, vendor.id),
          eq(bids.status, 'winning')
        )
      )
      .orderBy(desc(bids.createdAt))
      .limit(1);

    if (!bid) {
      return NextResponse.json({ error: 'Winning bid not found' }, { status: 404 });
    }

    const finalBid = parseFloat(payment.amount);
    const depositAmount = parseFloat(bid.depositAmount || '0');
    const remainingAmount = finalBid - depositAmount;

    // Process based on method
    switch (method) {
      case 'wallet':
        return await processWalletPayment(
          auctionId,
          paymentId,
          vendor.id,
          session.user.id,
          remainingAmount,
          depositAmount
        );

      case 'paystack':
        return await processPaystackPayment(
          auctionId,
          paymentId,
          vendor.id,
          session.user.id,
          remainingAmount,
          depositAmount
        );

      case 'hybrid':
        return await processHybridPayment(
          auctionId,
          paymentId,
          vendor.id,
          session.user.id,
          remainingAmount,
          depositAmount
        );

      default:
        return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}

async function processWalletPayment(
  auctionId: string,
  paymentId: string,
  vendorId: string,
  userId: string,
  remainingAmount: number,
  depositAmount: number
) {
  // Verify sufficient balance
  const [wallet] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const availableBalance = parseFloat(wallet.availableBalance || '0');
  if (availableBalance < remainingAmount) {
    return NextResponse.json(
      { error: 'Insufficient wallet balance' },
      { status: 400 }
    );
  }

  // Release funds (deduct remaining + unfreeze deposit)
  const { escrowService } = await import('@/features/payments/services/escrow.service');
  await escrowService.releaseFunds(
    vendorId,
    remainingAmount + depositAmount,
    auctionId,
    userId
  );

  // Update payment status
  await db
    .update(payments)
    .set({
      status: 'verified',
      escrowStatus: 'released',
      verifiedAt: new Date(),
      paymentMethod: 'wallet',
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));

  // Update auction and case status
  await completePaymentFlow(auctionId, paymentId, vendorId, userId);

  return NextResponse.json({
    success: true,
    method: 'wallet',
    message: 'Payment completed successfully',
  });
}

async function processPaystackPayment(
  auctionId: string,
  paymentId: string,
  vendorId: string,
  userId: string,
  remainingAmount: number,
  depositAmount: number
) {
  // Initialize Paystack transaction
  const paystackService = await import('@/lib/integrations/paystack');
  
  const transaction = await paystackService.initializeTransaction({
    email: session.user.email,
    amount: remainingAmount * 100, // Convert to kobo
    reference: `PAY_${paymentId}_${Date.now()}`,
    metadata: {
      auctionId,
      paymentId,
      vendorId,
      depositAmount,
      paymentMethod: 'paystack',
    },
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/auctions/${auctionId}/payment/callback`,
  });

  // Update payment with Paystack reference
  await db
    .update(payments)
    .set({
      paymentReference: transaction.reference,
      paymentMethod: 'paystack',
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));

  return NextResponse.json({
    success: true,
    method: 'paystack',
    paystackUrl: transaction.authorization_url,
    reference: transaction.reference,
  });
}

async function processHybridPayment(
  auctionId: string,
  paymentId: string,
  vendorId: string,
  userId: string,
  remainingAmount: number,
  depositAmount: number
) {
  // Get available wallet balance
  const [wallet] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const availableBalance = parseFloat(wallet.availableBalance || '0');
  const walletPortion = Math.min(availableBalance, remainingAmount);
  const paystackPortion = remainingAmount - walletPortion;

  // Deduct wallet portion
  await db
    .update(vendors)
    .set({
      availableBalance: (availableBalance - walletPortion).toString(),
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendorId));

  // Initialize Paystack for remainder
  const paystackService = await import('@/lib/integrations/paystack');
  
  const transaction = await paystackService.initializeTransaction({
    email: session.user.email,
    amount: paystackPortion * 100, // Convert to kobo
    reference: `PAY_${paymentId}_${Date.now()}`,
    metadata: {
      auctionId,
      paymentId,
      vendorId,
      depositAmount,
      walletPortion,
      paystackPortion,
      paymentMethod: 'hybrid',
    },
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/auctions/${auctionId}/payment/callback`,
  });

  // Update payment with hybrid details
  await db
    .update(payments)
    .set({
      paymentReference: transaction.reference,
      paymentMethod: 'hybrid',
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));

  return NextResponse.json({
    success: true,
    method: 'hybrid',
    walletPortion,
    paystackPortion,
    paystackUrl: transaction.authorization_url,
    reference: transaction.reference,
  });
}

async function completePaymentFlow(
  auctionId: string,
  paymentId: string,
  vendorId: string,
  userId: string
) {
  // Update case status to sold
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (auction) {
    await db
      .update(salvageCases)
      .set({
        status: 'sold',
        updatedAt: new Date(),
      })
      .where(eq(salvageCases.id, auction.caseId));
  }

  // Generate and send pickup authorization
  const pickupAuthCode = `AUTH-${auctionId.substring(0, 8).toUpperCase()}`;
  
  // Send notifications (SMS, Email, Push) with pickup code
  // ... (same as current implementation)
}
```

### Phase 4: Paystack Webhook Handler (2-3 hours)

**File:** `src/app/api/webhooks/paystack/route.ts` (UPDATE)

**Add handling for:**
- Paystack payment success → Unfreeze deposit, mark payment verified
- Paystack payment failure → Refund wallet portion (for hybrid), allow retry
- Duplicate webhook prevention (idempotency)

### Phase 5: Update Vendor Auction Detail Page (2-3 hours)

**File:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Add:**
- Check if auction status is 'awaiting_payment'
- Show PaymentMethodModal when status is 'awaiting_payment'
- Handle payment success/failure
- Show appropriate messages

## Testing Checklist

### Scenario 1: Wallet-Only Payment
- [ ] Vendor has ₦200k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] "Wallet Only" is enabled (balance sufficient)
- [ ] Selects "Wallet Only"
- [ ] System deducts ₦130k from wallet
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO
- [ ] Vendor receives pickup code

### Scenario 2: Paystack-Only Payment
- [ ] Vendor has ₦50k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] "Wallet Only" is disabled (balance insufficient)
- [ ] Selects "Paystack Only"
- [ ] Redirected to Paystack payment page
- [ ] Pays ₦130k via card
- [ ] Webhook received and processed
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO
- [ ] Vendor receives pickup code

### Scenario 3: Hybrid Payment
- [ ] Vendor has ₦80k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] Selects "Hybrid"
- [ ] Modal shows: "₦80k from wallet + ₦50k via Paystack"
- [ ] System deducts ₦80k from wallet
- [ ] Redirected to Paystack for ₦50k
- [ ] Pays ₦50k via card
- [ ] Webhook received and processed
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO
- [ ] Vendor receives pickup code

### Scenario 4: Paystack Failure Handling
- [ ] Vendor selects Paystack or Hybrid
- [ ] Paystack payment fails
- [ ] If Hybrid: wallet portion refunded
- [ ] Vendor can retry payment
- [ ] No penalty applied
- [ ] Deposit remains frozen

## Estimated Effort

- Phase 1: Update document signing flow: 2-3 hours
- Phase 2: Payment options modal: 3-4 hours
- Phase 3: Payment processing API: 3-4 hours
- Phase 4: Paystack webhook: 2-3 hours
- Phase 5: Update vendor page: 2-3 hours
- Testing all scenarios: 2-3 hours

**Total: 14-20 hours**

## Dependencies

- Paystack API credentials configured in `.env`
- Paystack webhook endpoint set up and verified
- Payment verification logic implemented
- Refund logic for failed hybrid payments
- Proper error handling and retry logic

## Recommendation

This is a significant feature implementation that requires:
1. New UI components (payment modal)
2. New API endpoints (payment processing)
3. Paystack integration and testing
4. Comprehensive E2E testing
5. Proper error handling and retry logic

**DO NOT** attempt to quick-fix this in the current session. Create a new task/ticket:

**Task Title:** "Implement Payment Method Selection Modal (Requirements 13-16)"

**Priority:** HIGH (Spec violation affecting all auction payments)

**Assignee:** Backend + Frontend developer

**Sprint:** Next sprint (2-3 days of focused work)

## Current Workaround

The current implementation works but doesn't give vendors choice:
- ✅ Payment is processed correctly
- ✅ Funds are transferred to Finance Officer
- ✅ Vendor receives pickup code
- ❌ No payment method selection
- ❌ Cannot use Paystack
- ❌ Cannot split payment (hybrid)

Vendors can still complete purchases, but they're forced to use wallet-only payment.

## Date Created

April 10, 2026

## Created By

Kiro AI Assistant
