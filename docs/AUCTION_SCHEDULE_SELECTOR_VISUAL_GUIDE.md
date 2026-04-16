# AuctionScheduleSelector - Visual Guide

## Component Structure

```
┌─────────────────────────────────────────────────────────┐
│  Auction Start Time                                     │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │   🕐 Start Now   │  │  📅 Schedule     │           │
│  │   (Selected)     │  │                  │           │
│  └──────────────────┘  └──────────────────┘           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ ℹ️ Auction will start immediately                │  │
│  │ Vendors will be notified as soon as the case    │  │
│  │ is approved.                                     │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Scheduled Mode View

```
┌─────────────────────────────────────────────────────────┐
│  Auction Start Time                                     │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │   🕐 Start Now   │  │  📅 Schedule     │           │
│  │                  │  │   (Selected)     │           │
│  └──────────────────┘  └──────────────────┘           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  Select Date                                     │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 📅 Fri, Dec 31, 2024                       │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  │                                                  │  │
│  │  Select Time                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ Hour         │  │ Minute       │            │  │
│  │  │ 09 ▼        │  │ 00 ▼        │            │  │
│  │  └──────────────┘  └──────────────┘            │  │
│  │                                                  │  │
│  │  ─────────────────────────────────────────────  │  │
│  │  Timezone: Africa/Lagos (WAT)                   │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ ✓ Auction will start:                      │ │  │
│  │  │   Fri, Dec 31, 2024 at 09:00 WAT          │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Calendar Popover

```
┌─────────────────────────────────────────────────────────┐
│  Select Date                                            │
│  ┌────────────────────────────────────────────┐        │
│  │ 📅 Pick a date                             │ ◀─ Click│
│  └────────────────────────────────────────────┘        │
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │         December 2024                   │           │
│  │  ◀                                    ▶  │           │
│  │                                         │           │
│  │  Su  Mo  Tu  We  Th  Fr  Sa            │           │
│  │   1   2   3   4   5   6   7            │           │
│  │   8   9  10  11  12  13  14            │           │
│  │  15  16  17  18  19  20  21            │           │
│  │  22  23  24  25  26  27  28            │           │
│  │  29  30 [31]                           │           │
│  │                                         │           │
│  └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

## Error State

```
┌─────────────────────────────────────────────────────────┐
│  Auction Start Time                                     │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │   🕐 Start Now   │  │  📅 Schedule     │           │
│  │                  │  │   (Selected)     │           │
│  └──────────────────┘  └──────────────────┘           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  Select Date                                     │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 📅 Thu, Dec 12, 2024                       │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  │                                                  │  │
│  │  Select Time                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ Hour         │  │ Minute       │            │  │
│  │  │ 08 ▼        │  │ 00 ▼        │            │  │
│  │  └──────────────┘  └──────────────┘            │  │
│  │                                                  │  │
│  │  ─────────────────────────────────────────────  │  │
│  │  Timezone: Africa/Lagos (WAT)                   │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ ⚠️ Error: Scheduled time must be in the    │ │  │
│  │  │   future                                    │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Mobile View (375px width)

```
┌───────────────────────────┐
│  Auction Start Time       │
│                           │
│  ┌──────────┐            │
│  │🕐 Start  │            │
│  │  Now     │            │
│  └──────────┘            │
│  ┌──────────┐            │
│  │📅 Schedule│            │
│  │          │            │
│  └──────────┘            │
│                           │
│  ┌─────────────────────┐ │
│  │                     │ │
│  │  Select Date        │ │
│  │  ┌────────────────┐ │ │
│  │  │📅 Dec 31, 2024 │ │ │
│  │  └────────────────┘ │ │
│  │                     │ │
│  │  Select Time        │ │
│  │  ┌──────┐ ┌──────┐ │ │
│  │  │ 09 ▼│ │ 00 ▼│ │ │
│  │  └──────┘ └──────┘ │ │
│  │                     │ │
│  │  Timezone:          │ │
│  │  Africa/Lagos (WAT) │ │
│  │                     │ │
│  │  ┌────────────────┐ │ │
│  │  │✓ Auction will  │ │ │
│  │  │  start:        │ │ │
│  │  │  Dec 31 at     │ │ │
│  │  │  09:00 WAT     │ │ │
│  │  └────────────────┘ │ │
│  └─────────────────────┘ │
└───────────────────────────┘
```

## Color Scheme

### Primary (Burgundy)
- **Color**: `#800020`
- **Usage**: Selected mode button, focus rings
- **Hover**: `#600018`

### Secondary
- **Gray 50**: `#F9FAFB` - Background
- **Gray 200**: `#E5E7EB` - Borders
- **Gray 600**: `#4B5563` - Secondary text
- **Gray 900**: `#111827` - Primary text

### Status Colors
- **Success**: `#10B981` (Green) - Valid selection
- **Error**: `#EF4444` (Red) - Validation errors
- **Info**: `#3B82F6` (Blue) - Information messages

## Interactive States

### Button States

**Default (Unselected)**
```
┌──────────────────┐
│   🕐 Start Now   │  ← Gray border, white background
└──────────────────┘
```

**Selected**
```
┌──────────────────┐
│   🕐 Start Now   │  ← Burgundy border & background, white text
└──────────────────┘
```

**Hover (Unselected)**
```
┌──────────────────┐
│   🕐 Start Now   │  ← Darker gray border
└──────────────────┘
```

**Focus**
```
┌──────────────────┐
│   🕐 Start Now   │  ← Burgundy focus ring (2px)
└──────────────────┘
```

## Responsive Breakpoints

### Mobile (< 640px)
- Single column layout
- Full-width buttons
- Stacked time pickers

### Tablet (640px - 1024px)
- Two-column mode selection
- Two-column time picker
- Optimized popover positioning

### Desktop (> 1024px)
- Same as tablet
- Larger touch targets
- More spacing

## Accessibility Features

### Keyboard Navigation
- `Tab` - Move between elements
- `Enter/Space` - Select mode, open calendar
- `Arrow Keys` - Navigate calendar
- `Escape` - Close popover

### Screen Reader Announcements
- Mode selection: "Start Now button, selected"
- Date picker: "Select date, button, opens calendar"
- Time picker: "Hour, select, 09"
- Validation: "Error: Scheduled time must be in the future"

### Focus Indicators
- 2px burgundy ring on focus
- High contrast for visibility
- Visible on all interactive elements

## Animation & Transitions

### Mode Switch
- Smooth color transition (200ms)
- Background and border color change
- Text color fade

### Popover
- Fade in (150ms)
- Slide down (100ms)
- Smooth close animation

### Error Messages
- Fade in (200ms)
- Slide down (100ms)
- Red border pulse on validation

## Usage in Context

### Manager Approval Page Flow

```
1. Manager selects case
   ↓
2. Reviews case details
   ↓
3. Sets auction duration
   ↓
4. Chooses start time ← AuctionScheduleSelector
   ↓
5. Approves case
   ↓
6. Auction created with scheduled start
```

### Integration Points

```
Manager Approval Page
├── Case Details Card
├── Photo Gallery
├── AI Assessment
├── Price Override Section
├── Auction Duration Selector
└── Auction Schedule Selector ← New Component
    ├── Mode Selection
    ├── Date Picker (if scheduled)
    ├── Time Picker (if scheduled)
    └── Validation Messages
```

## Component Hierarchy

```
AuctionScheduleSelector
├── Mode Selection
│   ├── Start Now Button
│   └── Schedule Button
├── Scheduled Options (conditional)
│   ├── Date Picker
│   │   ├── Popover Trigger (Button)
│   │   └── Popover Content
│   │       └── Calendar Component
│   ├── Time Picker
│   │   ├── Hour Select
│   │   └── Minute Select
│   ├── Timezone Display
│   ├── Preview (conditional)
│   └── Error Message (conditional)
└── Info Message (Start Now mode)
```

## Best Practices

### Do's ✅
- Always set `minDate` to prevent past dates
- Reset state when case changes
- Validate on the backend as well
- Show clear error messages
- Use timezone display for clarity

### Don'ts ❌
- Don't allow past dates
- Don't skip validation
- Don't hide timezone information
- Don't use without minDate prop
- Don't forget to handle scheduled auctions

## Performance

### Optimization
- Memoized validation function
- Debounced time updates
- Lazy-loaded calendar
- Minimal re-renders

### Bundle Size
- Component: ~8KB (minified)
- Dependencies: Calendar, Button, Popover, Label
- Total impact: ~12KB (with dependencies)

---

**Visual Guide Version**: 1.0.0
**Last Updated**: 2024-02-14
