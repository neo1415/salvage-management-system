# Push Notifications - Integration Example

This guide shows you how to add push notification support to your app in 3 simple steps.

---

## Step 1: Run the Migration

```bash
npx tsx scripts/run-push-notifications-migration.ts
```

This creates the database tables and sets up default preferences for all users.

---

## Step 2: Add Notification Preferences Button

### Option A: Add to Vendor Dashboard Header

```tsx
// In src/components/vendor/vendor-dashboard-content.tsx or similar

import { useState } from 'react';
import { NotificationPreferencesModal } from '@/components/notifications/notification-preferences-modal';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function VendorDashboard() {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <div>
      {/* Existing dashboard content */}
      
      {/* Add this button somewhere visible */}
      <Button
        variant="outline"
        onClick={() => setShowPreferences(true)}
        className="flex items-center gap-2"
      >
        <Bell className="h-4 w-4" />
        Notifications
      </Button>

      {/* Add the modal */}
      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />
    </div>
  );
}
```

### Option B: Add to User Settings Page

```tsx
// In src/app/(dashboard)/vendor/settings/page.tsx

import { NotificationPreferencesModal } from '@/components/notifications/notification-preferences-modal';
import { Bell } from 'lucide-react';

export default function SettingsPage() {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <div className="space-y-6">
      <h1>Settings</h1>
      
      {/* Notification Settings Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage how you receive notifications
            </p>
          </div>
          <button
            onClick={() => setShowPreferences(true)}
            className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018]"
          >
            Configure
          </button>
        </div>
      </div>

      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />
    </div>
  );
}
```

### Option C: Show on First Login (Onboarding)

```tsx
// In your main layout or dashboard component

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { NotificationPreferencesModal } from '@/components/notifications/notification-preferences-modal';

export function DashboardLayout() {
  const { data: session } = useSession();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('push-onboarding-seen');
    
    if (!hasSeenOnboarding && session?.user) {
      // Show after 2 seconds
      setTimeout(() => {
        setShowOnboarding(true);
        localStorage.setItem('push-onboarding-seen', 'true');
      }, 2000);
    }
  }, [session]);

  return (
    <div>
      {/* Your dashboard content */}
      
      <NotificationPreferencesModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
```

---

## Step 3: Send Push Notifications

### Example 1: Send Outbid Alert

```typescript
// In src/features/auctions/services/bidding.service.ts

import { sendOutbidAlert } from '@/features/notifications/services/push-subscription.service';

export async function placeBid(
  auctionId: string,
  amount: number,
  userId: string
) {
  // ... existing bid placement logic ...

  // Get previous highest bidder
  const previousBidder = await getPreviousHighestBidder(auctionId);

  if (previousBidder) {
    // Send push notification
    const result = await sendOutbidAlert(
      previousBidder.userId,
      auctionId,
      auction.title,
      formatCurrency(amount),
      getTimeRemaining(auction.endTime)
    );

    console.log(`Push notification sent to ${result.sentCount} devices`);
  }

  // ... rest of logic ...
}
```

### Example 2: Send Auction Ending Soon

```typescript
// In src/app/api/cron/check-auction-endings/route.ts

import { sendAuctionEndingSoon } from '@/features/notifications/services/push-subscription.service';

export async function GET() {
  // Get auctions ending in 1 hour
  const endingSoon = await getAuctionsEndingInOneHour();

  for (const auction of endingSoon) {
    // Get all bidders
    const bidders = await getAuctionBidders(auction.id);

    // Notify each bidder
    for (const bidder of bidders) {
      await sendAuctionEndingSoon(
        bidder.userId,
        auction.id,
        auction.title,
        '1 hour'
      );
    }
  }

  return Response.json({ success: true });
}
```

### Example 3: Send Payment Confirmation

```typescript
// In src/app/api/webhooks/paystack/route.ts

import { sendPaymentConfirmation } from '@/features/notifications/services/push-subscription.service';

export async function POST(request: Request) {
  // ... verify webhook ...

  if (event.event === 'charge.success') {
    const payment = event.data;

    // Send push notification
    await sendPaymentConfirmation(
      payment.metadata.userId,
      payment.metadata.auctionTitle,
      formatCurrency(payment.amount / 100),
      payment.metadata.pickupAuthCode
    );
  }

  return Response.json({ success: true });
}
```

### Example 4: Send Leaderboard Update

```typescript
// In src/features/vendors/services/leaderboard.service.ts

import { sendLeaderboardUpdate } from '@/features/notifications/services/push-subscription.service';

export async function updateLeaderboard() {
  const previousRankings = await getPreviousRankings();
  const newRankings = await calculateNewRankings();

  for (const vendor of newRankings) {
    const previousPosition = previousRankings.find(
      (v) => v.id === vendor.id
    )?.position;

    if (previousPosition && previousPosition !== vendor.position) {
      const change = previousPosition - vendor.position;
      const changeStr = change > 0 ? `+${change}` : `${change}`;

      await sendLeaderboardUpdate(
        vendor.userId,
        vendor.position,
        changeStr
      );
    }
  }
}
```

---

## Testing

### Test in Browser Console

```javascript
// Check if push is supported
console.log('Push supported:', 'PushManager' in window);

// Check current permission
console.log('Permission:', Notification.permission);

// Get current subscription
navigator.serviceWorker.ready.then(async (registration) => {
  const subscription = await registration.pushManager.getSubscription();
  console.log('Subscription:', subscription);
});

// Test notification display
navigator.serviceWorker.ready.then((registration) => {
  registration.showNotification('Test', {
    body: 'This is a test notification',
    icon: '/icons/Nem-insurance-Logo.jpg',
  });
});
```

### Test Server-Side

Create a test API route:

```typescript
// src/app/api/test/push/route.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { sendPushToUser } from '@/features/notifications/services/push-subscription.service';

export async function POST() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendPushToUser(session.user.id, {
    title: 'Test Notification',
    body: 'This is a test push notification!',
    tag: 'test',
  });

  return Response.json(result);
}
```

Then call it:

```bash
curl -X POST http://localhost:3000/api/test/push \
  -H "Cookie: your-session-cookie"
```

---

## Troubleshooting

### Push notifications not appearing?

1. **Check browser support**:
   ```javascript
   console.log('Supported:', 'PushManager' in window);
   ```

2. **Check permission**:
   ```javascript
   console.log('Permission:', Notification.permission);
   ```
   If "denied", user must enable in browser settings.

3. **Check subscription**:
   ```javascript
   navigator.serviceWorker.ready.then(async (reg) => {
     const sub = await reg.pushManager.getSubscription();
     console.log('Subscribed:', !!sub);
   });
   ```

4. **Check service worker**:
   ```javascript
   navigator.serviceWorker.ready.then((reg) => {
     console.log('Service worker active:', !!reg.active);
   });
   ```

5. **Check VAPID keys**:
   ```bash
   echo $NEXT_PUBLIC_VAPID_PUBLIC_KEY
   echo $VAPID_PRIVATE_KEY
   ```

### Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Add to `.env`:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:nemsupport@nem-insurance.com
```

---

## Summary

That's it! Three simple steps:

1. ✅ Run migration
2. ✅ Add preferences button to UI
3. ✅ Send push notifications from your code

Users can now receive instant push notifications for:
- Being outbid
- Auctions ending soon
- Payment confirmations
- Leaderboard updates

The system automatically:
- Respects user preferences
- Falls back to SMS/Email if push fails
- Handles multiple devices per user
- Deactivates invalid subscriptions
- Tracks delivery success/failure

🎉 Push notifications are now fully functional!
