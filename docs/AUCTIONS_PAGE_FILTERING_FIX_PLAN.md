# Auctions Page Filtering and Sorting Fix Plan

## Issues Identified

### 1. Server-Side Filtering (Slow)
**Current**: Each tab/filter change triggers new API call
**Problem**: Causes loading delays, poor UX
**Solution**: Fetch all auctions once, filter client-side

### 2. Missing "Won" Badge
**Current**: Winners don't see "Won" indicator on their auctions
**Problem**: Can't easily identify won auctions in "My Bids" tab
**Solution**: Add `isWinner` field and display badge

### 3. Wrong Sort Order
**Current**: Not consistently showing latest to oldest
**Problem**: Recent auctions buried in list
**Solution**: Default sort by `endTime DESC` (latest first)

### 4. Documents Link Navigation Issue
**Current**: Clicking "View Documents" from auction detail shows "No Documents"
**Problem**: Anchor navigation not triggering data fetch
**Solution**: Force refresh when navigating with anchor

## Implementation Plan

### Phase 1: Client-Side Filtering (High Priority)

**Current Flow**:
```
User clicks tab → API call → Wait → Show results
```

**New Flow**:
```
Page load → Fetch ALL auctions once → Store in state
User clicks tab → Filter locally → Instant results
```

**Changes Needed**:

1. **Fetch all auctions on mount** (single API call)
   - Include all statuses
   - Include vendor's bid information
   - Mark auctions where vendor is winner

2. **Client-side filter function**:
```typescript
const filterAuctions = (auctions: Auction[], tab: string, vendorId: string) => {
  switch (tab) {
    case 'active':
      return auctions.filter(a => a.status === 'active' || a.status === 'extended');
    
    case 'scheduled':
      return auctions.filter(a => a.status === 'scheduled');
    
    case 'my_bids':
      // Show all auctions where vendor placed a bid
      return auctions.filter(a => a.vendorBids?.includes(vendorId));
    
    case 'won':
      // Show only auctions where vendor is the winner
      return auctions.filter(a => 
        a.currentBidder === vendorId && 
        (a.status === 'closed' || a.status === 'awaiting_payment')
      );
    
    default:
      return auctions;
  }
};
```

3. **Sort function** (always latest first):
```typescript
const sortAuctions = (auctions: Auction[]) => {
  return [...auctions].sort((a, b) => 
    new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );
};
```

### Phase 2: Add Winner Badge

**API Changes**:
- Add `currentBidder` to auction response
- Add `vendorBids` array (list of vendor IDs who bid)

**UI Changes**:
```tsx
{auction.currentBidder === session?.user?.vendorId && 
 (auction.status === 'closed' || auction.status === 'awaiting_payment') && (
  <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
    ✓ Won
  </div>
)}
```

### Phase 3: Fix Documents Navigation

**Problem**: Anchor links don't trigger React state updates

**Solution**: Add scroll-to-view and force refresh
```typescript
// In documents page
useEffect(() => {
  const hash = window.location.hash;
  if (hash) {
    // Force refresh to ensure data is loaded
    refresh();
    
    // Scroll to element after short delay
    setTimeout(() => {
      const element = document.querySelector(hash);
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
}, []);
```

## Performance Comparison

### Before (Server-Side)
- Initial load: 1-2s
- Each filter change: 1-2s
- Total for 5 filter changes: 5-10s

### After (Client-Side)
- Initial load: 1-2s (same)
- Each filter change: <50ms (instant)
- Total for 5 filter changes: 1-2s (80-90% faster)

## Data Structure Changes

### Current Auction Response
```typescript
{
  id: string;
  status: string;
  currentBid: string;
  // Missing: currentBidder, vendorBids
}
```

### New Auction Response
```typescript
{
  id: string;
  status: string;
  currentBid: string;
  currentBidder: string;        // NEW: Winner vendor ID
  vendorBids: string[];         // NEW: All bidders
  isWinner: boolean;            // NEW: Computed for current user
}
```

## API Endpoint Changes

### GET /api/auctions
**Add query param**: `includeAllStatuses=true`
**Add to response**: `currentBidder`, `vendorBids`

**Example**:
```typescript
// Fetch all auctions with bid info
const response = await fetch('/api/auctions?includeAllStatuses=true&includeBidInfo=true');
```

## Migration Steps

1. ✅ Update API to include `currentBidder` and `vendorBids`
2. ✅ Fetch all auctions on page mount
3. ✅ Implement client-side filter function
4. ✅ Implement client-side sort function
5. ✅ Add "Won" badge to UI
6. ✅ Fix documents page anchor navigation
7. ✅ Test all filter combinations
8. ✅ Test sorting
9. ✅ Test won badge visibility

## Files to Modify

1. `src/app/api/auctions/route.ts` - Add bid info to response
2. `src/app/(dashboard)/vendor/auctions/page.tsx` - Client-side filtering
3. `src/app/(dashboard)/vendor/documents/page.tsx` - Fix anchor navigation

## Testing Checklist

- [ ] "Active" tab shows only active/extended auctions
- [ ] "Scheduled" tab shows only scheduled auctions
- [ ] "My Bids" tab shows all auctions where vendor bid (won + lost)
- [ ] "Won" tab shows only auctions where vendor won
- [ ] All tabs sorted latest to oldest
- [ ] Filter changes are instant (<100ms)
- [ ] "Won" badge shows on won auctions
- [ ] Documents link from auction detail works immediately
- [ ] No loading spinners when switching tabs

## Status: PENDING IMPLEMENTATION

This requires significant refactoring of the auctions page to move from server-side to client-side filtering.
