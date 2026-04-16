# Documents Page Navigation Fix

## Problem
When clicking "View Documents" button from auction detail page, the documents page showed "No Documents Yet" message even though documents existed. Refreshing the page would then show the documents correctly.

## Root Cause
The `useCachedDocuments` hook only refetches data when:
1. `auctionId` prop changes
2. `isOffline` status changes

When navigating with a URL hash (`/vendor/documents#auction-{id}`):
- The page component doesn't remount (same route)
- The `auctionId` prop is `null` (fetching all auctions)
- The `isOffline` status doesn't change
- Therefore, the hook uses stale cached data instead of fetching fresh data

## Solution

### 1. Force Refresh on Hash Navigation
Detect when the page loads with a hash and force a data refresh:

```typescript
const [isHashRefreshing, setIsHashRefreshing] = useState(false);

useEffect(() => {
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('auction-')) {
      const auctionId = hash.replace('auction-', '');
      setScrollToAuctionId(auctionId);
      
      // Force refresh to get fresh data
      setIsHashRefreshing(true);
      refresh().finally(() => {
        setIsHashRefreshing(false);
      });
    }
  }
}, []);
```

### 2. Show Loading State During Refresh
Display loading indicator while fetching fresh data:

```typescript
if (isLoading || isHashRefreshing) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
        <p className="text-gray-600">Loading documents...</p>
      </div>
    </div>
  );
}
```

### 3. Scroll to Auction After Load
Wait for documents to load, then scroll to the specific auction:

```typescript
useEffect(() => {
  if (scrollToAuctionId && auctionDocuments.length > 0 && !isLoading) {
    setTimeout(() => {
      const element = document.getElementById(`auction-${scrollToAuctionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setScrollToAuctionId(null);
      } else {
        console.warn(`Element auction-${scrollToAuctionId} not found in DOM`);
      }
    }, 300); // Wait for DOM to render
  }
}, [scrollToAuctionId, auctionDocuments, isLoading]);
```

## User Flow

### Before Fix
1. User wins auction
2. User clicks "View Documents" button
3. Page navigates to `/vendor/documents#auction-{id}`
4. Page shows "No Documents Yet" (using stale cache)
5. User refreshes page manually
6. Documents appear

### After Fix
1. User wins auction
2. User clicks "View Documents" button
3. Page navigates to `/vendor/documents#auction-{id}`
4. Page detects hash and forces refresh
5. Loading indicator shows while fetching
6. Documents load and page scrolls to auction
7. User sees their documents immediately

## Testing

### Manual Test
1. Win an auction (or use existing won auction)
2. Go to auction detail page
3. Click "View Documents" button
4. Verify:
   - Loading indicator appears briefly
   - Documents load without manual refresh
   - Page scrolls to the correct auction
   - No "No Documents Yet" message

### Diagnostic Script
Run the diagnostic script to find test auctions:

```bash
npx tsx scripts/test-documents-navigation.ts
```

This will show:
- Recent closed/awaiting_payment auctions
- Which auctions have documents
- Which auctions have payments
- Sample auction ID for testing

### Test URL Format
```
/vendor/documents#auction-{auction-id}
```

Example:
```
/vendor/documents#auction-260582d5-5c55-4ca5-8e22-609fef09b7f3
```

## Technical Details

### Cache Behavior
The `useCachedDocuments` hook:
- Caches documents in IndexedDB for offline access
- Only refetches when dependencies change
- Falls back to cache when offline

### Why Force Refresh?
- Ensures user sees latest documents
- Handles case where documents were just generated
- Prevents showing stale "no documents" state
- Better UX than requiring manual refresh

### Performance Impact
- One additional API call when navigating with hash
- Minimal impact (only happens on hash navigation)
- Better than showing stale data

## Files Modified

1. `src/app/(dashboard)/vendor/documents/page.tsx`
   - Added `isHashRefreshing` state
   - Added hash detection and forced refresh
   - Added loading state during refresh
   - Increased scroll delay to 300ms

2. `scripts/test-documents-navigation.ts` (NEW)
   - Diagnostic script for testing
   - Shows auctions with documents
   - Provides test URLs

## Related Issues

This fix also addresses:
- Documents not appearing after payment completion
- Stale cache showing when navigating between pages
- Need to manually refresh to see new documents

## Future Improvements

1. **Real-time Updates**: Use WebSocket to push document updates
2. **Optimistic UI**: Show "Generating documents..." state
3. **Cache Invalidation**: Invalidate cache when documents are generated
4. **Prefetching**: Prefetch documents when user wins auction

---

**Status**: ✅ Complete
**Date**: 2026-04-14
**Impact**: Eliminates need for manual refresh when viewing documents
