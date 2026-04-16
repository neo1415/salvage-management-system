# AuctionScheduleSelector Component

A reusable, mobile-optimized component for scheduling auction start times in the manager approval workflow.

## Features

- ✅ Two modes: "Start Now" (default) or "Schedule for Later"
- ✅ Date picker using existing Calendar component
- ✅ Time picker with hour and minute selection
- ✅ Timezone display (Africa/Lagos - WAT)
- ✅ Validation for future dates
- ✅ Error handling and user feedback
- ✅ Mobile-optimized with burgundy theme (#800020)
- ✅ Consistent with existing UI components

## Installation

The component is already integrated with the existing UI component library. No additional installation required.

## Usage

### Basic Usage

```tsx
import { AuctionScheduleSelector, AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';
import { useState } from 'react';

function MyComponent() {
  const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
    mode: 'now',
  });

  return (
    <AuctionScheduleSelector
      value={scheduleValue}
      onChange={setScheduleValue}
    />
  );
}
```

### With Minimum Date

```tsx
<AuctionScheduleSelector
  value={scheduleValue}
  onChange={setScheduleValue}
  minDate={new Date()} // Prevent scheduling in the past
/>
```

### In Manager Approval Page

```tsx
// In src/app/(dashboard)/manager/approvals/page.tsx

const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
  mode: 'now',
});

// In your approval form
<div className="space-y-4">
  <AuctionScheduleSelector
    value={scheduleValue}
    onChange={setScheduleValue}
    minDate={new Date()}
  />
  
  <button
    onClick={handleApprove}
    disabled={scheduleValue.mode === 'scheduled' && !scheduleValue.scheduledTime}
  >
    Approve Case
  </button>
</div>

// In your approval handler
const handleApprove = async () => {
  const payload = {
    caseId: selectedCase.id,
    action: 'approve',
    auctionStartMode: scheduleValue.mode,
    auctionStartTime: scheduleValue.scheduledTime?.toISOString(),
    // ... other approval data
  };
  
  await fetch('/api/cases/approve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
```

## Props

### `AuctionScheduleSelectorProps`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `AuctionScheduleValue` | Yes | - | Current schedule value |
| `onChange` | `(value: AuctionScheduleValue) => void` | Yes | - | Callback when value changes |
| `minDate` | `Date` | No | `new Date()` | Minimum selectable date |
| `className` | `string` | No | - | Additional CSS classes |

### `AuctionScheduleValue`

```typescript
interface AuctionScheduleValue {
  mode: 'now' | 'scheduled';
  scheduledTime?: Date;
}
```

## Validation

The component automatically validates:

1. **Future Date**: Scheduled time must be in the future
2. **Minimum Date**: Scheduled time must be after `minDate` prop
3. **Date Selection**: Date must be selected when in scheduled mode

Error messages are displayed inline when validation fails.

## Styling

The component uses:
- Burgundy theme color: `#800020`
- Consistent with existing Button, Calendar, and Popover components
- Mobile-optimized with responsive grid layouts
- Focus states for accessibility

## Accessibility

- Keyboard navigation support
- Focus indicators on all interactive elements
- ARIA labels for screen readers
- Semantic HTML structure

## Mobile Optimization

- Touch-friendly button sizes (min 44x44px)
- Responsive grid layouts
- Optimized popover positioning
- Clear visual feedback

## Examples

### Start Now Mode

```tsx
{
  mode: 'now'
}
```

### Scheduled Mode

```tsx
{
  mode: 'scheduled',
  scheduledTime: new Date('2024-02-15T09:00:00')
}
```

## Backend Integration

When submitting to the API, send the schedule value:

```typescript
// API Request Body
{
  caseId: string;
  action: 'approve';
  auctionStartMode: 'now' | 'scheduled';
  auctionStartTime?: string; // ISO 8601 format
}
```

### API Handler Example

```typescript
// In your API route
export async function POST(req: Request) {
  const { auctionStartMode, auctionStartTime } = await req.json();
  
  let auctionStartDate: Date;
  
  if (auctionStartMode === 'now') {
    auctionStartDate = new Date();
  } else {
    auctionStartDate = new Date(auctionStartTime);
    
    // Validate future date
    if (auctionStartDate <= new Date()) {
      return Response.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }
  }
  
  // Create auction with scheduled start time
  await createAuction({
    caseId,
    startTime: auctionStartDate,
    // ... other auction data
  });
}
```

## Testing

### Unit Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AuctionScheduleSelector } from './auction-schedule-selector';

describe('AuctionScheduleSelector', () => {
  it('renders with default "Start Now" mode', () => {
    const onChange = jest.fn();
    render(
      <AuctionScheduleSelector
        value={{ mode: 'now' }}
        onChange={onChange}
      />
    );
    
    expect(screen.getByText('Start Now')).toBeInTheDocument();
  });
  
  it('switches to scheduled mode', () => {
    const onChange = jest.fn();
    render(
      <AuctionScheduleSelector
        value={{ mode: 'now' }}
        onChange={onChange}
      />
    );
    
    fireEvent.click(screen.getByText('Schedule'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'scheduled' })
    );
  });
});
```

## Troubleshooting

### Error: "Scheduled time must be in the future"

**Solution**: Ensure the selected date and time combination is in the future. The component validates against the current time.

### Calendar not showing

**Solution**: Verify that the Popover component is properly imported and the Calendar component is available.

### Styling issues

**Solution**: Ensure Tailwind CSS is configured and the burgundy color `#800020` is available in your theme.

## Related Components

- `Calendar` - Date selection
- `Button` - Action buttons
- `Label` - Form labels
- `Popover` - Calendar dropdown
- `Input` - Form inputs

## Changelog

### v1.0.0 (2024-02-14)
- Initial release
- Two-mode selection (Now/Scheduled)
- Date and time picker
- Validation and error handling
- Mobile optimization
