# Tier Upgrade Components

This directory contains components for managing vendor tier upgrades in the Salvage Management System.

## Components

### 1. TierUpgradeModal

A modal dialog that displays when a Tier 1 vendor attempts to access an auction above ₦500,000.

**Features:**
- Shows Tier 2 benefits (unlimited bidding, priority support, leaderboard eligibility)
- Displays required documents for Tier 2 verification
- Provides "Upgrade Now" button that redirects to Tier 2 KYC page
- Can be dismissed with "Maybe Later" button

**Usage:**
```tsx
import { TierUpgradeModal } from '@/components/ui/tier-upgrade-modal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <TierUpgradeModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      auctionValue={750000} // Optional: shows specific auction value
    />
  );
}
```

**Props:**
- `isOpen: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal is closed
- `auctionValue?: number` - Optional auction value to display

---

### 2. TierUpgradeBanner

A dismissible banner that appears in the vendor dashboard to promote Tier 2 upgrades.

**Features:**
- Shows count of high-value auctions available
- Automatically reappears 3 days after dismissal
- Stores dismiss state in localStorage
- Provides "Upgrade Now" button

**Usage:**
```tsx
import { TierUpgradeBanner } from '@/components/ui/tier-upgrade-banner';

function VendorDashboard() {
  const highValueAuctionCount = 5; // Get from API
  
  return (
    <div>
      {/* Only show for Tier 1 vendors */}
      {isTier1 && (
        <TierUpgradeBanner highValueAuctionCount={highValueAuctionCount} />
      )}
      {/* Rest of dashboard */}
    </div>
  );
}
```

**Props:**
- `highValueAuctionCount?: number` - Number of auctions above ₦500k (optional)

**Behavior:**
- Banner is visible by default
- When dismissed, stores timestamp in localStorage
- Reappears after 3 days (259,200,000 milliseconds)
- Uses key: `tier-upgrade-banner-dismissed`

---

## Hook

### useTierUpgrade

A custom hook for managing tier-based auction access and upgrade prompts.

**Features:**
- Checks if vendor can access auctions based on tier
- Manages upgrade modal state
- Provides tier information and limits
- Triggers callbacks when upgrade is required

**Usage:**
```tsx
import { useTierUpgrade } from '@/hooks/use-tier-upgrade';

function AuctionList() {
  const {
    checkAuctionAccess,
    showUpgradeModal,
    closeUpgradeModal,
    blockedAuctionValue,
    isTier1,
    TIER_1_LIMIT,
  } = useTierUpgrade({
    currentTier: 'tier1_bvn', // or 'tier2_full'
    onUpgradeRequired: (value) => {
      console.log(`Upgrade required for ₦${value}`);
    },
  });

  const handleAuctionClick = (auctionValue: number) => {
    const hasAccess = checkAuctionAccess(auctionValue);
    if (hasAccess) {
      // Navigate to auction
    }
    // Modal will show automatically if access denied
  };

  return (
    <>
      {/* Auction list */}
      <TierUpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        auctionValue={blockedAuctionValue}
      />
    </>
  );
}
```

**API:**

```typescript
interface UseTierUpgradeOptions {
  currentTier: 'tier1_bvn' | 'tier2_full';
  onUpgradeRequired?: (auctionValue: number) => void;
}

// Returns:
{
  canAccessAuction: (auctionValue: number) => boolean;
  checkAuctionAccess: (auctionValue: number) => boolean;
  showUpgradeModal: boolean;
  closeUpgradeModal: () => void;
  blockedAuctionValue: number | undefined;
  getTierLimit: () => number | null;
  isTier1: boolean;
  isTier2: boolean;
  TIER_1_LIMIT: number; // 500000
}
```

---

## Integration Example

Complete example showing all components working together:

```tsx
'use client';

import { useState } from 'react';
import { TierUpgradeBanner } from '@/components/ui/tier-upgrade-banner';
import { TierUpgradeModal } from '@/components/ui/tier-upgrade-modal';
import { useTierUpgrade } from '@/hooks/use-tier-upgrade';

export default function VendorDashboard() {
  // Get vendor data from auth context or API
  const vendorTier = 'tier1_bvn'; // or 'tier2_full'
  const highValueAuctionCount = 5;

  const {
    showUpgradeModal,
    closeUpgradeModal,
    blockedAuctionValue,
    checkAuctionAccess,
    isTier1,
  } = useTierUpgrade({
    currentTier: vendorTier,
    onUpgradeRequired: (value) => {
      // Optional: Track analytics
      console.log(`Tier upgrade required for ₦${value}`);
    },
  });

  const handleAuctionClick = (auctionValue: number) => {
    const hasAccess = checkAuctionAccess(auctionValue);
    if (hasAccess) {
      // Navigate to auction details
      router.push(`/vendor/auctions/${auctionId}`);
    }
    // Modal shows automatically if blocked
  };

  return (
    <div>
      {/* Show banner only for Tier 1 vendors */}
      {isTier1 && (
        <TierUpgradeBanner highValueAuctionCount={highValueAuctionCount} />
      )}

      {/* Dashboard content */}
      <div>
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onClick={() => handleAuctionClick(auction.value)}
          />
        ))}
      </div>

      {/* Upgrade modal */}
      <TierUpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        auctionValue={blockedAuctionValue}
      />
    </div>
  );
}
```

---

## Requirements Satisfied

This implementation satisfies **Requirement 5: Tier 2 Upgrade Prompts**:

1. ✅ Modal displays when Tier 1 vendor clicks auction >₦500k
2. ✅ Shows Tier 2 benefits (unlimited bidding, priority support, leaderboard)
3. ✅ "Upgrade Now" button redirects to Tier 2 KYC page
4. ✅ Dismissible banner in vendor dashboard
5. ✅ Banner reappears every 3 days after dismissal
6. ✅ Shows count of high-value auctions when available

---

## Testing

All components have comprehensive unit tests:

```bash
# Run all tier upgrade tests
npm run test:unit -- tests/unit/components/tier-upgrade-modal.test.tsx
npm run test:unit -- tests/unit/components/tier-upgrade-banner.test.tsx
npm run test:unit -- tests/unit/hooks/use-tier-upgrade.test.ts

# Run all tests together
npm run test:unit -- tests/unit/components/tier-upgrade-modal.test.tsx tests/unit/components/tier-upgrade-banner.test.tsx tests/unit/hooks/use-tier-upgrade.test.ts --run
```

**Test Coverage:**
- Modal: 9 tests covering rendering, interactions, navigation
- Banner: 10 tests covering visibility, dismissal, localStorage persistence
- Hook: 13 tests covering tier logic, access control, state management

---

## Styling

Components use:
- **Tailwind CSS** for styling
- **NEM Insurance brand colors**: Burgundy (#800020) and Gold (#FFD700)
- **Lucide React** icons (Crown, Zap, TrendingUp, Award, X, ArrowRight)
- **Responsive design** for mobile and desktop
- **Gradient backgrounds** and hover effects

---

## Accessibility

- Proper ARIA labels on interactive elements
- Keyboard navigation support
- Focus management for modal
- Semantic HTML structure
- Color contrast compliance

---

## Browser Support

- Chrome 100+
- Safari 15+
- Firefox 100+
- Edge 100+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Notes

- Banner uses localStorage, so it's client-side only
- Modal backdrop prevents interaction with underlying content
- All components are client components (`'use client'`)
- Tier limit is hardcoded to ₦500,000 (can be made configurable if needed)
