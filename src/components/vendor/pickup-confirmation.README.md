# PickupConfirmation Component

## Overview

The `PickupConfirmation` component allows vendors to confirm they have collected their salvage item by entering the pickup authorization code they received via SMS/email after payment verification.

## Requirements

- **Spec**: Escrow Wallet Payment Completion
- **Requirement**: Requirement 5 - Pickup Confirmation Workflow
- **API Endpoint**: `POST /api/auctions/[id]/confirm-pickup`

## Features

- ✅ Pickup authorization code input field
- ✅ Automatic uppercase conversion
- ✅ Code format validation (alphanumeric, min 6 characters)
- ✅ "Confirm Pickup" button with loading state
- ✅ Confirmation modal before submitting
- ✅ Success message after confirmation
- ✅ Error handling and display
- ✅ Responsive design (mobile-first)
- ✅ Full accessibility support (ARIA labels, keyboard navigation)

## Usage

```tsx
import { PickupConfirmation } from '@/components/vendor/pickup-confirmation';

function VendorDashboard() {
  const handleConfirmPickup = async (pickupAuthCode: string) => {
    const response = await fetch(`/api/auctions/${auctionId}/confirm-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        pickupAuthCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm pickup');
    }
  };

  return (
    <PickupConfirmation
      auctionId="auction-123"
      vendorId="vendor-456"
      onConfirm={handleConfirmPickup}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `auctionId` | `string` | Yes | The ID of the auction |
| `vendorId` | `string` | Yes | The ID of the vendor |
| `onConfirm` | `(pickupAuthCode: string) => Promise<void>` | Yes | Async function called when pickup is confirmed |

## Code Validation Rules

The component validates the pickup authorization code with the following rules:

1. **Minimum Length**: At least 6 characters
2. **Format**: Only letters and numbers (alphanumeric)
3. **Case**: Automatically converted to uppercase
4. **Whitespace**: Leading/trailing spaces are trimmed

### Valid Examples

- `ABC123XYZ`
- `123456`
- `ABCDEF`
- `XYZ789ABC`

### Invalid Examples

- `ABC-123` (contains hyphen)
- `ABC12` (too short)
- `ABC 123` (contains space)
- `ABC@123` (contains special character)

## States

### Initial State
- Empty input field
- Disabled confirm button
- No messages displayed

### Validation Error State
- Red border on input field
- Error message below input
- Button remains enabled for retry

### Loading State
- Disabled input field
- Disabled button with "Confirming..." text
- Modal shows "Processing..." message

### Success State
- Green success banner
- Button text changes to "Pickup Confirmed"
- Button disabled
- Input cleared

### Error State
- Red error banner with error message
- Button re-enabled for retry
- Input remains enabled

## Accessibility

The component follows WCAG 2.1 Level AA guidelines:

- ✅ Proper ARIA labels on all interactive elements
- ✅ `role="region"` on main container
- ✅ `aria-live="polite"` on status messages
- ✅ `aria-live="assertive"` on success/error alerts
- ✅ `aria-invalid` on input when validation fails
- ✅ `aria-describedby` linking input to error message
- ✅ Keyboard navigation support
- ✅ Focus management in modal

## Responsive Design

The component is mobile-first and responsive:

- **Mobile (< 640px)**: Compact padding, smaller text
- **Desktop (≥ 640px)**: Larger padding, bigger text
- All touch targets meet minimum 44x44px size
- Text remains readable at all viewport sizes

## Integration with API

The component integrates with the vendor pickup confirmation endpoint:

```typescript
POST /api/auctions/[id]/confirm-pickup

Request Body:
{
  "vendorId": "vendor-456",
  "pickupAuthCode": "ABC123XYZ"
}

Success Response (200):
{
  "success": true,
  "auction": {
    "id": "auction-123",
    "pickupConfirmedVendor": true,
    "pickupConfirmedVendorAt": "2024-01-15T10:30:00Z"
  },
  "message": "Pickup confirmed successfully. Admin will verify shortly."
}

Error Response (400):
{
  "success": false,
  "error": "Invalid pickup authorization code"
}
```

## Testing

The component has comprehensive unit tests covering:

- ✅ Component rendering
- ✅ Code input validation
- ✅ Confirmation flow
- ✅ Loading states
- ✅ Success states
- ✅ Error handling
- ✅ Accessibility features
- ✅ Responsive design
- ✅ Edge cases

Run tests:
```bash
npm run test tests/unit/components/pickup-confirmation.test.tsx
```

## Related Components

- `WalletPaymentConfirmation` - Similar pattern for payment confirmation
- `DocumentSigningProgress` - Shows document signing progress
- `ConfirmationModal` - Reusable modal used by this component

## Workflow

1. Vendor wins auction and completes payment
2. System generates pickup authorization code
3. Code sent to vendor via SMS/email
4. Vendor navigates to dashboard/payment page
5. Vendor enters pickup code in this component
6. Vendor clicks "Confirm Pickup"
7. Confirmation modal appears
8. Vendor confirms in modal
9. API call made to confirm pickup
10. Success message displayed
11. Admin receives notification to verify pickup

## Notes

- The pickup authorization code is generated when payment is verified
- Vendor must have the code to confirm pickup
- After vendor confirmation, admin must also confirm pickup
- Transaction is marked as 'completed' only after both confirmations
- The component clears the input after successful confirmation
- Multiple retry attempts are allowed if confirmation fails
