# Manager Role Analysis and UX Fixes

## Completed Fixes

### 1. ✅ Tier 2 KYC API Error - FIXED
**Issue**: Manager Vendors page was calling `/api/vendors?status=pending&tier=tier2` but the API expects `tier=tier2_full`

**Fix Applied**: Updated the API call in `src/app/(dashboard)/manager/vendors/page.tsx` to use the correct tier value:
```typescript
const response = await fetch('/api/vendors?status=pending&tier=tier2_full');
```

### 2. ✅ Manager Approvals Tabs - FIXED
**Issue**: Manager Approvals page only showed pending cases. No way to see approved or rejected cases.

**Fix Applied**: Added tabs to the approvals page:
- **Pending** - Shows cases awaiting approval (default)
- **Approved** - Shows cases that have been approved
- **Rejected** - Shows cases that have been rejected
- **All** - Shows all cases regardless of status

The page now fetches different data based on the active tab and displays status badges on each case card.

### 3. ✅ Reports Preview - ALREADY EXISTS
**Status**: The reports page already has a preview feature that shows:
- Summary statistics after generating a report
- Key metrics displayed in cards
- Preview section before downloading PDF

No changes needed - the feature already works as requested.

---

## Salvage Manager Role Analysis

### Current Responsibilities (Based on User Stories & PRD)

According to the Product Requirements Document and User Stories, a Salvage Manager's job is to:

1. **Case Approval** (US-015)
   - Review salvage cases created by Claims Adjusters
   - Approve or reject cases with comments
   - Approved cases automatically create auctions

2. **Vendor Management** (US-007)
   - Review and approve/reject Tier 2 vendor KYC applications
   - Verify business documents (CAC, bank statements, NIN)
   - Manage vendor tiers and permissions

3. **Performance Monitoring** (US-031, US-033)
   - View real-time KPIs on dashboard
   - Monitor auction performance
   - Track recovery rates and vendor performance

4. **Reporting** (US-033)
   - Generate recovery summary reports
   - Generate vendor ranking reports
   - Generate payment aging reports
   - Share reports via WhatsApp, Email, SMS

### Missing Features

#### 1. ❌ Fraud Monitoring Access
**Issue**: The PRD mentions managers should "monitor auctions and fraud" but:
- Fraud Alerts page (`/admin/fraud`) is only accessible to admins
- Managers have no way to view fraud alerts
- Sidebar doesn't show fraud monitoring option for managers

**Recommendation**: Add fraud monitoring access for managers
- Add "Fraud Alerts" to manager navigation
- Update fraud alerts API to allow manager access
- Managers should be able to view fraud alerts but perhaps not suspend vendors (admin-only)

#### 2. ❓ Auction Management Clarification
**Current State**: 
- Managers don't directly "manage" auctions
- They approve cases → system creates auctions automatically
- They can view auction performance on dashboard
- No direct auction control panel

**This is correct behavior** - Managers oversee the process but don't manually control auctions. The system handles:
- Auction creation (automatic after case approval)
- Auction closure (automatic via cron job)
- Bid management (automatic via bidding service)

---

## Recommended Next Steps

### High Priority
1. **Add Fraud Monitoring for Managers**
   - Update sidebar navigation to include fraud alerts for managers
   - Update fraud alerts API to allow manager role access
   - Consider read-only access vs full control

### Medium Priority
2. **Add Auction Monitoring Dashboard**
   - Create a dedicated page for managers to monitor active auctions
   - Show real-time auction status, bids, and issues
   - Link from dashboard KPIs

### Low Priority
3. **Role Documentation**
   - Add in-app help/tooltips explaining manager responsibilities
   - Create onboarding guide for new managers

---

## Files Modified

1. `src/app/(dashboard)/manager/vendors/page.tsx`
   - Fixed API call to use `tier=tier2_full` instead of `tier=tier2`

2. `src/app/(dashboard)/manager/approvals/page.tsx`
   - Added tab state management
   - Added tab UI (Pending, Approved, Rejected, All)
   - Updated fetch function to filter by tab
   - Updated UI to show status badges

---

## Testing Checklist

- [ ] Test Tier 2 KYC page loads without "Failed to fetch" error
- [ ] Test Manager Approvals tabs switch correctly
- [ ] Test Pending tab shows only pending cases
- [ ] Test Approved tab shows only approved cases
- [ ] Test Rejected tab shows only rejected cases
- [ ] Test All tab shows all cases
- [ ] Test case cards show correct status badges
- [ ] Test reports preview displays correctly

---

## Questions for Product Owner

1. **Fraud Monitoring**: Should managers have access to fraud alerts? If yes, should they be able to:
   - View fraud alerts only?
   - Dismiss fraud alerts?
   - Suspend vendors?

2. **Auction Management**: Is the current automatic auction management sufficient, or do managers need manual controls?

3. **Vendor Rating**: Should managers be able to rate vendors after successful pickups, or is this automatic?
