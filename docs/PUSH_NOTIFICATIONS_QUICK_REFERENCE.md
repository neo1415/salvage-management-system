# Push Notifications - Quick Reference

## 🚀 Quick Start

```bash
# 1. Run migration
npx tsx scripts/run-push-notifications-migration.ts

# 2. Generate VAPID keys (if not done)
npx web-push generate-vapid-keys

# 3. Add to .env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:nemsupport@nem-insurance.com
```

---

## 📦 What Was Implemented

| Component | File | Purpose |
|-----------|------|---------|
| Database Schema | `src/lib/db/schema/push-subscriptions.ts` | Tables for subscriptions & preferences |
| Migration | `src/lib/db/migrations/0031_add_push_subscriptions.sql` | Creates tables |
| Subscribe API | `src/app/api/notifications/push/subscribe/route.ts` | Save/remove subscriptions |
| Preferences API | `src/app/api/notifications/preferences/route.ts` | Get/update preferences |
| React Hook | `src/hooks/use-push-notifications.ts` | Client-side subscription |
| UI Modal | `src/components/notifications/notification-preferences-modal.tsx` | Preferences UI |
| Server Service | `src/features/notifications/services/push-subscription.service.ts` | Send push notifications |
| Service Worker | `public/sw.js` | Display notifications |

---

## 🎯 Client-Side Usage

### Add Preferences Button

```tsx
import { useState } from 'react';
import { NotificationPreferencesModal } from '@/components/notifications/notification-preferences-modal';
import { Bell } from 'lucide-react';

function MyComponent() {
  const [show, setShow] = useState(false);

  return (
    <>
      <button onClick={() => setShow(true)}>
        <Bell /> Notifications
      </button>
      
      <NotificationPreferencesModal
        isOpen={show}
        onClose={() => setShow(false)}
      />
    </>
  );
}
```

### Use Hook Directly

```tsx
import { usePushNotifications } from '@/hooks/use-push-notifications';

function MyComponent() {
  const {
    permission,      // 'default' | 'granted' | 'denied'
    isSubscribed,    // boolean
    isSupported,     // boolean
    isLoading,       // boolean
    error,           // string | null
    subscribe,       // () => Promise<boolean>
    unsubscribe,     // () => Promise<boolean>
  } = usePushNotifications();

  return (
    <div>
      {isSupported && !isSubscribed && (
        <button onClick={subscribe}>
          Enable Push Notifications
        </button>
      )}
    </div>
  );
}
```

---

## 🔔 Server-Side Usage

### Send Outbid Alert

```typescript
import { sendOutbidAlert } from '@/features/notifications/services/push-subscription.service';

const result = await sendOutbidAlert(
  userId,
  auctionId,
  'Toyota Camry 2020',
  '₦2,500,000',
  '2 hours'
);

console.log(`Sent to ${result.sentCount} devices`);
```

### Send Auction Ending Soon

```typescript
import { sendAuctionEndingSoon } from '@/features/notifications/services/push-subscription.service';

await sendAuctionEndingSoon(
  userId,
  auctionId,
  'Toyota Camry 2020',
  '30 minutes'
);
```

### Send Payment Confirmation

```typescript
import { sendPaymentConfirmation } from '@/features/notifications/services/push-subscription.service';

await sendPaymentConfirmation(
  userId,
  'Toyota Camry 2020',
  '₦2,500,000',
  'AUTH-12345'
);
```

### Send Leaderboard Update

```typescript
import { sendLeaderboardUpdate } from '@/features/notifications/services/push-subscription.service';

await sendLeaderboardUpdate(
  userId,
  3,      // position
  '+2'    // change
);
```

### Send Custom Notification

```typescript
import { sendPushToUser } from '@/features/notifications/services/push-subscription.service';

await sendPushToUser(userId, {
  title: 'Custom Title',
  body: 'Custom message',
  icon: '/icons/custom-icon.png',
  tag: 'custom-tag',
  requireInteraction: false,
  data: {
    type: 'custom',
    customField: 'value',
  },
  actions: [
    { action: 'view', title: 'View' },
    { action: 'dismiss', title: 'Dismiss' },
  ],
});
```

---

## 🗄️ Database Queries

### Get User Subscriptions

```typescript
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema/push-subscriptions';
import { eq, and } from 'drizzle-orm';

const subscriptions = await db
  .select()
  .from(pushSubscriptions)
  .where(
    and(
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.active, true)
    )
  );
```

### Get User Preferences

```typescript
import { db } from '@/lib/db';
import { notificationPreferences } from '@/lib/db/schema/push-subscriptions';
import { eq } from 'drizzle-orm';

const [preferences] = await db
  .select()
  .from(notificationPreferences)
  .where(eq(notificationPreferences.userId, userId))
  .limit(1);
```

### Update Preferences

```typescript
await db
  .update(notificationPreferences)
  .set({
    pushEnabled: true,
    bidAlerts: true,
    updatedAt: new Date(),
  })
  .where(eq(notificationPreferences.userId, userId));
```

---

## 🧪 Testing

### Browser Console Tests

```javascript
// Check support
console.log('Supported:', 'PushManager' in window);

// Check permission
console.log('Permission:', Notification.permission);

// Get subscription
navigator.serviceWorker.ready.then(async (reg) => {
  const sub = await reg.pushManager.getSubscription();
  console.log('Subscription:', sub);
});

// Test notification
navigator.serviceWorker.ready.then((reg) => {
  reg.showNotification('Test', {
    body: 'Test notification',
    icon: '/icons/Nem-insurance-Logo.jpg',
  });
});
```

### Server-Side Test

```typescript
// Create test API route: src/app/api/test/push/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { sendPushToUser } from '@/features/notifications/services/push-subscription.service';

export async function POST() {
  const session = await getServerSession(authOptions);
  
  const result = await sendPushToUser(session.user.id, {
    title: 'Test',
    body: 'Test notification',
  });

  return Response.json(result);
}
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | User must enable in browser settings |
| Not supported | Use modern browser (Chrome 50+, Firefox 44+, Safari 16+) |
| No subscription | User hasn't enabled push notifications |
| VAPID error | Check environment variables are set |
| Service worker not active | Check service worker registration |
| Notification not showing | Check service worker push event handler |

### Check Environment Variables

```bash
echo $NEXT_PUBLIC_VAPID_PUBLIC_KEY
echo $VAPID_PRIVATE_KEY
echo $VAPID_SUBJECT
```

### Generate New VAPID Keys

```bash
npx web-push generate-vapid-keys
```

---

## 📊 Database Schema

### push_subscriptions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| endpoint | TEXT | Push endpoint URL |
| p256dh | TEXT | Encryption key |
| auth | TEXT | Authentication secret |
| user_agent | TEXT | Browser info |
| active | BOOLEAN | Is subscription active |
| created_at | TIMESTAMP | When created |
| updated_at | TIMESTAMP | Last updated |
| last_used_at | TIMESTAMP | Last notification sent |

### notification_preferences

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users (unique) |
| push_enabled | BOOLEAN | Push notifications enabled |
| sms_enabled | BOOLEAN | SMS notifications enabled |
| email_enabled | BOOLEAN | Email notifications enabled |
| bid_alerts | BOOLEAN | Outbid alerts enabled |
| auction_ending | BOOLEAN | Auction ending alerts enabled |
| payment_reminders | BOOLEAN | Payment reminders enabled |
| leaderboard_updates | BOOLEAN | Leaderboard updates enabled |
| created_at | TIMESTAMP | When created |
| updated_at | TIMESTAMP | Last updated |

---

## 🎨 UI Components

### NotificationPreferencesModal

```tsx
<NotificationPreferencesModal
  isOpen={boolean}
  onClose={() => void}
/>
```

**Features**:
- Channel toggles (Push, SMS, Email)
- Type toggles (Bid alerts, Auction ending, etc.)
- Browser support detection
- Permission status display
- Save/Cancel actions
- Success/Error feedback

### usePushNotifications Hook

```tsx
const {
  permission,      // NotificationPermission
  isSubscribed,    // boolean
  isSupported,     // boolean
  isLoading,       // boolean
  error,           // string | null
  subscribe,       // () => Promise<boolean>
  unsubscribe,     // () => Promise<boolean>
} = usePushNotifications();
```

---

## 📝 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/notifications/push/subscribe` | Subscribe to push |
| DELETE | `/api/notifications/push/subscribe?endpoint=...` | Unsubscribe |
| GET | `/api/notifications/preferences` | Get preferences |
| PUT | `/api/notifications/preferences` | Update preferences |

---

## 🌐 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 50+ | ✅ Full |
| Firefox | 44+ | ✅ Full |
| Edge | 17+ | ✅ Full |
| Safari | 16+ | ✅ Full (macOS 13+, iOS 16.4+) |
| Opera | 37+ | ✅ Full |
| IE | Any | ❌ Not supported |

---

## 📚 Resources

- [Web Push API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker Docs](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Spec](https://datatracker.ietf.org/doc/html/rfc8292)
- [web-push Library](https://github.com/web-push-libs/web-push)

---

## ✅ Checklist

- [ ] Run migration
- [ ] Set VAPID keys in .env
- [ ] Add preferences button to UI
- [ ] Test subscription in browser
- [ ] Send test notification
- [ ] Integrate with bidding service
- [ ] Integrate with auction closure
- [ ] Integrate with payment service
- [ ] Test on mobile devices
- [ ] Monitor delivery success rates

---

**Need help?** Check the full documentation in `PUSH_NOTIFICATIONS_IMPLEMENTATION_COMPLETE.md`
