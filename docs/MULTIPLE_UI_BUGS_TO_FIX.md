# Multiple UI Bugs and Issues to Fix

## Issue List

### 1. Transaction History API Error (500)
**Location:** Settings page → Transaction History
**Error:** 
```
GET /api/vendor/settings/transactions?type=bids&startDate=2026-02-19&endDate=2026-03-21&limit=20&offset=0 500
Error: TypeError: Cannot convert undefined or null to object at Object.entries
```
**Status:** ❌ Broken
**Priority:** HIGH

---

### 2. Bidding History - Voice Note Display
**Location:** Bidding history page
**Issue:** Voice recording component appears but doesn't work. Should display transcribed text instead.
**Expected:** Show the voice-to-text transcription in text format
**Current:** Shows non-functional voice recording component
**Status:** ❌ Broken
**Priority:** MEDIUM

---

### 3. Case Details - Voice Note Missing
**Location:** Case details page
**Issue:** Voice note transcription not displayed
**Expected:** Show the transcribed text from voice-to-text field
**Current:** Voice note text not visible
**Status:** ❌ Missing
**Priority:** MEDIUM

---

### 4. GPS Location Not Displaying
**Location:** Case details and Auction details pages
**Issue:** GPS coordinates not properly saved/displayed
**Expected:** Show pinpoint/map with location
**Current:** Location not visible or incorrect
**Status:** ❌ Broken
**Priority:** MEDIUM

---

### 5. Admin Auction Management - Document Generation
**Location:** Admin → Auction Management
**Issue:** 
- Still expects 3 documents (bill_of_sale, liability_waiver, pickup_authorization)
- Shows "⚠ Missing: pickup_authorization" error
- Should only generate 2 documents initially (bill_of_sale, liability_waiver)
- pickup_authorization should only be generated AFTER payment verification

**Current Display:**
```
Status & Actions
⚠ Missing: pickup_authorization
• liability waiver (signed)
• bill of sale (signed)
✗ Notification not sent
Payment: VERIFIED
📄 Generate Documents
📧 Send Notification
```

**Expected:**
- Only show 2 documents before payment
- Generate pickup_authorization AFTER payment
- Remove "Notification not sent" indicator (or remove notification button entirely)

**Status:** ❌ Broken
**Priority:** HIGH

---

### 6. Approvals Page - TypeError
**Location:** Admin → Approvals → All tab
**Error:**
```
Runtime TypeError
Cannot read properties of null (reading 'toUpperCase')
Call Stack: ApprovalsPage line 3944
```
**Status:** ❌ Broken
**Priority:** HIGH

---

### 7. Bid History Details - Loading Error
**Location:** Bid history details page
**Issue:** Shows "Error Loading Auction - Failed to load auction details" for a few seconds before loading correctly
**Expected:** Load smoothly without error message
**Current:** Temporary error message appears
**Status:** ⚠️ UX Issue
**Priority:** MEDIUM

---

### 8. Dashboard Pickup Cards - Missing Features
**Location:** Vendor Dashboard → Payment Complete section
**Issues:**
- Shows "Auction #ebe0b7e6" instead of actual item name (e.g., "2001 Toyota Corolla")
- No way to cancel/dismiss pickup cards
- Cards stay forever even after pickup

**Current Display:**
```
Payment Complete - Ready for Pickup
Auction #ebe0b7e6
✓ Payment verified • Ready for pickup
```

**Expected:**
```
Payment Complete - Ready for Pickup
2001 Toyota Corolla
✓ Payment verified • Ready for pickup
[Dismiss] or [Mark as Picked Up] button
```

**Status:** ❌ Missing Features
**Priority:** MEDIUM

---

### 9. Notifications - Mark All as Read Not Working
**Location:** Notifications panel
**Issue:** "Mark all as read" button doesn't work
**Status:** ❌ Broken
**Priority:** MEDIUM

---

## Summary

**Total Issues:** 9
**High Priority:** 3
**Medium Priority:** 6

**Categories:**
- API Errors: 2
- Display Issues: 4
- Missing Features: 2
- UX Issues: 1

---

## Fix Order (Recommended)

1. ✅ Transaction History API (500 error) - CRITICAL
2. ✅ Admin Document Generation (wrong document count) - CRITICAL
3. ✅ Approvals Page TypeError - CRITICAL
4. ✅ Notifications Mark All as Read
5. ✅ Dashboard Pickup Cards (show item name + dismiss)
6. ✅ Voice Note Display (bidding history + case details)
7. ✅ GPS Location Display
8. ✅ Bid History Loading Error

---

## Notes for Subagent

- Focus on fixing errors first (500s, TypeErrors)
- Then improve UX (loading states, display issues)
- Finally add missing features (dismiss buttons, etc.)
- Test each fix before moving to the next
- Document what was changed in each file
