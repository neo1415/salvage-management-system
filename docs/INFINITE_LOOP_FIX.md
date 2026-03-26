# CRITICAL BUG FIX: Infinite Loop in Case Creation

## Problem
After successfully creating a case, the app became unresponsive with the error:
```
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, 
but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

## Root Cause
The infinite loop was in `src/hooks/use-draft-auto-save.ts`:

1. **Line 77-84**: `refreshDrafts` function was defined with `useCallback` depending on `onError`
2. **Line 81-83**: A `useEffect` called `refreshDrafts()` with `refreshDrafts` in its dependency array
3. **Line 107**: Another `useEffect` (auto-save) called `refreshDrafts()` after saving

### The Loop:
```
onError changes (recreated on every render)
  → refreshDrafts recreated (useCallback dependency)
    → useEffect triggered (depends on refreshDrafts)
      → refreshDrafts() called
        → setDrafts() called
          → Component re-renders
            → onError recreated
              → LOOP REPEATS
```

## Solution
Changed the `useEffect` that loads drafts to only run **once on mount** using:
- Empty dependency array `[]`
- A ref to track if initial load is done
- ESLint disable comment to acknowledge the intentional design

### Code Changes
**File**: `src/hooks/use-draft-auto-save.ts`

**Before**:
```typescript
useEffect(() => {
  refreshDrafts();
}, [refreshDrafts]); // ❌ Causes infinite loop
```

**After**:
```typescript
// CRITICAL FIX: Use a ref to track if initial load is done
const initialLoadDone = useRef(false);

useEffect(() => {
  // Only load drafts once on mount
  if (!initialLoadDone.current) {
    initialLoadDone.current = true;
    refreshDrafts();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ Empty dependency array - only run on mount
```

## Why This Works
1. **Empty dependency array**: Ensures the effect only runs once when the component mounts
2. **Ref guard**: Prevents accidental double-execution in React StrictMode (development)
3. **Manual refresh**: The `refreshDrafts` function is still available for manual calls (after save/delete operations)

## Impact
- ✅ Case creation now redirects properly to "my cases" page
- ✅ No more infinite re-renders
- ✅ Draft auto-save still works correctly
- ✅ Manual draft refresh still works when needed (save/delete operations)

## Testing
1. Create a new case with photos
2. Fill in all required fields
3. Submit the case
4. Verify: Redirects to "my cases" page without hanging
5. Verify: No console errors about "Maximum update depth exceeded"

## Related Files
- `src/hooks/use-draft-auto-save.ts` - Fixed infinite loop
- `src/app/(dashboard)/adjuster/cases/new/page.tsx` - Uses the hook (no changes needed)
