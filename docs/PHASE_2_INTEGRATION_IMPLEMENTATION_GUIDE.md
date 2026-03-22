# Phase 2: Integration Implementation Guide

## ✅ Completed Tasks

### TASK 1: Vendor Document Portal Page ✅
**File:** `src/app/(dashboard)/vendor/documents/page.tsx`

Created comprehensive document tracking page with:
- Real-time document status display
- Grouped sections: Pending Signature, Signed Documents, Document History
- Download buttons for each document
- Status badges (Pending, Signed, Voided, Expired)
- Mobile responsive layout
- Professional NEM branding

### TASK 2: Email Templates ✅
**Files Created:**
- `src/features/notifications/templates/document-ready.template.ts`
- `src/features/notifications/templates/document-signed.template.ts`

Both templates follow NEM branding (burgundy/gold theme) and include:
- Professional HTML email design
- Document details
- Download/action buttons
- Expiry notices
- NEM contact information

## 🔄 Integration Tasks (Manual Implementation Required)

### TASK 3.1: Modify Auction Details Page
**File:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Changes Required:**

1. **Add State Variables** (after line 93):
```typescript
const [showWaiverModal, setShowWaiverModal] = useState(false);
const [waiverSigned, setWaiverSigned] = useState(false);
const [isWinner, setIsWinner] = useState(false);
```

2. **Add Waiver Check Effect** (after fetchAuction useEffect):
```typescript
// Check if vendor won and needs to sign waiver
useEffect(() => {
  const checkWaiverStatus = async () => {
    if (!auction || auction.status !== 'closed') return;
    
    try {
      // Check if current vendor is the winner
      const session = await getSession();
      if (!session?.user?.vendorId) return;
      
      const isWinner = auction.currentBidder === session.user.vendorId;
      setIsWinner(isWinner);
      
      if (isWinner) {
        // Check if waiver is signed
        const response = await fetch(`/api/auctions/${auction.id}/documents/waiver-status`);
        if (response.ok) {
          const data = await response.json();
          setWaiverSigned(data.signed);
          
          // Show modal if not signed
          if (!data.signed) {
            setShowWaiverModal(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking waiver status:', error);
    }
  };
  
  checkWaiverStatus();
}, [auction]);
```

3. **Add Waiver Warning Banner** (before "Place Bid" button section):
```typescript
{/* Waiver Warning for Winners */}
{isWinner && !waiverSigned && auction.status === 'closed' && (
  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-yellow-900 mb-1">
          ⚠️ Action Required: Sign Liability Waiver
        </h4>
        <p className="text-sm text-yellow-800 mb-3">
          You must sign the Release & Waiver of Liability before proceeding with payment.
        </p>
        <button
          onClick={() => setShowWaiverModal(true)}
          className="px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition-colors text-sm"
        >
          Sign Waiver Now
        </button>
      </div>
    </div>
  </div>
)}
```

4. **Import ReleaseFormModal** (at top of file):
```typescript
import { ReleaseFormModal } from '@/components/documents/release-form-modal';
```

5. **Add Modal Component** (before closing div, after BidForm):
```typescript
{/* Release Form Modal */}
{showWaiverModal && auction && (
  <ReleaseFormModal
    isOpen={showWaiverModal}
    onClose={() => setShowWaiverModal(false)}
    onSign={async (signatureData) => {
      try {
        const response = await fetch(`/api/auctions/${auction.id}/documents/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'liability_waiver',
            signatureData,
          }),
        });
        
        if (response.ok) {
          setWaiverSigned(true);
          setShowWaiverModal(false);
          toast.success('Waiver Signed', 'You can now proceed with payment');
        } else {
          throw new Error('Failed to sign waiver');
        }
      } catch (error) {
        console.error('Error signing waiver:', error);
        toast.error('Failed to sign waiver', 'Please try again');
      }
    }}
    documentTitle="Release & Waiver of Liability"
    documentContent={
      <div className="prose max-w-none">
        {/* Waiver content will be fetched from API */}
        <p>Loading waiver content...</p>
      </div>
    }
    auctionId={auction.id}
    assetDescription={getAssetName()}
  />
)}
```

### TASK 3.2: Add Waiver Check to Bidding API
**File:** `src/app/api/auctions/[id]/bids/route.ts`

**No changes needed** - Waiver check is enforced at payment stage, not bidding stage.

### TASK 3.3: Generate Pickup Authorization After Payment
**File:** `src/app/api/payments/[id]/verify/route.ts`

**Changes Required** (after payment verification, around line 150):

```typescript
// After payment verified and case marked as 'sold'

// Generate Pickup Authorization document
try {
  const pickupAuth = await generateDocument(
    payment.auctionId,
    payment.vendorId,
    'pickup_authorization',
    financeOfficerId
  );
  
  console.log(`✅ Pickup authorization generated: ${pickupAuth.id}`);
  
  // Send document ready email
  await emailService.sendEmail({
    to: vendorUser.email,
    subject: 'Pickup Authorization Ready - NEM Insurance',
    html: documentReadyTemplate({
      vendorName: vendorUser.fullName,
      documentType: 'Pickup Authorization',
      documentTitle: 'Pickup Authorization',
      auctionId: payment.auctionId,
      assetDescription: `${caseDetails.assetType} - ${caseDetails.claimReference}`,
      downloadUrl: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/documents`,
    }),
  });
  
  // Create notification
  await createNotification({
    userId: vendor.userId,
    type: 'PICKUP_AUTHORIZATION_READY',
    title: 'Pickup Authorization Ready',
    message: 'Your pickup authorization has been generated. Download it from your documents page.',
    data: {
      documentId: pickupAuth.id,
      auctionId: payment.auctionId,
    },
  });
} catch (docError) {
  console.error('Error generating pickup authorization:', docError);
  // Don't fail payment verification if document generation fails
}
```

**Add Import:**
```typescript
import { generateDocument } from '@/features/documents/services/document.service';
import { documentReadyTemplate } from '@/features/notifications/templates';
```

### TASK 4: Add Notification Types
**File:** `src/features/notifications/services/notification.service.ts`

**Add to end of file:**

```typescript
/**
 * Helper: Create document generated notification
 */
export async function notifyDocumentGenerated(
  userId: string,
  documentId: string,
  documentType: string
) {
  return createNotification({
    userId,
    type: 'DOCUMENT_GENERATED',
    title: 'Document Ready',
    message: `Your ${documentType} is ready for review and signature`,
    data: {
      documentId,
      documentType,
    },
  });
}

/**
 * Helper: Create signature required notification
 */
export async function notifySignatureRequired(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'SIGNATURE_REQUIRED',
    title: 'Signature Required',
    message: 'Please sign the liability waiver to proceed with payment',
    data: {
      documentId,
    },
  });
}

/**
 * Helper: Create document signed notification
 */
export async function notifyDocumentSigned(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'DOCUMENT_SIGNED',
    title: 'Document Signed',
    message: 'Your document has been signed successfully',
    data: {
      documentId,
    },
  });
}

/**
 * Helper: Create payment unlocked notification
 */
export async function notifyPaymentUnlocked(
  userId: string,
  auctionId: string
) {
  return createNotification({
    userId,
    type: 'PAYMENT_UNLOCKED',
    title: 'Payment Unlocked',
    message: 'You can now proceed with payment for your won auction',
    data: {
      auctionId,
    },
  });
}

/**
 * Helper: Create pickup authorization ready notification
 */
export async function notifyPickupAuthReady(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'PICKUP_AUTHORIZATION_READY',
    title: 'Pickup Authorization Ready',
    message: 'Your pickup authorization has been generated',
    data: {
      documentId,
    },
  });
}
```

### TASK 5: Update Audit Logger
**File:** `src/lib/utils/audit-logger.ts`

**Add to AuditActionType enum** (around line 50):

```typescript
// Document actions
DOCUMENT_GENERATED = 'document_generated',
DOCUMENT_SIGNED = 'document_signed',
DOCUMENT_DOWNLOADED = 'document_downloaded',
DOCUMENT_VOIDED = 'document_voided',
PAYMENT_BLOCKED_NO_WAIVER = 'payment_blocked_no_waiver',
PAYMENT_UNLOCKED_WAIVER_SIGNED = 'payment_unlocked_waiver_signed',
```

**Add to AuditEntityType enum** (around line 80):

```typescript
DOCUMENT = 'document',
```

### TASK 6: Update Notification Schema
**File:** `src/lib/db/schema/notifications.ts`

**Add to NotificationType** (if not already present):

```typescript
| 'DOCUMENT_GENERATED'
| 'SIGNATURE_REQUIRED'
| 'DOCUMENT_SIGNED'
| 'PAYMENT_UNLOCKED'
| 'PICKUP_AUTHORIZATION_READY'
```

## 📋 Testing Checklist

After implementing all changes, test the following flow:

1. ✅ Vendor wins auction
2. ✅ Bill of Sale generated automatically
3. ✅ Release & Waiver modal appears on auction details page
4. ✅ Payment button is disabled (or shows warning)
5. ✅ Vendor signs waiver
6. ✅ Payment button is enabled
7. ✅ Vendor completes payment
8. ✅ Pickup Authorization generated
9. ✅ All emails sent (Bill of Sale, Waiver Signed, Pickup Auth Ready)
10. ✅ All notifications created
11. ✅ All audit logs created
12. ✅ Vendor can download documents from portal

## 🎨 Design Requirements

- Professional NEM branding (burgundy #800020, gold #FFD700, white)
- Mobile responsive layout
- Real-time status updates
- Clear visual indicators for pending actions
- Accessible UI components
- Loading states for all async operations

## 🔒 Security Requirements

- Verify vendor ownership before showing documents
- Log all document downloads
- Validate digital signatures
- Enforce waiver signing before payment
- Audit trail for all document actions

## 📝 Notes

- All document data is pre-filled from auction and vendor information
- Digital signatures are stored as base64 data URLs
- PDFs are generated server-side and uploaded to Cloudinary
- Email templates use responsive HTML with NEM branding
- Notification types are extensible for future document types
