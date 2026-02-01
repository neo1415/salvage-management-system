# Countdown Timer Component

A reusable countdown timer component for displaying time remaining until a deadline.

## Features

- ✅ **Multiple Formats**: Automatically adjusts format based on time remaining
  - `>24h`: "Xd Xh Xm Xs" (e.g., "2d 5h 30m 15s")
  - `1-24h`: "Xh Xm Xs" (e.g., "5h 30m 15s")
  - `<1h`: "Xm Xs" (e.g., "30m 15s")
- ✅ **Color Coding**: Visual urgency indicators
  - Green: >24 hours remaining
  - Yellow: 1-24 hours remaining
  - Red: <1 hour remaining
- ✅ **Pulsing Animation**: Automatically pulses when <1 hour remaining
- ✅ **Real-time Updates**: Updates every second
- ✅ **Server Time Sync**: Optional server time offset for accurate countdown
- ✅ **Notification Callbacks**: Trigger actions at 1 hour and 30 minutes remaining
- ✅ **Compact Mode**: Space-saving format for mobile/inline use
- ✅ **Accessibility**: ARIA live region for screen readers

## Components

### `CountdownTimer`
The base countdown timer component.

```tsx
import { CountdownTimer } from '@/components/ui/countdown-timer';

<CountdownTimer
  endTime={new Date('2024-12-31T23:59:59')}
  onComplete={() => console.log('Time is up!')}
  onOneHourRemaining={() => console.log('1 hour left')}
  onThirtyMinutesRemaining={() => console.log('30 minutes left')}
/>
```

### `CountdownTimerCard`
A card wrapper with label and icon.

```tsx
import { CountdownTimerCard } from '@/components/ui/countdown-timer';

<CountdownTimerCard
  endTime={auctionEndTime}
  label="Auction Ends In"
  showIcon={true}
/>
```

### `InlineCountdownTimer`
A compact inline version for lists and cards.

```tsx
import { InlineCountdownTimer } from '@/components/ui/countdown-timer';

<InlineCountdownTimer endTime={auctionEndTime} />
```

## Props

### CountdownTimer Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `endTime` | `string \| Date` | Yes | - | Target end time (ISO string or Date object) |
| `onComplete` | `() => void` | No | - | Callback when countdown reaches zero |
| `onOneHourRemaining` | `() => void` | No | - | Callback when 1 hour remaining (for push notification) |
| `onThirtyMinutesRemaining` | `() => void` | No | - | Callback when 30 minutes remaining (for SMS notification) |
| `className` | `string` | No | `''` | Custom CSS classes |
| `serverTimeOffset` | `number` | No | `0` | Server time offset in milliseconds |
| `compact` | `boolean` | No | `false` | Use compact format (no seconds) |

### CountdownTimerCard Props

Extends `CountdownTimer` props with:

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | No | `'Time Remaining'` | Label text above timer |
| `showIcon` | `boolean` | No | `true` | Show clock icon |

## Usage Examples

### Basic Usage

```tsx
const auctionEndTime = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

<CountdownTimer endTime={auctionEndTime} />
```

### With Callbacks

```tsx
<CountdownTimer
  endTime={paymentDeadline}
  onComplete={() => {
    // Show modal or redirect
    alert('Payment deadline reached!');
  }}
  onOneHourRemaining={() => {
    // Send push notification
    sendPushNotification('1 hour remaining to pay');
  }}
  onThirtyMinutesRemaining={() => {
    // Send SMS notification
    sendSMS('30 minutes remaining to pay');
  }}
/>
```

### Card Format

```tsx
<CountdownTimerCard
  endTime={auctionEndTime}
  label="Auction Ends In"
  showIcon={true}
/>
```

### Inline in Auction Card

```tsx
<div className="auction-card">
  <h4>Toyota Camry 2020</h4>
  <p>Current Bid: ₦450,000</p>
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-600">Ends in:</span>
    <InlineCountdownTimer endTime={auctionEndTime} />
  </div>
</div>
```

### With Server Time Sync

```tsx
// Fetch server time and calculate offset
const serverTime = await fetch('/api/time').then(r => r.json());
const serverTimeOffset = serverTime.timestamp - Date.now();

<CountdownTimer
  endTime={auctionEndTime}
  serverTimeOffset={serverTimeOffset}
/>
```

### Compact Format for Mobile

```tsx
<CountdownTimer
  endTime={auctionEndTime}
  compact={true}
  className="text-sm"
/>
```

## Requirements

This component implements:
- **Requirement 17**: Live Countdown Timers
- **NFR5.3**: User Experience

## Testing

The component includes comprehensive tests:
- **Property-based tests**: `tests/unit/components/countdown-timer.test.ts`
  - Validates formatting for all time ranges
  - Validates color coding
  - Validates pulse animation
  - Validates time component bounds
- **Component tests**: `tests/unit/components/countdown-timer-component.test.tsx`
  - Tests rendering and behavior
  - Tests callbacks
  - Tests variants (card, inline)

Run tests:
```bash
npm run test:unit -- tests/unit/components/countdown-timer --run
```

## Accessibility

- Uses `aria-live="polite"` for screen reader announcements
- Uses `aria-atomic="true"` to announce full time remaining
- Semantic HTML with proper color contrast ratios

## Performance

- Updates every 1 second using `setInterval`
- Cleans up interval on unmount
- Minimal re-renders using React hooks
- No external dependencies beyond React

## Browser Support

- Chrome 100+
- Safari 15+
- Firefox 100+
- Edge 100+
- Mobile browsers (iOS Safari, Chrome Mobile)
