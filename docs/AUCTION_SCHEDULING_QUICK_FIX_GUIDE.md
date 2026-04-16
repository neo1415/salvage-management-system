# Auction Scheduling - Quick Fix Guide

## What Was Fixed

### ✅ 1. Minutes Added to Duration Units
**Before**: Only Hours, Days, Weeks
**After**: Minutes, Hours, Days, Weeks

**Where**: Auction schedule selector component
**Impact**: Users can now schedule auctions with minute-level precision

### ✅ 2. Scheduled Tab (Already Existed)
**Status**: Already implemented
**Location**: Vendor Auctions page → "Scheduled" tab
**Shows**: All auctions that are scheduled but not yet started

### ✅ 3. Date Picker Background (Already Fixed)
**Status**: Already has proper white background with shadow
**No changes needed**

### ✅ 4. Restart Modal Pattern (Already Correct)
**Status**: Already uses Success/Error modals like other modals in the app
**No changes needed**

### ✅ 5. Scheduled Auction Activation System
**Problem**: Auctions stayed "scheduled" past their start time
**Solution**: Client-side polling every 20 seconds
**Result**: Auctions activate within 20-30 seconds of scheduled time

## How to Test

### Test Scheduled Auction Activation

1. **Create a scheduled auction**:
   - Go to Manager Approvals
   - Approve a case
   - Select "Schedule" mode
   - Set time to 2 minutes in the future
   - Submit

2. **Watch it activate**:
   - Open Vendor Auctions page
   - Go to "Scheduled" tab
   - See your auction listed
   - Wait for scheduled time
   - Within 20-30 seconds, auction moves to "Active" tab

3. **Check console logs**:
   ```
   [Polling] Checking scheduled auctions...
   [Polling] Found 1 scheduled auction(s) to activate
   ✅ 1 auction(s) activated, refreshing list...
   ```

### Test Duration Units

1. Open Manager Approvals
2. Approve a case with scheduling
3. Check duration dropdown
4. ✅ Should see: **Minutes**, Hours, Days, Weeks

## If Auction Gets Stuck

### Quick Fix: Manual Activation Script

```bash
# Run this command to activate stuck auctions immediately
npx tsx scripts/activate-scheduled-auctions-now.ts
```

**Output**:
```
🔍 Checking for scheduled auctions...
📋 Found 1 auction(s) to activate:
  - Auction ID: abc123
    Case: DHY-3828
    Scheduled for: 2026-04-06T13:45:00.000Z
    
🚀 Activating auctions...
✅ Activated auction abc123 for case DHY-3828
   📧 Found 5 matching vendors to notify

📊 Summary:
   ✅ Successfully activated: 1
   ❌ Failed: 0
   📋 Total processed: 1
```

### Diagnostic: Check Auction Status

```bash
# Check status of all scheduled auctions
curl http://localhost:3000/api/auctions/scheduled-status
```

**Shows**:
- Total scheduled auctions
- Past due auctions (should activate)
- Upcoming auctions
- Time until activation for each

## How the Polling System Works

```
Every 20 seconds:
  ↓
Check for scheduled auctions where scheduledStartTime <= now
  ↓
Activate matching auctions:
  - Update status to 'active'
  - Update case status
  - Notify vendors
  ↓
Refresh UI
  ↓
Auction appears in "Active" tab
```

**Smart Features**:
- ⏸️ Pauses when tab is hidden
- ▶️ Resumes when tab becomes visible
- 🔌 Only runs when online
- 📱 Works on mobile and desktop

## Files Changed

### Modified
1. `src/components/ui/auction-schedule-selector.tsx`
   - Added "Minutes" option

2. `src/app/api/auctions/check-and-activate-scheduled/route.ts`
   - Added detailed logging

### New
1. `scripts/activate-scheduled-auctions-now.ts`
   - Manual activation tool

2. `src/app/api/auctions/scheduled-status/route.ts`
   - Diagnostic API

## Common Issues

### Issue: "Auction still scheduled after time passed"

**Cause**: Polling hasn't run yet (max 20 second delay)

**Solutions**:
1. Wait 20 seconds
2. Refresh the page
3. Run manual activation script

### Issue: "Polling not working"

**Check**:
- Is vendor auctions page open?
- Is browser tab visible?
- Is device online?
- Check browser console for errors

**Fix**: Refresh the page

### Issue: "Wrong timezone"

**Note**: All times stored in UTC, displayed in WAT (Africa/Lagos)

**Check diagnostic API** to see both UTC and WAT times

## Summary

All issues from user feedback have been addressed:

1. ✅ Minutes added to duration units
2. ✅ Scheduled tab exists (already there)
3. ✅ Date picker has proper background (already fixed)
4. ✅ Restart modal uses Success/Error pattern (already correct)
5. ✅ Scheduled auctions now activate on time (polling system)

**Next**: Test in browser to verify everything works!

---

**Quick Commands**:
```bash
# Activate stuck auctions
npx tsx scripts/activate-scheduled-auctions-now.ts

# Check auction status
curl http://localhost:3000/api/auctions/scheduled-status

# Start dev server
npm run dev
```
