# Design Document

## Overview

This feature completes the escrow wallet payment flow by automating fund release when vendors complete document signing. The design integrates with existing escrow wallet, document signing, and payment verification systems to create a seamless end-to-end payment experience.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Vendor Payment UI                         │
│  - Wallet payment confirmation                               │
│  - Document signing progress                                 │
│  - Pickup confirmation                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Document Signing Service                     │
│  - Track signing progress (X/3)                              │
│  - Trigger fund release on completion                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Escrow Service                             │
│  - releaseFunds() - Transfer to NEM Insurance                │
│  - Update wallet balances                                    │
│  - Create transaction records                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Paystack Transfers API                       │
│  - Transfer funds to NEM Insurance bank account              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Finance Officer Dashboard                       │
│  - View escrow payment status                                │
│  - Manual fund release                                       │
│  - Audit trail                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Vendor wins auction → Funds frozen (ALREADY WORKING)
2. Auction closes → Payment record created with escrow_wallet method (ALREADY WORKING)
3. Documents generated → 3 documents created (ALREADY WORKING)
4. Vendor accesses payment page → Shows "Confirm Payment from Wallet" (NEW)
5. Vendor confirms wallet payment → Payment status = 'wallet_confirmed' (NEW)
6. Vendor signs document 1 → Progress = 1/3 (NEW)
7. Vendor signs document 2 → Progress = 2/3 (NEW)
8. Vendor signs document 3 → Progress = 3/3, trigger fund release (NEW)
9. System calls releaseFunds() → Transfer via Paystack (NEW)
10. Payment verified → Pickup code generated (ALREADY WORKING)
11. Vendor confirms pickup → Admin confirms → Transaction complete (NEW)
```

## Database Schema Changes

### Payments Table (Existing - No Changes Needed)

```typescript
// src/lib/db/schema/payments.ts
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(), // 'paystack' | 'bank_transfer' | 'escrow_wallet'
  escrowStatus: text('escrow_status'), // 'frozen' | 'released' | 'failed'
  status: text('status').notNull(), // 'pending' | 'verified' | 'rejected'
  // ... other fields
});
```

### Release Forms Table (Existing - No Changes Needed)

```typescript
// src/lib/db/schema/release-forms.ts
export const releaseForms = pgTable('release_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  auctionId: uuid('auction_id').notNull(),
  vendorId: uuid('vendor_id').notNull(),
  documentType: text('document_type').notNull(), // 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization'
  status: text('status').notNull(), // 'pending' | 'signed' | 'voided'
  signedAt: timestamp('signed_at'),
  // ... other fields
});
```

### Auctions Table (Add pickup confirmation fields)

```typescript
// src/lib/db/schema/auctions.ts
export const auctions = pgTable('auctions', {
  // ... existing fields
  pickupConfirmedVendor: boolean('pickup_confirmed_vendor').default(false),
  pickupConfirmedVendorAt: timestamp('pickup_confirmed_vendor_at'),
  pickupConfirmedAdmin: boolean('pickup_confirmed_admin').default(false),
  pickupConfirmedAdminAt: timestamp('pickup_confirmed_admin_at'),
  pickupConfirmedAdminBy: uuid('pickup_confirmed_admin_by').references(() => users.id),
});
```

## API Endpoints

### 1. Confirm Wallet Payment

```typescript
// POST /api/payments/[id]/confirm-wallet
// Confirms vendor wants to pay from frozen wallet funds

interface ConfirmWalletPaymentRequest {
  vendorId: string;
}

interface ConfirmWalletPaymentResponse {
  success: boolean;
  payment: {
    id: string;
    status: 'wallet_confirmed';
    escrowStatus: 'frozen';
    amount: number;
  };
  documentsUrl: string;
}
```

### 2. Get Document Signing Progress

```typescript
// GET /api/auctions/[id]/documents/progress
// Returns document signing progress for an auction

interface DocumentProgressResponse {
  totalDocuments: number;
  signedDocuments: number;
  progress: number; // 0-100
  documents: Array<{
    id: string;
    type: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization';
    status: 'pending' | 'signed' | 'voided';
    signedAt: string | null;
  }>;
  allSigned: boolean;
}
```

### 3. Manual Fund Release (Finance Officer)

```typescript
// POST /api/payments/[id]/release-funds
// Manually trigger fund release (Finance Officer only)

interface ManualReleaseFundsRequest {
  financeOfficerId: string;
  reason: string;
}

interface ManualReleaseFundsResponse {
  success: boolean;
  payment: {
    id: string;
    status: 'verified';
    escrowStatus: 'released';
  };
  transferReference: string;
}
```

### 4. Confirm Pickup (Vendor)

```typescript
// POST /api/auctions/[id]/confirm-pickup
// Vendor confirms they have collected the item

interface ConfirmPickupRequest {
  vendorId: string;
  pickupAuthCode: string;
}

interface ConfirmPickupResponse {
  success: boolean;
  auction: {
    id: string;
    pickupConfirmedVendor: boolean;
    pickupConfirmedVendorAt: string;
  };
}
```

### 5. Admin Confirm Pickup

```typescript
// POST /api/admin/auctions/[id]/confirm-pickup
// Admin/Manager confirms item was collected

interface AdminConfirmPickupRequest {
  adminId: string;
  notes: string;
}

interface AdminConfirmPickupResponse {
  success: boolean;
  auction: {
    id: string;
    pickupConfirmedAdmin: boolean;
    pickupConfirmedAdminAt: string;
    status: 'completed';
  };
}
```

## Service Layer Changes

### Document Service Enhancement

```typescript
// src/features/documents/services/document.service.ts

/**
 * Check if all required documents are signed
 */
export async function checkAllDocumentsSigned(
  auctionId: string,
  vendorId: string
): Promise<boolean> {
  const documents = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId)
      )
    );

  const requiredTypes = ['bill_of_sale', 'liability_waiver', 'pickup_authorization'];
  const signedTypes = documents
    .filter(doc => doc.status === 'signed')
    .map(doc => doc.documentType);

  return requiredTypes.every(type => signedTypes.includes(type));
}

/**
 * Get document signing progress
 */
export async function getDocumentProgress(
  auctionId: string,
  vendorId: string
): Promise<{
  totalDocuments: number;
  signedDocuments: number;
  progress: number;
  allSigned: boolean;
}> {
  const documents = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId)
      )
    );

  const totalDocuments = 3; // bill_of_sale, liability_waiver, pickup_authorization
  const signedDocuments = documents.filter(doc => doc.status === 'signed').length;
  const progress = Math.round((signedDocuments / totalDocuments) * 100);
  const allSigned = signedDocuments === totalDocuments;

  return {
    totalDocuments,
    signedDocuments,
    progress,
    allSigned,
  };
}

/**
 * Trigger fund release after document signing
 * Called automatically when vendor signs the last document
 */
export async function triggerFundReleaseOnDocumentCompletion(
  auctionId: string,
  vendorId: string,
  userId: string
): Promise<void> {
  try {
    // Check if all documents are signed
    const allSigned = await checkAllDocumentsSigned(auctionId, vendorId);
    
    if (!allSigned) {
      console.log(`Not all documents signed for auction ${auctionId}. Skipping fund release.`);
      return;
    }

    // Get payment record
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.paymentMethod, 'escrow_wallet')
        )
      )
      .limit(1);

    if (!payment) {
      throw new Error('Payment record not found');
    }

    if (payment.status === 'verified') {
      console.log(`Payment already verified for auction ${auctionId}. Skipping fund release.`);
      return;
    }

    // Release funds
    const amount = parseFloat(payment.amount);
    await escrowService.releaseFunds(vendorId, amount, auctionId, userId);

    // Update payment status
    await db
      .update(payments)
      .set({
        status: 'verified',
        escrowStatus: 'released',
        verifiedAt: new Date(),
        autoVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

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

    // Generate pickup authorization code
    const pickupAuthCode = generatePickupAuthorizationCode();

    // Send notifications
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (vendor) {
      const [user] = await db.select().from(users).where(eq(users.id, vendor.userId)).limit(1);
      if (user) {
        await sendPaymentCompleteNotifications(user, payment, pickupAuthCode);
      }
    }

    console.log(`✅ Funds released automatically for auction ${auctionId} after document signing completion`);
  } catch (error) {
    console.error('Error triggering fund release:', error);
    // Send alert to Finance Officer
    await sendFundReleaseFailureAlert(auctionId, vendorId, error);
    throw error;
  }
}
```

### Modified signDocument Function

```typescript
// src/features/documents/services/document.service.ts

export async function signDocument(
  documentId: string,
  vendorId: string,
  signatureData: string,
  ipAddress: string,
  deviceType: string,
  userAgent: string
): Promise<ReleaseForm> {
  // ... existing signing logic ...

  const signedDoc = await db
    .update(releaseForms)
    .set({
      digitalSignature: signatureData,
      signedAt: new Date(),
      status: 'signed',
      // ... other fields
    })
    .where(eq(releaseForms.id, documentId))
    .returning();

  // NEW: Check if all documents are signed and trigger fund release
  try {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (vendor) {
      await triggerFundReleaseOnDocumentCompletion(
        signedDoc[0].auctionId,
        vendorId,
        vendor.userId
      );
    }
  } catch (error) {
    console.error('Error triggering fund release after document signing:', error);
    // Don't fail the signing if fund release fails
  }

  return signedDoc[0];
}
```

## UI Components

### 1. Wallet Payment Confirmation Component

```typescript
// src/components/payments/wallet-payment-confirmation.tsx

interface WalletPaymentConfirmationProps {
  payment: {
    id: string;
    amount: number;
    escrowStatus: 'frozen' | 'released';
  };
  walletBalance: {
    frozenAmount: number;
  };
  onConfirm: () => Promise<void>;
}

export function WalletPaymentConfirmation({
  payment,
  walletBalance,
  onConfirm,
}: WalletPaymentConfirmationProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Payment from Wallet</h2>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-blue-800 font-semibold">Payment Source: Escrow Wallet</p>
        <p className="text-sm text-blue-700 mt-1">
          ₦{payment.amount.toLocaleString()} frozen in your wallet
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount to Pay:</span>
          <span className="font-semibold text-gray-900">
            ₦{payment.amount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Frozen in Wallet:</span>
          <span className="font-semibold text-green-600">
            ₦{walletBalance.frozenAmount.toLocaleString()}
          </span>
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full bg-burgundy-900 text-white py-4 px-6 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50"
      >
        {confirming ? 'Confirming...' : 'Confirm Payment from Wallet'}
      </button>

      <p className="text-sm text-gray-600 mt-4 text-center">
        After confirmation, sign all 3 documents to complete payment
      </p>
    </div>
  );
}
```

### 2. Document Signing Progress Component

```typescript
// src/components/documents/document-signing-progress.tsx

interface DocumentSigningProgressProps {
  progress: {
    totalDocuments: number;
    signedDocuments: number;
    progress: number;
    allSigned: boolean;
  };
  documents: Array<{
    id: string;
    type: string;
    status: 'pending' | 'signed' | 'voided';
    title: string;
  }>;
}

export function DocumentSigningProgress({
  progress,
  documents,
}: DocumentSigningProgressProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Document Signing Progress</h2>
      
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {progress.signedDocuments}/{progress.totalDocuments} Documents Signed
          </span>
          <span className="text-sm font-medium text-gray-700">
            {progress.progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              progress.allSigned ? 'bg-green-500' : 'bg-burgundy-900'
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>

      {/* Success Banner */}
      {progress.allSigned && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-green-800 font-semibold">
            ✓ All documents signed! Payment is being processed.
          </p>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                doc.status === 'signed' ? 'bg-green-100' :
                doc.status === 'voided' ? 'bg-red-100' : 'bg-yellow-100'
              }`}>
                {doc.status === 'signed' ? '✓' : doc.status === 'voided' ? '✗' : '○'}
              </div>
              <span className="font-medium text-gray-900">{doc.title}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              doc.status === 'signed' ? 'bg-green-100 text-green-800' :
              doc.status === 'voided' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {doc.status === 'signed' ? 'Signed' :
               doc.status === 'voided' ? 'Voided' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. Finance Officer Escrow Payment View

```typescript
// src/components/finance/escrow-payment-details.tsx

interface EscrowPaymentDetailsProps {
  payment: {
    id: string;
    amount: number;
    escrowStatus: 'frozen' | 'released' | 'failed';
    status: 'pending' | 'verified' | 'rejected';
  };
  documentProgress: {
    signedDocuments: number;
    totalDocuments: number;
  };
  walletBalance: {
    balance: number;
    frozenAmount: number;
  };
  onManualRelease: () => Promise<void>;
}

export function EscrowPaymentDetails({
  payment,
  documentProgress,
  walletBalance,
  onManualRelease,
}: EscrowPaymentDetailsProps) {
  const [releasing, setReleasing] = useState(false);

  const handleManualRelease = async () => {
    if (!confirm(`Manually release ₦${payment.amount.toLocaleString()} from vendor wallet?`)) {
      return;
    }

    setReleasing(true);
    try {
      await onManualRelease();
    } finally {
      setReleasing(false);
    }
  };

  const canManualRelease = 
    payment.escrowStatus === 'frozen' &&
    payment.status === 'pending' &&
    documentProgress.signedDocuments === documentProgress.totalDocuments;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Escrow Wallet Payment</h3>
      
      <div className="space-y-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Payment Amount:</span>
          <span className="font-semibold text-gray-900">
            ₦{payment.amount.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Escrow Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            payment.escrowStatus === 'released' ? 'bg-green-100 text-green-800' :
            payment.escrowStatus === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {payment.escrowStatus === 'released' ? 'Released' :
             payment.escrowStatus === 'failed' ? 'Failed' : 'Frozen'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Document Progress:</span>
          <span className="font-semibold text-gray-900">
            {documentProgress.signedDocuments}/{documentProgress.totalDocuments} Signed
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Wallet Balance:</span>
          <span className="font-semibold text-gray-900">
            ₦{walletBalance.balance.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Frozen Amount:</span>
          <span className="font-semibold text-green-600">
            ₦{walletBalance.frozenAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {canManualRelease && (
        <button
          onClick={handleManualRelease}
          disabled={releasing}
          className="w-full mt-6 bg-burgundy-900 text-white py-3 px-4 rounded-lg font-semibold hover:bg-burgundy-800 transition-colors disabled:opacity-50"
        >
          {releasing ? 'Releasing...' : 'Manual Release Funds'}
        </button>
      )}

      {payment.escrowStatus === 'failed' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">
            Automatic fund release failed. Use manual release to retry.
          </p>
        </div>
      )}
    </div>
  );
}
```

## Testing Strategy

### Unit Tests

1. Test `checkAllDocumentsSigned()` returns true only when all 3 documents signed
2. Test `getDocumentProgress()` calculates correct progress percentage
3. Test `triggerFundReleaseOnDocumentCompletion()` only releases when all documents signed
4. Test `triggerFundReleaseOnDocumentCompletion()` updates payment status to 'verified'
5. Test `triggerFundReleaseOnDocumentCompletion()` updates case status to 'sold'
6. Test `triggerFundReleaseOnDocumentCompletion()` sends notifications
7. Test `triggerFundReleaseOnDocumentCompletion()` handles Paystack transfer failures
8. Test wallet balance invariant maintained after fund release

### Integration Tests

1. Test complete flow: sign 3 documents → funds released → payment verified
2. Test manual fund release by Finance Officer
3. Test pickup confirmation workflow (vendor + admin)
4. Test escrow payment filtering on Finance Officer dashboard
5. Test document progress API returns correct data
6. Test fund release failure sends alert to Finance Officer
7. Test audit trail records all events correctly

### E2E Tests

1. Test vendor completes wallet payment and signs all documents
2. Test Finance Officer views escrow payment and manually releases funds
3. Test vendor confirms pickup and admin confirms pickup
4. Test escrow payment appears correctly in reports

## Security Considerations

1. **Authentication**: All API endpoints require authentication
2. **Authorization**: Only Finance Officers can manually release funds
3. **Idempotency**: Paystack transfer uses unique reference to prevent duplicate transfers
4. **Balance Verification**: Verify frozen amount matches payment amount before release
5. **Document Verification**: Verify all 3 documents signed before fund release
6. **Audit Logging**: Log all fund movements with user ID, IP address, timestamp
7. **Error Handling**: Gracefully handle Paystack API failures and notify Finance Officer
8. **Data Encryption**: Encrypt sensitive data in audit logs

## Performance Considerations

1. **Async Processing**: Fund release triggered asynchronously after document signing
2. **Caching**: Cache wallet balance for 5 minutes to reduce database queries
3. **Database Indexing**: Index payments table on (auctionId, vendorId, paymentMethod)
4. **Notification Queuing**: Queue SMS/email notifications to avoid blocking
5. **Paystack Timeout**: Set 30-second timeout for Paystack transfer API calls

## Rollout Plan

1. **Phase 1**: Deploy document progress tracking and UI updates
2. **Phase 2**: Deploy automatic fund release trigger (with feature flag)
3. **Phase 3**: Deploy Finance Officer manual release functionality
4. **Phase 4**: Deploy pickup confirmation workflow
5. **Phase 5**: Enable automatic fund release for all escrow payments
6. **Phase 6**: Monitor automation success rate and adjust as needed

## Success Metrics

1. **Automation Rate**: >90% of escrow payments automatically released
2. **Processing Time**: Average time from auction win to fund release <24 hours
3. **Error Rate**: <5% of automatic fund releases fail
4. **Manual Intervention**: <10% of payments require manual Finance Officer action
5. **Vendor Satisfaction**: >4.5/5 rating for escrow wallet payment experience
