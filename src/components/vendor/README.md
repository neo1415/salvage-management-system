# Vendor Components

This directory contains components related to vendor functionality.

## TrustBadges

A component for displaying trust and verification badges for vendors based on their tier, rating, and performance metrics.

### Features

- **Verified BVN Badge** (Tier 1): Green checkmark indicating BVN verification
- **Verified Business Badge** (Tier 2): Blue building icon for full business verification
- **Top Rated Badge**: Yellow award icon for vendors with ≥4.5 star rating
- **Fast Payer Badge**: Purple lightning icon for vendors with <6 hour average payment time
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Accessible**: Full ARIA support and keyboard navigation
- **Customizable**: Multiple sizes, layouts, and styling options
- **Tooltips**: Hover tooltips explaining each badge

### Usage

```tsx
import { TrustBadges } from '@/components/vendor/trust-badges';

function VendorProfile({ vendor }) {
  return (
    <div>
      <h2>{vendor.businessName}</h2>
      <TrustBadges
        tier={vendor.tier}
        rating={parseFloat(vendor.rating)}
        avgPaymentTimeHours={vendor.performanceStats.avgPaymentTimeHours}
      />
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tier` | `'tier1_bvn' \| 'tier2_full'` | Required | Vendor's verification tier |
| `rating` | `number` | Required | Vendor's average rating (0-5) |
| `avgPaymentTimeHours` | `number` | Required | Average payment time in hours |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Badge size |
| `layout` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `showLabels` | `boolean` | `true` | Show badge text labels |
| `className` | `string` | `''` | Additional CSS classes |

### Badge Criteria

- **Verified BVN**: Displayed for Tier 1 and Tier 2 vendors
- **Verified Business**: Displayed for Tier 2 vendors only
- **Top Rated**: Displayed when rating ≥ 4.5 stars
- **Fast Payer**: Displayed when average payment time < 6 hours (and > 0)

### Requirements

Implements **Requirement 38** from the specification:
- Displays trust badges on vendor profile, auction bid list, and leaderboard
- Shows tooltips on hover explaining badge meaning
- Supports multiple display contexts and sizes

### Related Files

- Component: `src/components/vendor/trust-badges.tsx`
- Tests: `tests/unit/components/trust-badges.test.tsx`
- Examples: `src/components/vendor/trust-badges.example.tsx`
- Documentation: `src/components/vendor/trust-badges.README.md`

---

## RatingModal

A modal component for rating vendors after pickup confirmation.

### Features

- **5-star overall rating**: Required rating from 1-5 stars
- **Category ratings**: Three required category ratings:
  - Payment Speed (1-5 stars)
  - Communication (1-5 stars)
  - Pickup Punctuality (1-5 stars)
- **Optional text review**: Up to 500 characters
- **Interactive star selection**: Hover effects and visual feedback
- **Form validation**: Ensures all required fields are filled
- **Loading states**: Disables form during submission
- **Error handling**: Displays error messages to users

### Usage

```tsx
import { RatingModal } from '@/components/vendor/rating-modal';
import { useState } from 'react';

function PickupConfirmationPage() {
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleRatingSubmit = async (data: {
    overallRating: number;
    categoryRatings: {
      paymentSpeed: number;
      communication: number;
      pickupPunctuality: number;
    };
    review?: string;
  }) => {
    // Call your API to submit the rating
    const response = await fetch(`/api/vendors/${vendorId}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auctionId: 'auction-123',
        ...data,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit rating');
    }

    // Show success message
    alert('Rating submitted successfully!');
  };

  return (
    <div>
      <button onClick={() => setShowRatingModal(true)}>
        Rate Vendor
      </button>

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        vendorId="vendor-123"
        vendorName="John's Auto Parts"
        auctionId="auction-456"
        onSubmit={handleRatingSubmit}
      />
    </div>
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `() => void` | Yes | Callback when modal should close |
| `vendorId` | `string` | Yes | ID of the vendor being rated |
| `vendorName` | `string` | Yes | Display name of the vendor |
| `auctionId` | `string` | Yes | ID of the auction/transaction |
| `onSubmit` | `(data) => Promise<void>` | Yes | Callback to handle rating submission |

### Validation Rules

1. **Overall rating**: Must be 1-5 stars (required)
2. **Category ratings**: All three categories must be rated 1-5 stars (required)
3. **Review**: Optional, maximum 500 characters
4. **Duplicate prevention**: The API should prevent rating the same transaction twice

### Styling

The component uses Tailwind CSS with the following color scheme:
- Primary: `burgundy-900` (#800020)
- Accent: `yellow-400` (for stars)
- Text: `gray-700`, `gray-900`
- Borders: `gray-200`, `gray-300`

### Accessibility

- All interactive elements have proper ARIA labels
- Star ratings are keyboard accessible
- Modal can be closed with the X button or Cancel button
- Form validation provides clear error messages

### Requirements

Implements **Requirement 37** from the specification:
- Displays after pickup confirmation
- Collects 5-star rating (1-5 stars)
- Collects optional text review (max 500 characters)
- Collects rating categories (payment speed, communication, pickup punctuality)

### Related Files

- Component: `src/components/vendor/rating-modal.tsx`
- Tests: `tests/unit/components/rating-modal.test.tsx`
- Service: `src/features/vendors/services/rating.service.ts`
- API: `src/app/api/vendors/[id]/ratings/route.ts`
- Schema: `src/lib/db/schema/ratings.ts`
