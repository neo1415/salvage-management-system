# Reporting System Consistency Issues - Master Tracking Document

**Date Created**: April 28, 2026  
**Status**: In Progress  
**Priority**: CRITICAL - Financial Accuracy

---

## Executive Summary

The reporting system has multiple inconsistencies across different dashboards and reports. This document tracks all identified issues and their fixes to ensure financial data accuracy across the entire application.

---

## Critical Issues Identified

### 1. Revenue Calculation Inconsistencies

**Issue**: Different revenue totals across reports
- Master Report: ₦6,077,000
- Finance Dashboard: ₦6,097,500  
- Ademola's Revenue: ₦5,777,000

**Root Cause**: 
- Master Report excludes registration fees (only auction payments)
- Finance Dashboard includes ALL payments (auction + registration fees)
- Adjuster revenue is correctly scoped to their cases only

**Fix Required**:
- ✅ Include registration fee payments in Master Report total revenue
- ✅ Ensure consistent definition: "Total Revenue = All Verified Payments (Auction + Registration)"

---

### 2. Display Bugs

#### 2.1 Revenue Growth Percentage Suffix
**Issue**: "₦6,077,0000.0%" - percentage appended to currency amount  
**Location**: Master Report - Executive Summary  
**Fix Required**: Remove "0.0%" suffix, display as "₦6,077,000" with growth as separate metric

#### 2.2 Operational Costs Definition
**Issue**: Unclear what constitutes operational costs  
**Current**: 15% of revenue (hardcoded assumption)  
**Fix Required**: Document that this is a placeholder calculation, not real operational costs

---

### 3. Asset Type Data Quality

#### 3.1 Electronics Recovery Rate (130.6%)
**Issue**: Impossible recovery rate > 100%  
**User Note**: "This might be correct from test data where item sold for ₦400k but market value was ₦90k"  
**Fix Required**: 
- ✅ Verify all electronics cases are properly categorized
- ✅ Validate market_value vs payment_amount logic
- ✅ Add data validation to prevent impossible rates

#### 3.2 Machinery Recovery Rate (0.2%)
**Issue**: Extremely low recovery  
**Fix Required**:
- ✅ Verify all machinery cases are properly categorized
- ✅ Check for data entry errors

---

### 4. Case Status Inconsistencies

#### 4.1 Active Auctions Count Mismatch
**Issue**: 
- Case Overview shows: 14 active auctions
- Auction Overview shows: 0 active auctions
- User confirms: NO active auctions currently

**Root Cause**: Cases stuck in "active_auction" status even after auction closed  
**Fix Required**:
- ✅ Filter by auction.status = 'active', NOT case.status = 'active_auction'
- ✅ Exclude scheduled auctions from "active" count

#### 4.2 Draft Cases in Reports
**Issue**: Draft cases (13) included in reports  
**User Request**: "Remove drafts from these reports"  
**Fix Required**: ✅ Exclude status='draft' from all report queries

#### 4.3 Approved Cases vs Closed Auctions Logic
**Issue**: 43 approved cases but 163 closed auctions  
**Question**: How can we close auctions for unapproved cases?  
**Fix Required**: 
- ✅ Investigate case approval workflow
- ✅ Verify auction can only be created for approved cases

---

### 5. Auction Count Discrepancy

**Issue**: 113 cases but 181 auctions  
**User Note**: "I know there were a few auctions I restarted, but that's like 3 or 4 at most"  
**Fix Required**:
- ✅ Investigate why 68 extra auctions exist
- ✅ Check for test data pollution
- ✅ Verify one-to-one case-to-auction relationship

---

### 6. Adjuster Count and Revenue Mismatch

**Issue**: 
- Report shows: 4 adjusters total
- Only Ademola Dan has real data (₦5,777,000)
- 3 "Test Adjuster" entries with ₦0
- Missing adjuster with ₦300,000 in revenue

**Fix Required**:
- ✅ Exclude test adjusters from count
- ✅ Find missing adjuster with ₦300k revenue
- ✅ Verify total revenue = sum of all adjuster revenues

---

### 7. Vendor Performance Inconsistencies

#### 7.1 Win Rate Discrepancies
**Master Report**: 
- The Vendor: 57.1% (20 wins / 35 participated)
- Master: 51.4% (19 wins / 37 participated)

**Vendor Dashboard**:
- The Vendor: 51.9% (28 wins / 54 bids)
- Master: 39.2% (20 wins / 51 bids)

**Fix Required**:
- ✅ Clarify definition: "Participated" vs "Bids"
- ✅ Ensure consistent calculation across all reports
- ✅ Verify bid counting logic

---

### 8. Pricing Analysis Bugs

#### 8.1 Average Starting Bid
**Issue**: ₦12,554,664.19 (using market_value instead of actual starting bid)  
**Fix Required**: ✅ Use auction.starting_bid or auction.minimum_bid, NOT case.market_value

#### 8.2 Average Price Increase
**Issue**: ₦-12,080,289.19 (negative because of wrong starting bid)  
**Fix Required**: ✅ Fix after correcting starting bid calculation

---

### 9. Document Completion Rate

**Issue**: 0.0% completion rate  
**Fix Required**:
- ✅ Verify query logic for signed documents
- ✅ Check if documents table has data
- ✅ Validate status field values

---

### 10. Test Data Pollution

**Issue**: Extensive test data from unit/e2e tests affecting reports  
**Impact**:
- Low auction success rate (17.7%) due to test auctions
- Inflated auction counts
- Test adjusters in performance reports

**Fix Required**:
- ✅ Add test data exclusion filters
- ✅ Consider adding `is_test` flag to records
- ✅ Document test data cleanup procedures

---

## Data Consistency Rules

### Revenue Definition
**Total Revenue = All Verified Payments**
- Includes: Auction payments (auction_id IS NOT NULL)
- Includes: Registration fee payments (auction_id IS NULL)
- Excludes: Pending, cancelled, failed payments

### Case Counting Rules
- ✅ Include: approved, active_auction, sold, pending_approval
- ❌ Exclude: draft, cancelled, rejected
- ❌ Exclude: Test data

### Auction Status Rules
- **Active**: auction.status = 'active' AND auction.end_time > NOW()
- **Scheduled**: auction.status = 'scheduled' AND auction.start_time > NOW()
- **Closed**: auction.status = 'closed'
- **Successful**: auction.status = 'closed' AND auction.current_bidder IS NOT NULL

### Adjuster Performance Rules
- Only count real adjusters (exclude test accounts)
- Revenue = SUM of verified payments from cases they created
- Cases processed = COUNT of cases they created (exclude drafts)

---

## Files Requiring Updates

### Core Services
1. `src/features/reports/executive/services/master-report.service.ts`
2. `src/features/reports/executive/services/kpi-dashboard.service.ts`
3. `src/features/reports/financial/repositories/financial-data.repository.ts`
4. `src/features/reports/operational/repositories/operational-data.repository.ts`
5. `src/features/reports/user-performance/services/index.ts`

### UI Components
1. `src/components/reports/executive/master-report-content.tsx`
2. `src/components/vendor/vendor-dashboard-content.tsx`

### Database Queries
- All SQL queries in report services need review for consistency

---

## Testing Requirements

### Data Validation Scripts Needed
1. ✅ Script to verify revenue totals across all reports
2. ✅ Script to validate case-to-auction relationships
3. ✅ Script to check for orphaned auctions
4. ✅ Script to identify test data
5. ✅ Script to verify adjuster revenue calculations
6. ✅ Script to validate vendor performance metrics

### Manual Verification Checklist
- [ ] Master Report total revenue matches Finance Dashboard
- [ ] Adjuster revenues sum to total revenue
- [ ] Vendor win rates consistent across dashboards
- [ ] No active auctions when user confirms none exist
- [ ] Draft cases excluded from all reports
- [ ] Registration fees included in revenue
- [ ] Asset type recovery rates are logical
- [ ] Document completion rate shows real data

---

## Implementation Priority

### Phase 1: Critical Fixes (Do First)
1. ✅ Include registration fees in total revenue
2. ✅ Fix "0.0%" display bug
3. ✅ Fix active auction count (use auction.status, not case.status)
4. ✅ Exclude draft cases from all reports
5. ✅ Fix starting bid calculation (don't use market_value)

### Phase 2: Data Quality
1. ✅ Verify electronics/machinery asset type categorization
2. ✅ Find missing ₦300k adjuster
3. ✅ Exclude test adjusters from reports
4. ✅ Fix document completion rate calculation

### Phase 3: Consistency
1. ✅ Standardize vendor win rate calculation
2. ✅ Align vendor dashboard with master report
3. ✅ Verify case-to-auction relationship
4. ✅ Document operational cost calculation

### Phase 4: Test Data Management
1. ✅ Add test data exclusion filters
2. ✅ Create test data cleanup script
3. ✅ Document test data best practices

---

## Notes for Future Sessions

- This document should be read at the start of any reporting work
- All fixes must update this document with completion status
- Any new inconsistencies discovered should be added here
- Keep this as the single source of truth for reporting issues

---

## Operational Cost Clarification

**Current Implementation**: 15% of revenue (hardcoded)  
**Reality**: This is a PLACEHOLDER calculation  
**Actual Operational Costs Should Include**:
- Staff salaries (adjusters, managers, finance, admin)
- Infrastructure costs (servers, database, APIs)
- Third-party services (Paystack fees, Dojah KYC, AI services)
- Office expenses
- Marketing and customer acquisition
- Legal and compliance

**For Now**: Document that 15% is an assumption, not real data

---

## Last Updated
- **Date**: April 28, 2026
- **By**: System Analysis
- **Next Review**: After Phase 1 fixes completed
