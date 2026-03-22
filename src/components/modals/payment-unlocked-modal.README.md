# Payment Unlocked Modal

## Overview

Modal component that appears when a vendor logs in and has a `PAYMENT_UNLOCKED` notification. Shows pickup details and authorization code after payment is complete.

## Features

1. **Item Details Display**
   - Asset description (make, model, year)
   - Auction winning bid amount
   - Pickup authorization code
   - Pickup location
   - Pickup deadline

2. **Action Buttons**
   - **Primary**: "View Payment Details" → Routes to `/vendor/payments/{paymentId}`
   - **Secondary**: "Dismiss" → Closes modal

3. **Persistence Logic**
   - Modal appears on every login until vendor visits payment page
   - Dismissal state stored in localStorage with timestamp
   - Modal reappears on next login even if dismissed
   - Once vendor visits payment page, modal stops appearing permanently

4. **Trigger Logic**
   - Checks on vendor dashboard load
   - Queries for unread `PAYMENT_UNLOCKED` notifications
   - Shows modal with payment details if found
   - Marks notification as read when modal is shown

## Usage

### Basic Implementation

```tsx
import PaymentUnlockedModal from '@/components/modals/payment-unlocked-modal';
import { usePaymentUnlockedModal } from '@/hooks/use-payment-unlocked-modal';

function VendorDashboard() {
  const {
    isOpen,
    paymentData,
    closeModal,
  } = usePaymentUnlockedModal();

  return (
    <>
      {/* Your dashboard content */}
      
      {isOpen && paymentData && (
        <PaymentUnlockedModal
          isOpen={isOpen}
          onClose={closeModal}
          paymentData={paymentData}
        />
      )}
    </>
  );
}
```

## Props

### PaymentUnlockedModal

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Callback when modal is closed |
| `paymentData` | `PaymentData` | Yes | Payment and pickup details |

### PaymentData Interface

```typescript
interface PaymentData {
  paymentId: string;          // Payment ID for routing
  auctionId: string;          // Auction ID
  assetDescription: string;   // e.g., "Toyota Camry 2015"
  winningBid: number;         // Winning bid amount
  pickupAuthCode: string;     // e.g., "AUTH-12345678"
  pickupLocation: string;     // Pickup location address
  pickupDeadline: string;     // Pickup deadline date
}
```

## Hook: usePaymentUnlockedModal

### Returns

```typescript
{
  isOpen: boolean;              // Modal open state
  paymentData: PaymentData | null;  // Payment details
  isLoading: boolean;           // Loading state
  closeModal: () => void;       // Close modal function
}
```

### Behavior

1. **On Mount**: Fetches unread `PAYMENT_UNLOCKED` notifications
2. **Checks localStorage**: 
   - `payment-visited-{paymentId}` → If exists, don't show modal
   - `payment-unlocked-modal-{paymentId}-dismissed` → Tracks dismissal
3. **Fetches Payment**: Gets payment details from `/api/payments/{paymentId}`
4. **Shows Modal**: If all conditions met
5. **Marks as Read**: Updates notification status

## localStorage Keys

| Key | Purpose | Value |
|-----|---------|-------|
| `payment-visited-{paymentId}` | Tracks if payment page visited | `"true"` |
| `payment-unlocked-modal-{paymentId}-dismissed` | Tracks modal dismissal | ISO timestamp |

## User Flow

1. **Vendor completes all 3 documents** (Bill of Sale, Liability Waiver, Pickup Authorization)
2. **Payment is unlocked** → `PAYMENT_UNLOCKED` notification created
3. **Vendor logs out and logs back in**
4. **Modal appears** with payment details and pickup code
5. **Vendor can**:
   - Click "View Payment Details" → Goes to payment page, modal stops appearing
   - Click "Dismiss" → Modal closes, but reappears on next login
6. **Once vendor visits payment page**, modal stops appearing permanently

## Styling

- Uses Tailwind CSS
- Matches existing modal styles in the application
- Responsive design (mobile-friendly)
- Burgundy color scheme (`#800020`)
- Green success indicators
- Yellow warning indicators

## Integration Points

### Vendor Dashboard
- `src/app/(dashboard)/vendor/dashboard/page.tsx`
- Hook called on component mount
- Modal rendered conditionally

### Payment Page
- `src/app/(dashboard)/vendor/payments/[id]/page.tsx`
- Clears localStorage entries on visit
- Prevents modal from showing again

### Notification System
- Queries `/api/notifications?unreadOnly=true&limit=10`
- Marks notification as read via `PATCH /api/notifications/{id}`
- Fetches payment details via `GET /api/payments/{id}`

## Testing Checklist

- [ ] Modal appears on login when `PAYMENT_UNLOCKED` notification exists
- [ ] Modal shows correct payment and pickup details
- [ ] "View Payment Details" button routes to correct payment page
- [ ] "Dismiss" button closes modal
- [ ] Modal reappears on next login after dismissal
- [ ] Modal stops appearing after visiting payment page
- [ ] Multiple payments handled correctly (shows most recent)
- [ ] Error handling works (payment not found, API errors)
- [ ] Responsive design works on mobile
- [ ] localStorage entries created/cleared correctly

## Error Handling

- **No notification found**: Modal doesn't show
- **Missing paymentId**: Modal doesn't show, logs warning
- **Payment fetch fails**: Modal doesn't show, logs error
- **Payment not found**: Modal doesn't show, logs error
- **API errors**: Caught and logged, modal doesn't show

## Security Considerations

- Only shows for authenticated vendors
- Notification data validated before display
- Payment details fetched from secure API endpoint
- localStorage used only for UI state (no sensitive data)

## Performance

- Hook runs once on mount
- Single API call for notifications
- Single API call for payment details (if needed)
- No polling or real-time updates
- Minimal re-renders

## Accessibility

- Modal has proper ARIA labels
- Close button has `aria-label`
- Keyboard navigation supported
- Focus management on open/close
- Screen reader friendly

## Future Enhancements

- [ ] Add animation transitions
- [ ] Support multiple pending payments
- [ ] Add QR code for pickup authorization
- [ ] Add "Schedule Pickup" button
- [ ] Add countdown timer for pickup deadline
- [ ] Add push notification integration
- [ ] Add SMS reminder option
