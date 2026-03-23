# EscrowPaymentAuditTrail Component

## Overview

The `EscrowPaymentAuditTrail` component displays a timeline of audit log events for escrow wallet payments. It shows all events with timestamps, user information, IP addresses, and device types. Error events are highlighted in red for easy identification.

## Requirements

- **Spec**: Escrow Wallet Payment Completion
- **Requirement**: 6 (Escrow Payment Audit Trail)
- **Task**: 7.2 (Create escrow payment audit trail view)

## Features

- **Timeline View**: Displays events in chronological order (most recent first)
- **Event Details**: Shows action type, timestamp, user, IP address, device type
- **Error Highlighting**: Error events displayed with red background and border
- **Event Icons**: Visual icons for different event types (✓, 💳, 📝, etc.)
- **Device Icons**: Shows device type with icons (📱 mobile, 💻 desktop)
- **Relative Timestamps**: Shows "X minutes ago" with full timestamp on hover
- **Event Details**: Displays additional context (amounts, references, reasons)
- **Responsive Design**: Mobile-first design with responsive layout
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation

## Props

```typescript
interface EscrowPaymentAuditTrailProps {
  auditLogs: AuditLogEntry[];
  paymentId: string;
}

interface AuditLogEntry {
  id: string;
  actionType: string;
  userId: string;
  userName?: string;
  ipAddress: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  userAgent: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  createdAt: string;
}
```

## Usage

```tsx
import { EscrowPaymentAuditTrail } from '@/components/finance/escrow-payment-audit-trail';

function PaymentDetailsPage() {
  const auditLogs = [
    {
      id: 'log-1',
      actionType: 'payment_initiated',
      userId: 'user-123',
      userName: 'John Vendor',
      ipAddress: '192.168.1.1',
      deviceType: 'mobile',
      userAgent: 'Mozilla/5.0...',
      afterState: {
        status: 'pending',
        amount: 500000,
      },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'log-2',
      actionType: 'funds_released',
      userId: 'user-123',
      userName: 'Finance Officer',
      ipAddress: '192.168.1.2',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0...',
      afterState: {
        status: 'verified',
        escrowStatus: 'released',
        amount: 500000,
        autoVerified: true,
        transferReference: 'TRANSFER_12345678_1234567890',
      },
      createdAt: '2024-01-15T10:30:00Z',
    },
  ];

  return (
    <EscrowPaymentAuditTrail
      auditLogs={auditLogs}
      paymentId="payment-123"
    />
  );
}
```

## Event Types

The component recognizes and displays the following event types:

- `payment_initiated` - Payment Initiated (💳)
- `wallet_funded` - Wallet Funded (💰)
- `funds_frozen` - Funds Frozen (🔒)
- `funds_released` - Funds Released (✓)
- `funds_unfrozen` - Funds Unfrozen (🔓)
- `document_signing_progress` - Document Signing Progress (📝)
- `document_signed` - Document Signed (✓)
- `payment_verified` - Payment Verified (✓)
- `payment_auto_verified` - Payment Auto-Verified (✓)
- `pickup_confirmed_vendor` - Pickup Confirmed by Vendor (📦)
- `pickup_confirmed_admin` - Pickup Confirmed by Admin (✓)

## Error Detection

Events are highlighted as errors if:
- `afterState.escrowStatus === 'failed'`
- `afterState.status === 'rejected'`
- `afterState.error` exists
- `actionType` contains "failed"

## Event Details

The component extracts and displays additional details from `afterState`:

### Document Signing Progress
- Shows "X/3 documents signed"

### Fund Release
- Amount: ₦500,000
- Automatic release / Manual release
- Reason (for manual releases)
- Transfer reference

### Pickup Confirmation
- Pickup authorization code
- Admin notes

### Errors
- Error message from `afterState.error`

## Styling

The component uses Tailwind CSS classes:
- **Normal events**: Blue icon background (`bg-blue-100 text-blue-800`)
- **Error events**: Red icon background and card border (`bg-red-100 text-red-800`, `bg-red-50 border-red-200`)
- **Timeline**: Gray vertical line connecting events (`border-l-2 border-gray-200`)
- **Responsive**: Mobile-first with `sm:` breakpoints

## Accessibility

- **ARIA labels**: `role="region"`, `role="list"`, `role="listitem"`
- **Semantic HTML**: Uses semantic elements (`<h3>`, `<div>`, `<span>`)
- **Screen reader support**: Descriptive labels for icons and events
- **Keyboard navigation**: All interactive elements are keyboard accessible

## Testing

See `tests/unit/components/escrow-payment-audit-trail.test.tsx` for unit tests.

## Dependencies

- `date-fns` - For relative timestamp formatting (`formatDistanceToNow`)
- React - Component framework
- Tailwind CSS - Styling

## Notes

- Logs are sorted by `createdAt` descending (most recent first)
- Empty state shown when no logs available
- IP addresses displayed in monospace font for readability
- Device type shown with icon and text
- Full timestamp shown on hover over relative time
