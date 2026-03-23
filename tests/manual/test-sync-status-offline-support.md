# Manual Testing Guide: Sync Status and Offline Support

## Overview

This guide provides step-by-step instructions for manually testing the enhanced offline support features, including sync status indicators and background sync improvements.

## Prerequisites

- Application running locally or on test environment
- Browser DevTools open (for network throttling)
- Test user account with case creation permissions
- Multiple browser tabs (for cross-tab sync testing)

## Test Scenarios

### Scenario 1: Online Status Indicator

**Objective:** Verify online/offline indicator displays correctly

**Steps:**
1. Open the application in browser
2. Navigate to dashboard
3. Locate sync status indicator in header
4. Verify green wifi icon is displayed
5. Verify "Synced" or "Online" text is shown
6. Open DevTools → Network tab
7. Enable "Offline" mode
8. Verify indicator changes to red wifi-off icon
9. Verify "Offline" text is shown
10. Disable "Offline" mode
11. Verify indicator returns to green wifi icon

**Expected Results:**
- ✅ Green wifi icon when online
- ✅ Red wifi-off icon when offline
- ✅ Status text updates correctly
- ✅ Smooth transition between states

---

### Scenario 2: Create Case While Offline

**Objective:** Verify cases can be created and stored offline

**Steps:**
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Navigate to case creation page
4. Fill in case details:
   - Claim Reference: TEST-OFFLINE-001
   - Asset Type: Vehicle
   - Market Value: 5,000,000
   - Add at least one photo
   - Add GPS location
5. Submit the case
6. Verify success message appears
7. Check sync status indicator
8. Verify pending count badge appears (shows "1")
9. Open DevTools → Application → IndexedDB
10. Expand "salvage-management-db"
11. Verify case is stored in "offlineCases" store
12. Verify syncStatus is "pending"

**Expected Results:**
- ✅ Case created successfully while offline
- ✅ Case stored in IndexedDB
- ✅ Sync status shows pending count
- ✅ Badge displays "1"
- ✅ No errors in console

---

### Scenario 3: Auto-Sync on Connection Restore

**Objective:** Verify automatic sync when going back online

**Steps:**
1. Ensure you have at least one pending offline case (from Scenario 2)
2. Verify sync status shows pending count
3. Open DevTools → Network tab
4. Disable "Offline" mode
5. Wait for auto-sync to trigger (should be immediate)
6. Observe sync status indicator
7. Verify spinning refresh icon appears
8. Verify progress bar is displayed
9. Wait for sync to complete
10. Verify checkmark icon appears
11. Verify pending count badge disappears
12. Check server/database to confirm case was synced

**Expected Results:**
- ✅ Auto-sync triggers within 1-2 seconds
- ✅ Progress bar shows sync progress
- ✅ Spinning icon during sync
- ✅ Pending count decreases to 0
- ✅ Case appears in server database
- ✅ Success notification (optional)

---

### Scenario 4: Sync Progress Display

**Objective:** Verify sync progress is displayed accurately

**Steps:**
1. Create 5 offline cases (repeat Scenario 2 five times)
2. Verify sync status shows "5" in badge
3. Go back online
4. Observe sync progress bar
5. Verify progress shows "1/5", "2/5", etc.
6. Verify percentage updates (20%, 40%, 60%, 80%, 100%)
7. Verify current case reference is displayed
8. Wait for all cases to sync
9. Verify progress bar disappears after completion

**Expected Results:**
- ✅ Progress bar appears during sync
- ✅ Count updates for each case (1/5, 2/5, etc.)
- ✅ Percentage updates correctly
- ✅ Current case reference shown
- ✅ Progress bar disappears after 3 seconds

---

### Scenario 5: Manual Sync Trigger

**Objective:** Verify manual sync can be triggered by clicking

**Steps:**
1. Create 2 offline cases
2. Verify pending count shows "2"
3. Stay online (don't go offline)
4. Click on the sync status indicator
5. Observe sync starting immediately
6. Verify progress bar appears
7. Wait for sync to complete
8. Verify pending count becomes 0

**Expected Results:**
- ✅ Click triggers sync immediately
- ✅ Progress bar appears
- ✅ Cases sync successfully
- ✅ Pending count updates to 0
- ✅ No errors in console

---

### Scenario 6: Sync Status Tooltip

**Objective:** Verify detailed tooltip displays correct information

**Steps:**
1. Hover over sync status indicator
2. Verify tooltip appears
3. Check tooltip contains:
   - Connection status (Online/Offline)
   - Last sync timestamp
   - Pending changes count
   - Synced cases count
   - Error count (if any)
4. Create an offline case
5. Hover again
6. Verify pending count increased
7. Sync the case
8. Hover again
9. Verify synced count increased
10. Verify last sync timestamp updated

**Expected Results:**
- ✅ Tooltip appears on hover
- ✅ All information displayed correctly
- ✅ Counts update in real-time
- ✅ Last sync timestamp updates
- ✅ Tooltip disappears on mouse leave

---

### Scenario 7: Sync Error Handling

**Objective:** Verify sync errors are handled gracefully

**Steps:**
1. Create an offline case with invalid data (e.g., missing required field)
2. Go online
3. Wait for auto-sync
4. Observe sync status indicator
5. Verify amber alert icon appears
6. Hover over indicator
7. Verify error count shows "1"
8. Click "Sync Now" button in tooltip
9. Verify error persists
10. Check console for error details

**Expected Results:**
- ✅ Amber alert icon for errors
- ✅ Error count displayed
- ✅ Error message in tooltip
- ✅ Retry button available
- ✅ Error logged in console
- ✅ Case remains in error state

---

### Scenario 8: Cross-Tab Sync

**Objective:** Verify sync status updates across multiple tabs

**Steps:**
1. Open application in Tab 1
2. Open application in Tab 2
3. In Tab 1, go offline
4. In Tab 1, create 2 offline cases
5. Verify Tab 1 shows pending count "2"
6. Switch to Tab 2
7. Verify Tab 2 also shows pending count "2"
8. In Tab 1, go online
9. Wait for auto-sync in Tab 1
10. Switch to Tab 2
11. Verify Tab 2 also shows sync progress
12. Wait for sync to complete
13. Verify both tabs show "Synced" status

**Expected Results:**
- ✅ Pending count syncs across tabs
- ✅ Sync progress visible in all tabs
- ✅ Completion status updates in all tabs
- ✅ No duplicate syncs triggered

---

### Scenario 9: Storage Statistics

**Objective:** Verify storage statistics are accurate

**Steps:**
1. Navigate to Settings page (or wherever SyncStatusExtended is used)
2. Verify "Storage" section is displayed
3. Check initial statistics:
   - Total cases
   - Queue size
4. Create 3 offline cases
5. Refresh statistics (wait 30 seconds or reload)
6. Verify total cases increased by 3
7. Verify queue size increased by 3
8. Sync all cases
9. Refresh statistics
10. Verify queue size decreased to 0

**Expected Results:**
- ✅ Storage section displays
- ✅ Statistics are accurate
- ✅ Updates after creating cases
- ✅ Updates after syncing
- ✅ Auto-refreshes every 30 seconds

---

### Scenario 10: Offline Message Display

**Objective:** Verify offline message appears when offline

**Steps:**
1. Go offline
2. Hover over sync status indicator
3. Verify tooltip displays offline message
4. Check message says: "Changes will sync automatically when connection is restored"
5. Create an offline case
6. Hover again
7. Verify message still displays
8. Go online
9. Hover again
10. Verify offline message disappears

**Expected Results:**
- ✅ Offline message displays when offline
- ✅ Message is clear and helpful
- ✅ Message disappears when online
- ✅ No "Sync Now" button when offline

---

### Scenario 11: Last Sync Timestamp

**Objective:** Verify last sync timestamp updates correctly

**Steps:**
1. Ensure you're online with no pending cases
2. Hover over sync status
3. Note the "Last sync" timestamp
4. Create and sync a new case
5. Hover over sync status again
6. Verify timestamp shows "Just now"
7. Wait 2 minutes
8. Hover again
9. Verify timestamp shows "2m ago"
10. Wait 1 hour
11. Hover again
12. Verify timestamp shows "1h ago"

**Expected Results:**
- ✅ Timestamp shows "Just now" immediately after sync
- ✅ Updates to "Xm ago" after minutes
- ✅ Updates to "Xh ago" after hours
- ✅ Updates to "Xd ago" after days
- ✅ Shows "Never" if never synced

---

### Scenario 12: Multiple Pending Cases

**Objective:** Verify handling of many pending cases

**Steps:**
1. Go offline
2. Create 10 offline cases
3. Verify pending count shows "10"
4. Verify badge is visible and readable
5. Go online
6. Observe sync progress
7. Verify progress bar updates for each case
8. Verify all 10 cases sync successfully
9. Verify pending count becomes 0

**Expected Results:**
- ✅ Badge displays double-digit numbers correctly
- ✅ Progress bar handles 10 cases smoothly
- ✅ All cases sync without errors
- ✅ Performance remains good
- ✅ No UI freezing or lag

---

### Scenario 13: Sync During Navigation

**Objective:** Verify sync continues during page navigation

**Steps:**
1. Create 5 offline cases
2. Go online to trigger sync
3. While sync is in progress, navigate to different page
4. Verify sync status indicator still shows progress
5. Navigate back to original page
6. Verify sync completes successfully
7. Verify all cases were synced

**Expected Results:**
- ✅ Sync continues during navigation
- ✅ Progress indicator persists across pages
- ✅ All cases sync successfully
- ✅ No sync interruption

---

### Scenario 14: Accessibility Testing

**Objective:** Verify component is accessible

**Steps:**
1. Enable screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate to sync status indicator using Tab key
3. Verify focus indicator is visible
4. Verify screen reader announces status
5. Press Enter to trigger manual sync
6. Verify screen reader announces sync progress
7. Test with keyboard only (no mouse)
8. Verify all functionality is accessible

**Expected Results:**
- ✅ Focus indicator visible
- ✅ Screen reader announces status
- ✅ Keyboard accessible
- ✅ ARIA labels present
- ✅ Progress bar has ARIA attributes

---

### Scenario 15: Mobile Responsive Testing

**Objective:** Verify component works on mobile devices

**Steps:**
1. Open DevTools → Toggle device toolbar
2. Select mobile device (iPhone, Android)
3. Verify sync status displays correctly
4. Verify badge is readable
5. Tap on sync status
6. Verify tooltip appears
7. Verify touch targets are adequate (44x44px minimum)
8. Test in portrait and landscape
9. Test on actual mobile device if available

**Expected Results:**
- ✅ Component displays correctly on mobile
- ✅ Badge is readable
- ✅ Touch targets are adequate
- ✅ Tooltip works on tap
- ✅ Works in both orientations

---

## Test Data Cleanup

After completing all tests:

1. Open DevTools → Application → IndexedDB
2. Delete "salvage-management-db" database
3. Clear Service Worker cache
4. Delete test cases from server database
5. Reload application to verify clean state

## Known Issues / Limitations

Document any issues found during testing:

- Issue 1: [Description]
- Issue 2: [Description]
- Issue 3: [Description]

## Test Results Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Online Status Indicator | ⬜ Pass / ⬜ Fail | |
| 2. Create Case Offline | ⬜ Pass / ⬜ Fail | |
| 3. Auto-Sync | ⬜ Pass / ⬜ Fail | |
| 4. Sync Progress | ⬜ Pass / ⬜ Fail | |
| 5. Manual Sync | ⬜ Pass / ⬜ Fail | |
| 6. Tooltip | ⬜ Pass / ⬜ Fail | |
| 7. Error Handling | ⬜ Pass / ⬜ Fail | |
| 8. Cross-Tab Sync | ⬜ Pass / ⬜ Fail | |
| 9. Storage Stats | ⬜ Pass / ⬜ Fail | |
| 10. Offline Message | ⬜ Pass / ⬜ Fail | |
| 11. Last Sync Time | ⬜ Pass / ⬜ Fail | |
| 12. Multiple Cases | ⬜ Pass / ⬜ Fail | |
| 13. Sync During Nav | ⬜ Pass / ⬜ Fail | |
| 14. Accessibility | ⬜ Pass / ⬜ Fail | |
| 15. Mobile Responsive | ⬜ Pass / ⬜ Fail | |

**Overall Result:** ⬜ Pass / ⬜ Fail

**Tested By:** _______________

**Date:** _______________

**Browser/Device:** _______________

**Notes:**
