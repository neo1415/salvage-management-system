# AuctionTimerExtension Component

A compact, mobile-optimized component for salvage managers to manually extend active auction end times.

## Features

- ✅ Number input for extension amount (1-999)
- ✅ Dropdown for time unit selection (Minutes, Hours, Days, Weeks)
- ✅ Real-time preview of new end time
- ✅ Input validation (positive amounts only)
- ✅ Mobile-optimized with 44px touch targets
- ✅ Burgundy theme matching app design
- ✅ Error handling for failed extensions
- ✅ Loading states during submission
- ✅ Accessible form controls

## Installation

The component is located at:
```
src/components/manager/auction-timer-extension.tsx
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `auctionId` | `string` | Yes | The