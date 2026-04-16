# Case Approval appUrl Error - Fixed

## Issue
```
ReferenceError: appUrl is not defined
at POST (src\app\api\cases\[id]\approve\route.ts:459:21)
```

Error occurred when sending email to adjuster after case approval.

---

## Root Cause

The `appUrl` variable was defined inside the vendor notification block (line 387) but was being used outside that scope when sending emails to the adjuster (line 459).

```typescript
// appUrl defined here (line 387)
if (scheduleData.mode === 'now') {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
  // ... vendor notifications
}

// But used here (line 459) - OUT OF SCOPE!
await emailService.sendCaseApprovalEmail(creator.email, {
  // ...
  appUrl: appUrl, // ❌ ReferenceError
});
```

---

## Fix Applied

Moved `appUrl` definition to the top of the approval block so it's in scope for all notifications:

```typescript
if (body.action === 'approve') {
  // APPROVE CASE
  
  // Define appUrl for use in notifications
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com';
  
  // Determine final values to use...
  const aiEstimates = {
    // ...
  };
```

Removed the duplicate definition inside the vendor notification block.

---

## Files Modified

- `src/app/api/cases/[id]/approve/route.ts`

---

## Verification

✅ No syntax errors  
✅ Variable in scope for all email notifications  
✅ Works for both vendor notifications and adjuster notifications  

---

## Impact

Case approvals will now complete successfully without email errors. Both vendor notifications and adjuster notifications will include the correct app URL.

---

**Status**: Fixed ✅  
**Date**: April 13, 2026
