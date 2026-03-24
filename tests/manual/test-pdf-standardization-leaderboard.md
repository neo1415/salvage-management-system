# Manual Test Plan: PDF Standardization and Leaderboard Filtering

**Test Date:** _____________  
**Tester:** _____________  
**Environment:** _____________  
**Build/Commit:** _____________

---

## Test Suite 1: PDF Standardization (Task 9.1)

### Test 1.1: Bill of Sale PDF Generation
**Objective:** Verify Bill of Sale uses standardized letterhead and footer

**Steps:**
1. Navigate to a completed auction with payment
2. Generate Bill of Sale PDF
3. Open the generated PDF

**Expected Results:**
- [ ] Burgundy header bar at top with NEM Insurance logo
- [ ] "NEM INSURANCE PLC" centered in white text
- [ ] Gold accent line below company name
- [ ] "BILL OF SALE" title in header
- [ ] Company address in header: "199 Ikorodu Road, Obanikoro, Lagos, Nigeria | Tel: 234-02-014489560"
- [ ] All document content displays correctly
- [ ] QR code positioned above footer (not overlapping)
- [ ] Footer has thin burgundy line
- [ ] Footer contains company details and generation timestamp
- [ ] Footer text: "NEM Insurance Plc | 199 Ikorodu Road, Obanikoro, Lagos, Nigeria"
- [ ] Footer text: "Tel: 234-02-014489560 | Email: nemsupport@nem-insurance.com"
- [ ] Footer text: "Generated: [timestamp]"

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 1.2: Liability Waiver PDF Generation
**Objective:** Verify Liability Waiver uses standardized letterhead and footer

**Steps:**
1. Navigate to vendor documents page
2. Generate Liability Waiver PDF
3. Open the generated PDF

**Expected Results:**
- [ ] Burgundy header bar with NEM Insurance logo
- [ ] "RELEASE & WAIVER OF LIABILITY" title in header
- [ ] Company address in header
- [ ] All waiver clauses display correctly
- [ ] Signature section positioned properly
- [ ] QR code positioned above footer (not overlapping)
- [ ] Footer has thin burgundy line
- [ ] Footer contains company details and generation timestamp
- [ ] Consistent fonts and colors with Bill of Sale

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 1.3: Pickup Authorization PDF Generation
**Objective:** Verify Pickup Authorization uses standardized letterhead and footer

**Steps:**
1. Complete payment for an auction
2. Generate Pickup Authorization PDF
3. Open the generated PDF

**Expected Results:**
- [ ] Burgundy header bar with NEM Insurance logo
- [ ] "PICKUP AUTHORIZATION" title in header
- [ ] Company address in header
- [ ] Authorization code displayed prominently with gold background
- [ ] Vendor information displays correctly
- [ ] Payment confirmation details present
- [ ] Pickup details and deadline shown
- [ ] QR code centered above footer (not overlapping)
- [ ] Footer has thin burgundy line
- [ ] Footer contains company details and generation timestamp
- [ ] Consistent branding with other PDFs

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 1.4: Salvage Certificate PDF Generation
**Objective:** Verify Salvage Certificate uses standardized letterhead and footer

**Steps:**
1. Navigate to a vehicle auction
2. Generate Salvage Certificate PDF
3. Open the generated PDF

**Expected Results:**
- [ ] Burgundy header bar with NEM Insurance logo
- [ ] "SALVAGE CERTIFICATE" title in header
- [ ] Company address in header
- [ ] Vehicle information (VIN, make, model, year) displays correctly
- [ ] Damage assessment section present
- [ ] Total loss declaration (if applicable) highlighted
- [ ] Insurance and sale information shown
- [ ] QR code positioned above footer (not overlapping)
- [ ] Footer has thin burgundy line
- [ ] Footer contains company details and generation timestamp
- [ ] Consistent branding with other PDFs

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 1.5: PDF Consistency Across Documents
**Objective:** Verify all PDFs have identical letterhead and footer formatting

**Steps:**
1. Generate all four PDF types (Bill of Sale, Liability Waiver, Pickup Authorization, Salvage Certificate)
2. Compare letterhead and footer sections side-by-side

**Expected Results:**
- [ ] All PDFs have identical burgundy header bar height and color
- [ ] NEM Insurance logo appears in same position on all PDFs
- [ ] Company name font size and positioning identical
- [ ] Gold accent line appears consistently
- [ ] Footer line thickness and color identical
- [ ] Footer text formatting and positioning identical
- [ ] Generation timestamp format consistent
- [ ] QR codes positioned consistently above footer

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 1.6: PDF Content Spacing
**Objective:** Verify content doesn't overlap with footer

**Steps:**
1. Generate PDFs with varying content lengths
2. Test with minimal data (short descriptions)
3. Test with maximum data (long descriptions, all optional fields)

**Expected Results:**
- [ ] Short content: Proper spacing between content and footer
- [ ] Long content: Content doesn't overlap footer
- [ ] QR codes always positioned above footer
- [ ] Footer always at bottom of page
- [ ] Content wraps properly when needed
- [ ] No text cutoff or overlap issues

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

## Test Suite 2: Leaderboard Test User Filtering (Task 9.3)

### Test 2.1: Email Pattern Exclusion
**Objective:** Verify users with test/demo/uat emails are excluded

**Prerequisites:**
- Create test vendors with emails:
  - `test@example.com`
  - `demo.vendor@example.com`
  - `uat_user@example.com`
  - `testing123@example.com`
  - `demonstration@example.com`
- Ensure these vendors have performance stats (bids, wins)

**Steps:**
1. Navigate to vendor leaderboard page
2. Review top 10 vendors list
3. Check API response at `/api/vendors/leaderboard`

**Expected Results:**
- [ ] No vendors with "test" in email appear
- [ ] No vendors with "demo" in email appear
- [ ] No vendors with "uat" in email appear
- [ ] Case variations (TEST, Demo, UaT) also excluded
- [ ] Legitimate vendors with similar patterns included (e.g., "contest@example.com")

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.2: Name Pattern Exclusion
**Objective:** Verify users with test/demo/uat names are excluded

**Prerequisites:**
- Create test vendors with names:
  - `Test User`
  - `Demo Vendor`
  - `UAT Account`
  - `Test123`
  - `Demo Account 1`
- Ensure these vendors have performance stats

**Steps:**
1. Navigate to vendor leaderboard page
2. Review top 10 vendors list
3. Check API response at `/api/vendors/leaderboard`

**Expected Results:**
- [ ] No vendors with "test" in name appear
- [ ] No vendors with "demo" in name appear
- [ ] No vendors with "uat" in name appear
- [ ] Case variations (TEST, Demo, UaT) also excluded
- [ ] Legitimate vendors with similar patterns included (e.g., "Tester Johnson")

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.3: VendorId Pattern Exclusion
**Objective:** Verify vendors with test/demo/uat ID prefixes are excluded

**Prerequisites:**
- Create test vendors with IDs:
  - `test-vendor-123`
  - `demo-vendor-456`
  - `uat-vendor-789`
  - `test-account-001`
- Ensure these vendors have performance stats

**Steps:**
1. Navigate to vendor leaderboard page
2. Review top 10 vendors list
3. Check API response at `/api/vendors/leaderboard`

**Expected Results:**
- [ ] No vendors with "test-" prefix appear
- [ ] No vendors with "demo-" prefix appear
- [ ] No vendors with "uat-" prefix appear
- [ ] Case variations (TEST-, Demo-, UaT-) also excluded
- [ ] Legitimate vendors with IDs containing these strings (but not as prefix) included

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.4: Mixed Pattern Exclusion
**Objective:** Verify vendors matching multiple criteria are excluded

**Prerequisites:**
- Create vendor with:
  - Email: `test@example.com`
  - Name: `Demo User`
  - VendorId: `uat-vendor-999`
- Ensure vendor has high performance stats (should rank in top 10)

**Steps:**
1. Navigate to vendor leaderboard page
2. Review top 10 vendors list
3. Check API response at `/api/vendors/leaderboard`

**Expected Results:**
- [ ] Vendor does not appear despite high performance stats
- [ ] Leaderboard shows next eligible vendor instead
- [ ] Total count reflects exclusion

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.5: Legitimate User Inclusion
**Objective:** Verify legitimate users are not over-excluded

**Prerequisites:**
- Create vendors with similar but non-matching patterns:
  - Email: `contest@example.com` (contains "test")
  - Name: `Tester Johnson` (contains "test")
  - Email: `demonstrate@example.com` (contains "demo")
  - Name: `Guatemala Vendor` (contains "uat")
- Ensure these vendors have performance stats

**Steps:**
1. Navigate to vendor leaderboard page
2. Review top 10 vendors list
3. Check API response at `/api/vendors/leaderboard`

**Expected Results:**
- [ ] Vendors with "contest" email appear (not exact match)
- [ ] Vendors with "Tester" name appear (not standalone "test")
- [ ] Vendors with "demonstrate" email appear (not exact match)
- [ ] Vendors with "Guatemala" name appear (not standalone "uat")
- [ ] Filtering is precise, not overly broad

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.6: Cache TTL Verification
**Objective:** Verify leaderboard cache refreshes every 5 minutes

**Steps:**
1. Call `/api/vendors/leaderboard` and note `lastUpdated` timestamp
2. Wait 3 minutes
3. Call `/api/vendors/leaderboard` again
4. Wait 3 more minutes (6 minutes total)
5. Call `/api/vendors/leaderboard` again

**Expected Results:**
- [ ] First call: Fresh data with `lastUpdated` timestamp
- [ ] Second call (3 min): Same data returned (cached)
- [ ] Second call: `lastUpdated` timestamp unchanged
- [ ] Third call (6 min): New data with updated `lastUpdated` timestamp
- [ ] `nextUpdate` timestamp is approximately 5 minutes after `lastUpdated`
- [ ] Cache key: `leaderboard:monthly` in Redis

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.7: Leaderboard Data Accuracy
**Objective:** Verify leaderboard data is accurate after filtering

**Steps:**
1. Create 5 legitimate vendors with known performance stats
2. Create 5 test vendors with higher performance stats
3. Navigate to vendor leaderboard page
4. Verify ranking and data

**Expected Results:**
- [ ] Only legitimate vendors appear in leaderboard
- [ ] Vendors ranked correctly by performance (wins, bids, etc.)
- [ ] Total bids count is accurate
- [ ] Wins count is accurate
- [ ] Total spent is accurate
- [ ] On-time pickup rate is accurate
- [ ] Rating displays correctly
- [ ] Tier information is correct

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

### Test 2.8: Performance Under Load
**Objective:** Verify filtering doesn't significantly impact performance

**Steps:**
1. Create 100 vendors (50 legitimate, 50 test users)
2. Ensure all have performance stats
3. Measure API response time for `/api/vendors/leaderboard`
4. Check database query execution time

**Expected Results:**
- [ ] API response time < 500ms (first call, no cache)
- [ ] API response time < 50ms (cached calls)
- [ ] Database query uses indexes efficiently
- [ ] No N+1 query issues
- [ ] Memory usage remains stable
- [ ] Filtering doesn't cause performance degradation

**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _____________________________________________

---

## Summary

### PDF Standardization Results
- Tests Passed: _____ / 6
- Tests Failed: _____ / 6
- Critical Issues: _____
- Minor Issues: _____

### Leaderboard Filtering Results
- Tests Passed: _____ / 8
- Tests Failed: _____ / 8
- Critical Issues: _____
- Minor Issues: _____

### Overall Assessment
⬜ All tests passed - Ready for production  
⬜ Minor issues found - Can deploy with monitoring  
⬜ Major issues found - Requires fixes before deployment  
⬜ Critical issues found - Do not deploy

### Additional Notes
_____________________________________________
_____________________________________________
_____________________________________________

### Sign-off
**Tester Signature:** _____________  
**Date:** _____________  
**Approved for Production:** ⬜ Yes ⬜ No
