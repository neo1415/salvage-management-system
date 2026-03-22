# AdminPickupConfirmation Component

## Overview

The `AdminPickupConfirmation` component allows Admin/Manager users to confirm that a vendor has collected the salvage item. This is the final step in the pickup confirmation workflow after the vendor has confirmed pickup.

## Requirements

- **Spec**: Escrow Wallet Payment Completion
- **Requirement**: Requirement 5 - Pickup Confirmation Workflow
- **Task**: 5.1 - Create admin pickup confirmation component

## Features

- Display vendor pickup confirmation status (confirmed/pending)
- Notes field for admin to add observations about the pickup
- "Confirm Pickup" button that calls the admin confirm-pickup API endpoint
- After admin confirms, the transaction is marked as 'completed'
- Responsive design (mobile-first)
- Accessibility support (ARIA labels, keyboard navigation)
- Error handling and display
- Success message after confirmation

## Props

```typescript
interface AdminPickupConfirmationProps {
  auctionId: string;              // ID of the auction
  adminId: string;                // ID of the admin/manager user
  vendorPickupStatus: {           // Vendor pickup confirmation status
    confirmed: boolean;           // Whether vendor has confirmed
    confirmedAt: string | null;   // When vendor confirmed (ISO string)
  };
  onConfirm: (notes: string) => Promise<void>;  // Callback when admin confirms
}
```

## Usage

```tsx
import { AdminPickupConfirmation } from '@/components/admin/admin-pickup-confirmation';

function AdminPickupPage() {
  const handleConfirm = async (notes: string) => {
    const response = await fetch(`/api/admin/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: currentUser.id,
        notes,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to confirm pickup');
    }
  };

  return (
    <AdminPickupConfirmation
      auctionId={auction.id}
      adminId={currentUser.id}
      vendorPickupStatus={{
        confirmed: auction.pickupConfirmedVendor,
        confirmedAt: auction.pickupConfirmedVendorAt,
      }}
      onConfirm={handleConfirm}
    />
  );
}
```

## Workflow

1. Vendor confirms pickup first (using PickupConfirmation component)
2. Admin/Manager sees vendor confirmation status
3. Admin adds optional notes about the pickup
4. Admin clicks "Confirm Pickup" button
5. Confirmation modal appears
6. Admin confirms in modal
7. API call to POST /api/admin/auctions/[id]/confirm-pickup
8. Transaction marked as 'completed'
9. Funds released if not already released
10. Success message displayed

## API Integration

The component integrates with the admin pickup confirmation endpoint:

**Endpoint**: `POST /api/admin/auctions/[id]/confirm-pickup`

**Request Body**:
```json
{
  "adminId": "uuid",
  "notes": "Optional admin observations"
}
```

**Response**:
```json
{
  "success": true,
  "auction": {
    "id": "uuid",
    "pickupConfirmedAdmin": true,
    "pickupConfirmedAdminAt": "2024-01-15T10:30:00Z",
    "status": "completed"
  },
  "message": "Pickup confirmed successfully. Transaction is now complete."
}
```

## States

### Vendor Not Confirmed
- Yellow status badge showing "Pending"
- Notes field disabled
- Confirm button disabled
- Helper text: "Waiting for vendor to confirm pickup first"

### Vendor Confirmed
- Green status badge showing "✓ Confirmed"
- Shows vendor confirmation date
- Notes field enabled
- Confirm button enabled
- Blue info box with instructions

### Confirming
- Button shows "Confirming..."
- All inputs disabled
- Loading state in modal

### Success
- Green success message
- Button shows "Pickup Confirmed"
- All inputs disabled

### Error
- Red error message
- Button re-enabled
- User can retry

## Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Screen reader friendly status updates
- Focus management in modal
- Color contrast meets WCAG AA standards

## Responsive Design

- Mobile-first approach
- Adjusts padding and font sizes for small screens
- Touch-friendly button sizes
- Readable text on all screen sizes

## Testing

See `tests/unit/components/admin-pickup-confirmation.test.tsx` for unit tests.

## Related Components

- `PickupConfirmation` - Vendor-side pickup confirmation
- `ConfirmationModal` - Reusable confirmation dialog
- `EscrowPaymentDetails` - Finance Officer escrow payment view
