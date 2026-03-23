# WalletPaymentConfirmation Component

## Overview

The `WalletPaymentConfirmation` component displays wallet payment details and allows vendors to confirm payment from their frozen escrow wallet funds. This component is part of the Escrow Wallet Payment Completion feature.

## Requirements

- **Spec**: Escrow Wallet Payment Completion
- **Requirement**: Requirement 1 - Vendor Wallet Payment Confirmation UI
- **Design**: See design.md section "UI Components > 1. Wallet Payment Confirmation Component"

## Features

✅ Display payment source indicator: "Payment Source: Escrow Wallet"  
✅ Show frozen amount: "₦[amount] frozen in your wallet"  
✅ Display payment details (amount to pay, frozen in wallet)  
✅ "Confirm Payment from Wallet" button with loading state  
✅ Success message: "Payment confirmed! Sign all documents to complete the process"  
✅ Error handling for insufficient funds and other errors  
✅ Confirmation modal for user verification  
✅ Responsive design (mobile-first)  
✅ Accessibility support (ARIA labels, keyboard navigation)  

## Usage

```tsx
import { WalletPaymentConfirmation } from '@/components/payments/wallet-payment-confirmation';

function PaymentPage() {
  const payment = {
    id: 'payment-123',
    amount: 400000,
    escrowStatus: 'frozen',
  };

  const walletBalance = {
    frozenAmount: 400000,
    availableBalance: 100000,
  };

  const handleConfirm = async () => {
    const response = await fetch(`/api/payments/${payment.id}/confirm-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: session.user.vendorId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm payment');
    }

    const data = await response.json();
    router.push(data.documentsUrl);
  };

  return (
    <WalletPaymentConfirmation
      payment={payment}
      walletBalance={walletBalance}
      onConfirm={handleConfirm}
    />
  );
}
```

## Props

### `payment`

**Type**: `object`  
**Required**: Yes

Payment details object containing:

- `id` (string): Payment ID
- `amount` (number): Payment amount in Naira
- `escrowStatus` (string, optional): Escrow status ('frozen', 'released', 'failed')

### `walletBalance`

**Type**: `object`  
**Required**: Yes

Wallet balance object containing:

- `frozenAmount` (number): Amount frozen in wallet
- `availableBalance` (number, optional): Available balance in wallet

### `onConfirm`

**Type**: `() => Promise<void>`  
**Required**: Yes

Async callback function called when user confirms payment. Should:

1. Call the `/api/payments/[id]/confirm-wallet` endpoint
2. Handle success by redirecting to documents page
3. Throw error on failure (component will display error message)

## States

### Initial State

- Button enabled: "Confirm Payment from Wallet"
- No success or error messages

### Loading State

- Button disabled: "Confirming..."
- Modal shows "Processing..." spinner
- User cannot close modal

### Success State

- Button disabled: "Payment Confirmed"
- Success message displayed
- Modal closed

### Error State

- Button enabled: "Confirm Payment from Wallet"
- Error message displayed in red banner
- User can retry

## Accessibility

The component follows WCAG 2.1 Level AA guidelines:

- **ARIA Labels**: All interactive elements have descriptive labels
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Escape)
- **Screen Reader Support**: Status messages announced with `aria-live`
- **Focus Management**: Focus trapped in modal during confirmation
- **Color Contrast**: All text meets 4.5:1 contrast ratio

## Responsive Design

The component is mobile-first and responsive:

- **Mobile (< 640px)**: Compact padding, smaller text
- **Desktop (≥ 640px)**: Larger padding, larger text
- **Breakpoints**: Uses Tailwind's `sm:` prefix for responsive classes

## Error Handling

The component handles various error scenarios:

1. **Insufficient Funds**: Displays "Insufficient frozen funds" error
2. **Network Errors**: Displays "Failed to confirm payment" error
3. **API Errors**: Displays error message from API response
4. **Unknown Errors**: Displays generic "Failed to confirm payment" error

## Testing

The component has comprehensive unit tests covering:

- ✅ Component rendering with payment data
- ✅ Button click triggers API call
- ✅ Loading state displays during confirmation
- ✅ Success state displays after confirmation
- ✅ Error states display appropriate messages
- ✅ Responsive design (mobile and desktop)
- ✅ Accessibility (ARIA labels, keyboard navigation)

Run tests:

```bash
npm run test:unit -- tests/unit/components/wallet-payment-confirmation.test.tsx
```

## Integration

### Step 1: Check Payment Method

```tsx
if (payment.paymentMethod === 'escrow_wallet') {
  return <WalletPaymentConfirmation ... />;
}
```

### Step 2: Fetch Payment and Wallet Data

```tsx
const [payment] = await db
  .select()
  .from(payments)
  .where(eq(payments.id, paymentId))
  .limit(1);

const [wallet] = await db
  .select()
  .from(escrowWallets)
  .where(eq(escrowWallets.vendorId, vendorId))
  .limit(1);
```

### Step 3: Implement onConfirm Handler

```tsx
const handleConfirm = async () => {
  const response = await fetch(`/api/payments/${payment.id}/confirm-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendorId: session.user.vendorId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm payment');
  }

  const data = await response.json();
  router.push(data.documentsUrl);
};
```

## API Endpoint

The component integrates with:

**POST** `/api/payments/[id]/confirm-wallet`

**Request Body**:
```json
{
  "vendorId": "vendor-uuid"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Wallet payment confirmed. Please sign all documents to complete payment.",
  "payment": {
    "id": "payment-uuid",
    "status": "pending",
    "escrowStatus": "frozen",
    "amount": 400000,
    "paymentMethod": "escrow_wallet"
  },
  "wallet": {
    "frozenAmount": 400000,
    "confirmedAmount": 400000
  },
  "documentsUrl": "/vendor/documents?auctionId=auction-uuid"
}
```

**Error Response** (400/403/404/500):
```json
{
  "error": "Error message",
  "details": { ... }
}
```

## Dependencies

- `react`: ^19.2.4
- `@/components/ui/confirmation-modal`: Confirmation modal component
- Tailwind CSS for styling

## Related Components

- `ConfirmationModal`: Modal for user confirmation
- `DocumentSigningProgress`: Shows document signing progress after confirmation

## Future Enhancements

- [ ] Add animation for success state
- [ ] Add confetti effect on successful confirmation
- [ ] Add wallet balance history link
- [ ] Add estimated processing time
- [ ] Add support for partial payments

## Support

For issues or questions, contact the development team or refer to:

- Design Document: `.kiro/specs/escrow-wallet-payment-completion/design.md`
- Requirements: `.kiro/specs/escrow-wallet-payment-completion/requirements.md`
- Tasks: `.kiro/specs/escrow-wallet-payment-completion/tasks.md`
