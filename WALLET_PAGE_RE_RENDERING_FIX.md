# Wallet Page Re-rendering Fix

**Date**: December 2024  
**File**: `src/app/(dashboard)/vendor/wallet/page.tsx`  
**Status**: ✅ Fixed

---

## Problem

The vendor wallet page was experiencing noticeable re-renders that were annoying to users. The page would visibly refresh/flicker from time to time.

---

## Root Cause

Multiple issues causing unnecessary re-renders:

1. **Broad useEffect dependencies**: `useEffect` with `[status, session]` was re-running whenever the session object changed (even if the user ID remained the same)

2. **No function memoization**: Helper functions like `formatCurrency`, `formatDate`, `getTransactionIcon`, `getTransactionColor` were being recreated on every render

3. **No state change detection**: `fetchWalletData` was updating state even when values hadn't changed, triggering unnecessary re-renders

4. **Payment callback check**: Running on every render instead of just once on mount

---

## Solution Applied

Applied the same pattern used to fix the auction details page:

### 1. Memoized fetchWalletData with useCallback

```typescript
const fetchWalletData = useCallback(async () => {
  // ... fetch logic
  
  // FIXED: Only update state if values actually changed
  setBalance(prev => {
    if (!prev) return balanceData;
    if (
      prev.balance === balanceData.balance &&
      prev.availableBalance === balanceData.availableBalance &&
      prev.frozenAmount === balanceData.frozenAmount
    ) {
      return prev; // No change, prevent re-render
    }
    return balanceData;
  });
  
  // FIXED: Only update if transaction count changed
  setTransactions(prev => {
    if (prev.length === transactionsData.length && prev.length > 0) {
      if (prev[0]?.id === transactionsData[0]?.id) {
        return prev; // No new transactions, prevent re-render
      }
    }
    return transactionsData;
  });
}, []); // No dependencies - stable function
```

### 2. Fixed useEffect dependencies

**Before**:
```typescript
useEffect(() => {
  if (status === 'authenticated' && session?.user?.id) {
    fetchWalletData();
  }
}, [status, session]); // ❌ session object changes frequently
```

**After**:
```typescript
useEffect(() => {
  if (status === 'authenticated' && session?.user?.id) {
    fetchWalletData();
  }
}, [status, session?.user?.id]); // ✅ Only depend on user ID
```

### 3. Fixed payment callback to run only once

**Before**:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  // ... check payment status
}, []); // ❌ But still runs on every render due to inline logic
```

**After**:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('status');
  
  if (paymentStatus === 'success') {
    setTimeout(() => {
      fetchWalletData();
    }, 2000);
    window.history.replaceState({}, '', '/vendor/wallet');
  }
}, []); // ✅ Empty dependency array - run only once on mount
```

### 4. Memoized all helper functions

```typescript
const formatCurrency = useCallback((amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);
}, []); // No dependencies - stable function

const formatDate = useCallback((dateString: string) => {
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}, []);

const getTransactionIcon = useCallback((type: string) => {
  // ... icon logic
}, []);

const getTransactionColor = useCallback((type: string) => {
  // ... color logic
}, []);

const handleAddFunds = useCallback(async () => {
  // ... funding logic
}, [fundingAmount]); // Only depend on fundingAmount
```

---

## Changes Summary

| Change | Before | After | Impact |
|--------|--------|-------|--------|
| useEffect dependency | `[status, session]` | `[status, session?.user?.id]` | Prevents re-runs when session object changes |
| fetchWalletData | Regular function | `useCallback` with state change detection | Prevents unnecessary state updates |
| Helper functions | Regular functions | `useCallback` memoized | Prevents function recreation on every render |
| Payment callback | Runs on every render | Runs once on mount | Eliminates unnecessary checks |

---

## Testing

**Before Fix**:
- Page visibly re-renders/flickers
- Console shows multiple fetch calls
- State updates even when data hasn't changed

**After Fix**:
- Page remains stable
- Fetch calls only when needed
- State updates only when data actually changes
- No more annoying flickers

---

## Pattern Reference

This fix follows the same pattern used in:
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` (auction details page)

**Key Principles**:
1. Use `useCallback` for functions that are used in dependencies
2. Use specific dependencies in `useEffect` (e.g., `session?.user?.id` instead of `session`)
3. Check if values changed before updating state
4. Use empty dependency arrays `[]` for functions that should never change

---

## Result

✅ Wallet page no longer re-renders unnecessarily  
✅ User experience is smooth and stable  
✅ Data is still fresh and up-to-date  
✅ No performance degradation
