# Manual Test Plan: Search Functionality Fixes (Task 4.2)

## Overview
This test plan verifies that search functionality works correctly across all entity types with case-insensitive partial matching and displays "No results found" messages when appropriate.

**Requirements Tested:** 7.1, 7.2, 7.3, 7.4, 7.5, 7.7

## Test Environment
- **Date:** 2025-01-XX
- **Tester:** [Your Name]
- **Build:** Latest
- **Database:** Development/Staging

---

## Test Cases

### 1. Auction Search (Already Implemented)

#### 1.1 Search by Make/Model
**Steps:**
1. Navigate to Vendor Auctions page (`/vendor/auctions`)
2. Enter "toyota" in the search bar
3. Verify results show Toyota vehicles

**Expected Result:**
- ✅ Search is case-insensitive (finds "Toyota", "TOYOTA", "toyota")
- ✅ Searches in assetDetails JSON fields (make, model, description)
- ✅ Results display matching auctions

**Status:** [ ] Pass [ ] Fail

---

#### 1.2 Search with No Results
**Steps:**
1. Navigate to Vendor Auctions page
2. Enter "nonexistentbrand123" in the search bar

**Expected Result:**
- ✅ Displays: "No results found for 'nonexistentbrand123'"
- ✅ Shows suggestion to adjust filters

**Status:** [ ] Pass [ ] Fail

---

### 2. Case Search (Newly Implemented)

#### 2.1 Search by Claim Reference
**Steps:**
1. Navigate to Adjuster My Cases page (`/adjuster/my-cases`)
2. Enter a partial claim reference (e.g., "CLM-2024")
3. Verify results show matching cases

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Partial matching works (finds "CLM-2024-001", "CLM-2024-002", etc.)
- ✅ Results display matching cases

**Status:** [ ] Pass [ ] Fail

---

#### 2.2 Search by Asset Type
**Steps:**
1. Navigate to Adjuster My Cases page
2. Enter "vehicle" in the search bar
3. Verify results show vehicle cases

**Expected Result:**
- ✅ Searches in assetType field
- ✅ Case-insensitive matching
- ✅ Results display vehicle cases

**Status:** [ ] Pass [ ] Fail

---

#### 2.3 Search by Asset Details
**Steps:**
1. Navigate to Adjuster My Cases page
2. Enter a vehicle make (e.g., "honda") in the search bar
3. Verify results show cases with Honda vehicles

**Expected Result:**
- ✅ Searches in assetDetails JSON fields (make, model, description, brand)
- ✅ Case-insensitive matching
- ✅ Results display matching cases

**Status:** [ ] Pass [ ] Fail

---

#### 2.4 Case Search with No Results
**Steps:**
1. Navigate to Adjuster My Cases page
2. Enter "nonexistentcase999" in the search bar

**Expected Result:**
- ✅ Displays: "No results found for 'nonexistentcase999'"
- ✅ Shows suggestion to adjust search query or filters

**Status:** [ ] Pass [ ] Fail

---

### 3. Vendor Search (Newly Implemented)

#### 3.1 Search by Company Name
**Steps:**
1. Navigate to Manager Vendors page (`/manager/vendors`)
2. Enter a partial company name in the search bar
3. Verify results show matching vendors

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Partial matching works
- ✅ Searches in businessName field
- ✅ Results display matching vendors

**Status:** [ ] Pass [ ] Fail

---

#### 3.2 Search by Email
**Steps:**
1. Navigate to Manager Vendors page
2. Enter a partial email address in the search bar
3. Verify results show matching vendors

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Searches in email field
- ✅ Results display matching vendors

**Status:** [ ] Pass [ ] Fail

---

#### 3.3 Search by Phone Number
**Steps:**
1. Navigate to Manager Vendors page
2. Enter a partial phone number in the search bar
3. Verify results show matching vendors

**Expected Result:**
- ✅ Searches in phone field
- ✅ Results display matching vendors

**Status:** [ ] Pass [ ] Fail

---

#### 3.4 Vendor Search with No Results
**Steps:**
1. Navigate to Manager Vendors page
2. Enter "nonexistentvendor123" in the search bar

**Expected Result:**
- ✅ Displays: "No results found for 'nonexistentvendor123'"
- ✅ Shows suggestion to adjust filters

**Status:** [ ] Pass [ ] Fail

---

### 4. User Search (Already Implemented)

#### 4.1 Search by Name
**Steps:**
1. Navigate to Admin Users page (`/admin/users`)
2. Enter a partial name in the search bar
3. Verify results show matching users

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Partial matching works
- ✅ Searches in fullName field
- ✅ Results display matching users

**Status:** [ ] Pass [ ] Fail

---

#### 4.2 Search by Email
**Steps:**
1. Navigate to Admin Users page
2. Enter a partial email in the search bar
3. Verify results show matching users

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Searches in email field
- ✅ Results display matching users

**Status:** [ ] Pass [ ] Fail

---

#### 4.3 Search by Role
**Steps:**
1. Navigate to Admin Users page
2. Enter "adjuster" in the search bar
3. Verify results show users with adjuster role

**Expected Result:**
- ✅ Search is case-insensitive
- ✅ Searches in role field
- ✅ Results display matching users

**Status:** [ ] Pass [ ] Fail

---

#### 4.4 User Search with No Results
**Steps:**
1. Navigate to Admin Users page
2. Enter "nonexistentuser999" in the search bar

**Expected Result:**
- ✅ Displays: "No results found for 'nonexistentuser999'"
- ✅ Shows suggestion to adjust filters

**Status:** [ ] Pass [ ] Fail

---

## Performance Testing

### 5.1 Search Response Time
**Steps:**
1. Perform searches on each entity type
2. Measure response time

**Expected Result:**
- ✅ Search results return within 500ms for datasets up to 10,000 records (Requirement 7.6)

**Status:** [ ] Pass [ ] Fail

**Notes:**
- Auction search: ___ms
- Case search: ___ms
- Vendor search: ___ms
- User search: ___ms

---

## Edge Cases

### 6.1 Special Characters in Search
**Steps:**
1. Search with special characters (e.g., "O'Brien", "Smith & Co")
2. Verify results are correct

**Expected Result:**
- ✅ Special characters are handled correctly
- ✅ No SQL errors

**Status:** [ ] Pass [ ] Fail

---

### 6.2 Empty Search Query
**Steps:**
1. Clear search bar (empty string)
2. Verify all results are shown

**Expected Result:**
- ✅ Shows all records (no filtering applied)
- ✅ No "No results found" message

**Status:** [ ] Pass [ ] Fail

---

### 6.3 Very Long Search Query
**Steps:**
1. Enter a very long search query (>100 characters)
2. Verify system handles it gracefully

**Expected Result:**
- ✅ Search executes without errors
- ✅ Returns appropriate results or "No results found"

**Status:** [ ] Pass [ ] Fail

---

## Summary

**Total Test Cases:** 19
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Overall Status:** [ ] Pass [ ] Fail

---

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1 | | | |
| 2 | | | |

---

## Notes

- All search functionality should use case-insensitive partial matching
- "No results found" messages should include the search query when present
- Search should work in combination with other filters
- Performance should meet the 500ms requirement

---

## Sign-off

**Tester:** _____________________ **Date:** _____________________

**Reviewer:** _____________________ **Date:** _____________________
