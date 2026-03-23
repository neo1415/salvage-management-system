# Trust Badges Component

## Overview

The `TrustBadges` component displays trust and verification badges for vendors based on their tier, rating, and performance metrics. This component helps build credibility and trust by visually highlighting vendor achievements and verifications.

## Features

- **Verified BVN Badge** (Tier 1): Green checkmark indicating BVN verification
- **Verified Business Badge** (Tier 2): Blue building icon for full business verification
- **Top Rated Badge**: Yellow award icon for vendors with ≥4.5 star rating
- **Fast Payer Badge**: Purple lightning icon for vendors with <6 hour average payment time
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Accessible**: Full ARIA support and keyboard navigation
- **Customizable**: Multiple sizes, layouts, and styling options
- **Tooltips**: Hover tooltips explaining each badge

## Usage

### Basic Usage

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

### Size Variants

```tsx
// Small badges (for compact layouts)
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  size="sm"
/>

// Medium badges (default)
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  size="md"
/>

// Large badges (for prominent display)
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  size="lg"
/>
```

### Layout Options

```tsx
// Horizontal layout (default)
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  layout="horizontal"
/>

// Vertical layout (for sidebars)
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  layout="vertical"
/>
```

### Hide Labels (Icon Only)

```tsx
// Show only icons without text labels
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  showLabels={false}
/>
```

### Custom Styling

```tsx
// Add custom CSS classes
<TrustBadges
  tier="tier2_full"
  rating={4.8}
  avgPaymentTimeHours={4.5}
  className="mt-4 justify-center"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tier` | `'tier1_bvn' \| 'tier2_full'` | Required | Vendor's verification tier |
| `rating` | `number` | Required | Vendor's average rating (0-5) |
| `avgPaymentTimeHours` | `number` | Required | Average payment time in hours |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Badge size |
| `layout` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `showLabels` | `boolean` | `true` | Show badge text labels |
| `className` | `string` | `''` | Additional CSS classes |

## Badge Criteria

### Verified BVN (Tier 1)
- **Displayed when**: Vendor has completed Tier 1 KYC (BVN verification)
- **Icon**: Green checkmark
- **Tooltip**: "This vendor's identity has been verified via BVN (Bank Verification Number)"

### Verified Business (Tier 2)
- **Displayed when**: Vendor has completed Tier 2 KYC (full business verification)
- **Icon**: Blue building
- **Tooltip**: "This vendor has completed full business verification with CAC, NIN, and bank account verification"

### Top Rated
- **Displayed when**: Vendor rating ≥ 4.5 stars
- **Icon**: Yellow award
- **Tooltip**: "This vendor has an average rating of 4.5 stars or higher"

### Fast Payer
- **Displayed when**: Average payment time < 6 hours (and > 0)
- **Icon**: Purple lightning
- **Tooltip**: "This vendor completes payments in less than 6 hours on average"

## Integration Examples

### Vendor Profile Page

```tsx
import { TrustBadges } from '@/components/vendor/trust-badges';

export default function VendorProfilePage({ vendor }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{vendor.businessName}</h1>
          <TrustBadges
            tier={vendor.tier}
            rating={parseFloat(vendor.rating)}
            avgPaymentTimeHours={vendor.performanceStats.avgPaymentTimeHours}
            size="lg"
          />
        </div>
        {/* Rest of profile content */}
      </div>
    </div>
  );
}
```

### Auction Bid List

```tsx
import { TrustBadges } from '@/components/vendor/trust-badges';

export function BidList({ bids }) {
  return (
    <div className="space-y-2">
      {bids.map((bid) => (
        <div key={bid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded">
          <div>
            <p className="font-semibold">{bid.vendor.businessName}</p>
            <p className="text-sm text-gray-600">₦{bid.amount.toLocaleString()}</p>
          </div>
          <TrustBadges
            tier={bid.vendor.tier}
            rating={parseFloat(bid.vendor.rating)}
            avgPaymentTimeHours={bid.vendor.performanceStats.avgPaymentTimeHours}
            size="sm"
            showLabels={false}
          />
        </div>
      ))}
    </div>
  );
}
```

### Leaderboard

```tsx
import { TrustBadges } from '@/components/vendor/trust-badges';

export function Leaderboard({ vendors }) {
  return (
    <div className="space-y-4">
      {vendors.map((vendor, index) => (
        <div key={vendor.id} className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
          <div className="flex-1">
            <h3 className="font-semibold">{vendor.businessName}</h3>
            <TrustBadges
              tier={vendor.tier}
              rating={parseFloat(vendor.rating)}
              avgPaymentTimeHours={vendor.performanceStats.avgPaymentTimeHours}
              size="sm"
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Win Rate</p>
            <p className="text-lg font-bold">{vendor.performanceStats.winRate}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Mobile Vendor Card

```tsx
import { TrustBadges } from '@/components/vendor/trust-badges';

export function VendorCard({ vendor }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">{vendor.businessName}</h3>
          <p className="text-sm text-gray-600">
            {vendor.performanceStats.totalWins} wins • {vendor.rating}★
          </p>
        </div>
      </div>
      <TrustBadges
        tier={vendor.tier}
        rating={parseFloat(vendor.rating)}
        avgPaymentTimeHours={vendor.performanceStats.avgPaymentTimeHours}
        size="sm"
        layout="horizontal"
      />
    </div>
  );
}
```

## Accessibility

The component follows WCAG 2.1 Level AA guidelines:

- **ARIA Labels**: Each badge has a descriptive `aria-label`
- **Role Attributes**: Badges use `role="img"` for screen readers
- **Tooltips**: Hover tooltips provide additional context
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Color Contrast**: All badge colors meet 4.5:1 contrast ratio

## Testing

The component includes comprehensive unit tests covering:

- Badge display logic for all criteria
- Tooltip content verification
- Size variants
- Layout options
- Label display
- Custom styling
- Accessibility features
- Edge cases

Run tests:
```bash
npm run test:unit -- trust-badges.test.tsx
```

## Performance

- **Lightweight**: Minimal bundle size with tree-shaking
- **No External Dependencies**: Uses only Lucide React for icons
- **Optimized Rendering**: Conditional rendering prevents unnecessary DOM nodes
- **CSS-based Animations**: Smooth hover effects using CSS transitions

## Browser Support

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+
- Mobile browsers (iOS Safari, Chrome Mobile, Samsung Internet)

## Related Components

- `VendorProfile`: Full vendor profile display
- `RatingModal`: Vendor rating submission
- `Leaderboard`: Vendor rankings display

## Requirements

This component implements **Requirement 38: Trust Badges Display** from the Salvage Management System specification.
