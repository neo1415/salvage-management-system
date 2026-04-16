# AuctionScheduleSelector Integration Guide

This guide shows how to integrate the `AuctionScheduleSelector` component into the manager approval page.

## Component Overview

The `AuctionScheduleSelector` is a reusable component that allows managers to:
- Start auctions immediately upon approval
- Schedule auctions to start at a specific date and time
- View timezone information (Africa/Lagos - WAT)
- Validate scheduled times are in the future

## Files Created

1. **Component**: `src/components/ui/auction-schedule-selector.tsx`
2. **Example**: `src/components/ui/auction-schedule-selector.example.tsx`
3. **Documentation**: `src/components/ui/auction-schedule-selector.md`
4. **Tests**: `src/components/ui/__tests__/auction-schedule-selector.test.tsx`
5. **Demo Page**: `src/app/demo/auction-schedule/page.tsx`

## Quick Start

### 1. View the Demo

Visit the demo page to see the component in action:
```
http://localhost:3000/demo/auction-schedule
```

### 2. Import the Component

```typescript
import { AuctionScheduleSelector, AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';
```

### 3. Add State Management

```typescript
const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
  mode: 'now',
});
```

### 4. Render the Component

```tsx
<AuctionScheduleSelector
  value={scheduleValue}
  onChange={setScheduleValue}
  minDate={new Date()}
/>
```

## Integration into Manager Approval Page

### Step 1: Update State

In `src/app/(dashboard)/manager/approvals/page.tsx`, add the schedule state:

```typescript
// Add this with other state declarations
const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
  mode: 'now',
});
```

### Step 2: Reset State on Case Selection

Update the `handleCaseSelect` function to reset the schedule value:

```typescript
const handleCaseSelect = (caseData: CaseData) => {
  setSelectedCase(caseData);
  // ... other resets
  setScheduleValue({ mode: 'now' }); // Add this line
};
```

### Step 3: Add Component to UI

Add the component in the approval form section (around line 800-900):

```tsx
{/* Auction Duration Selector */}
<div className="bg-white rounded-lg shadow-md p-4">
  <h3 className="font-bold text-gray-900 mb-3">Auction Duration</h3>
  <AuctionDurationSelector
    value={auctionDurationHours}
    onChange={setAuctionDurationHours}
  />
</div>

{/* ADD THIS NEW SECTION */}
{/* Auction Schedule Selector */}
<div className="bg-white rounded-lg shadow-md p-4">
  <h3 className="font-bold text-gray-900 mb-3">Auction Start Time</h3>
  <AuctionScheduleSelector
    value={scheduleValue}
    onChange={setScheduleValue}
    minDate={new Date()}
  />
</div>
```

### Step 4: Update API Call

Modify the `handleSubmit` function to include schedule data:

```typescript
const response = await fetch(`/api/cases/${selectedCase.id}/approve`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: approvalAction,
    comment: comment.trim() || overrideComment.trim() || undefined,
    priceOverrides: hasOverrides ? priceOverrides : undefined,
    auctionDurationHours: approvalAction === 'approve' ? auctionDurationHours : undefined,
    // ADD THESE LINES
    auctionStartMode: scheduleValue.mode,
    auctionStartTime: scheduleValue.scheduledTime?.toISOString(),
  }),
});
```

### Step 5: Update Backend API

In `src/app/api/cases/[id]/approve/route.ts`, handle the schedule data:

```typescript
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const {
    action,
    comment,
    priceOverrides,
    auctionDurationHours,
    auctionStartMode,
    auctionStartTime,
  } = body;

  // ... existing validation

  if (action === 'approve') {
    // Determine auction start time
    let auctionStartDate: Date;
    
    if (auctionStartMode === 'scheduled' && auctionStartTime) {
      auctionStartDate = new Date(auctionStartTime);
      
      // Validate future date
      if (auctionStartDate <= new Date()) {
        return Response.json(
          { error: 'Scheduled time must be in the future' },
          { status: 400 }
        );
      }
    } else {
      // Default to immediate start
      auctionStartDate = new Date();
    }

    // Create auction with scheduled start time
    const auction = await db.insert(auctions).values({
      caseId: caseData.id,
      startTime: auctionStartDate,
      endTime: new Date(auctionStartDate.getTime() + auctionDurationHours * 60 * 60 * 1000),
      // ... other auction fields
    });

    // If scheduled for later, don't notify vendors yet
    if (auctionStartMode === 'scheduled') {
      // Set up a scheduled job to notify vendors at start time
      // This could be done with a cron job or scheduled task
    } else {
      // Notify vendors immediately
      await notifyVendors(auction);
    }
  }

  // ... rest of the handler
}
```

## Validation

The component automatically validates:

1. **Future Date**: Scheduled time must be in the future
2. **Minimum Date**: Scheduled time must be after `minDate` prop
3. **Date Selection**: Date must be selected when in scheduled mode

Error messages are displayed inline when validation fails.

## Scheduled Auction Handling

### Option 1: Cron Job (Recommended)

Create a cron job that checks for auctions scheduled to start:

```typescript
// src/app/api/cron/start-scheduled-auctions/route.ts
export async function GET(request: Request) {
  const now = new Date();
  
  // Find auctions scheduled to start now
  const auctionsToStart = await db
    .select()
    .from(auctions)
    .where(
      and(
        eq(auctions.status, 'scheduled'),
        lte(auctions.startTime, now)
      )
    );

  for (const auction of auctionsToStart) {
    // Update status to active
    await db
      .update(auctions)
      .set({ status: 'active' })
      .where(eq(auctions.id, auction.id));

    // Notify vendors
    await notifyVendors(auction);
  }

  return Response.json({ started: auctionsToStart.length });
}
```

### Option 2: Database Trigger

Use a database trigger to automatically update auction status when start time is reached.

### Option 3: Background Job Queue

Use a job queue (like Bull or BullMQ) to schedule vendor notifications.

## Testing

### Manual Testing

1. Visit `/demo/auction-schedule` to test the component
2. Try both "Start Now" and "Schedule" modes
3. Verify validation works (try selecting past dates)
4. Check mobile responsiveness

### Unit Tests

Run the unit tests:

```bash
npm test src/components/ui/__tests__/auction-schedule-selector.test.tsx
```

### Integration Testing

Test the full approval flow:

1. Log in as a manager
2. Navigate to `/manager/approvals`
3. Select a pending case
4. Try scheduling an auction
5. Verify the auction is created with correct start time

## Mobile Optimization

The component is fully mobile-optimized:
- Touch-friendly buttons (min 44x44px)
- Responsive grid layouts
- Optimized popover positioning
- Clear visual feedback

## Accessibility

- Keyboard navigation support
- Focus indicators on all interactive elements
- ARIA labels for screen readers
- Semantic HTML structure

## Troubleshooting

### Issue: Calendar not showing

**Solution**: Verify that the Popover component is properly imported and working.

### Issue: Validation errors not showing

**Solution**: Check that the `minDate` prop is set correctly and the component state is being updated.

### Issue: Scheduled auctions not starting

**Solution**: Ensure the cron job or scheduled task is running and checking for auctions to start.

## Next Steps

1. **Add to Manager Approval Page**: Follow the integration steps above
2. **Implement Backend Logic**: Update the API to handle scheduled auctions
3. **Set Up Cron Job**: Create a scheduled task to start auctions at the right time
4. **Test Thoroughly**: Test both immediate and scheduled auction flows
5. **Monitor**: Add logging to track scheduled auction starts

## Support

For questions or issues:
- Check the component documentation: `src/components/ui/auction-schedule-selector.md`
- View the demo page: `/demo/auction-schedule`
- Review the example: `src/components/ui/auction-schedule-selector.example.tsx`

## Related Components

- `AuctionDurationSelector` - Sets auction duration
- `Calendar` - Date selection
- `Button` - Action buttons
- `Popover` - Calendar dropdown
