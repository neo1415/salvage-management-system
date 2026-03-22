# EscrowPaymentDetails Component

## Overview

The `EscrowPaymentDetails` component displays escrow wallet payment information for Finance Officers, including payment amount, escrow status, document signing progress, wallet balance, and frozen amount. It provides a "Manual Release Funds" button when all documents are signed but funds haven't been released automatically.

## Requirements

**Validates: Requirements 4.1, 4.2, 4.3**

This component implements the Finance Officer Escrow Payment Dashboard requirements:
- Display payment source and escrow status
- Show document signing progress (X/3)
- Display wallet balance and frozen amount
- Provide manual fund release functionality
- Handle loading states and errors gracefully

## Features

- **Payment Information Display**: Shows payment amount, escrow status, document progress, wallet balance, and frozen amount
- **Escrow Status Badge**: Color-coded badge (Frozen/Released/Failed)
- **Manual Release Button**: Appears when all documents are signed but funds are still frozen
- **Confirmation Modal**: Requires confirmation before releasing funds
- **Error Handling**: Displays error messages if fund release fails
- **Success Feedback**: Shows success message after successful fund release
- **Responsive Design**: Mobile-first design that works on all screen sizes
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Props

```typescript
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
```

### Prop Details

- `payment`: Payment record with ID, amount, escrow status, and payment status
- `documentProgress`: Document signing progress (X/3)
- `walletBalance`: Vendor wallet balance and frozen amount
- `onManualRelease`: Async callback function to trigger manual fund release

## Usage

```tsx
import { EscrowPaymentDetails } from '@/components/finance/escrow-payment-details';

function PaymentDetailsPage() {
  const handleManualRelease = async () => {
    const response = await fetch(`/api/payments/${paymentId}/release-funds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeOfficerId, reason: 'Manual release' }),
    });

    if (!response.ok) {
      throw new Error('Failed to release funds');
    }
  };

  return (
    <EscrowPaymentDetails
      payment={{
        id: 'payment-123',
        amount: 500000,
        escrowStatus: 'frozen',
        status: 'pending',
      }}
      documentProgress={{
        signedDocuments: 3,
        totalDocuments: 3,
      }}
      walletBalance={{
        balance: 900000,
        frozenAmount: 500000,
      }}
      onManualRelease={handleManualRelease}
    />
  );
}
```

## Manual Release Button Visibility

The "Manual Release Funds" button is only visible when:
1. Escrow status is 'frozen'
2. Payment status is 'pending'
3. All documents are signed (signedDocuments === totalDocuments)

## Escrow Status Colors

- **Frozen** (yellow): Funds are frozen in vendor wallet
- **Released** (green): Funds have been transferred to NEM Insurance
- **Failed** (red): Automatic fund release failed

## Error Handling

The component handles errors gracefully:
- Displays error message if fund release fails
- Keeps funds frozen if release fails
- Allows retry via manual release button

## Accessibility

- ARIA labels for all interactive elements
- Role attributes for semantic structure
- Keyboard navigation support
- Screen reader announcements for status changes
- Color contrast meets WCAG AA standards

## Testing

See `tests/unit/components/escrow-payment-details.test.tsx` for unit tests.

## Related Components

- `WalletPaymentConfirmation`: Vendor wallet payment confirmation
- `DocumentSigningProgress`: Document signing progress display
- `ConfirmationModal`: Reusable confirmation modal

## API Integration

This component integrates with:
- `POST /api/payments/[id]/release-funds`: Manual fund release endpoint
