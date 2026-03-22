# Manager Dashboard UX Improvements Plan

## Overview
This document outlines UX improvements for the Salvage Manager role based on user feedback and system analysis.

---

## 1. Manager Approvals Page Enhancement

### Current State
- Only shows pending cases
- No visibility into approved/rejected cases
- No historical tracking

### Proposed Enhancement: Add Tabs for Case History

**New Tab Structure:**
```
📋 Pending (12)  |  ✅ Approved (45)  |  ❌ Rejected (8)  |  📊 All Cases (65)
```

**Features to Add:**
1. **Pending Tab** (Current functionality)
   - Shows cases awaiting approval
   - Quick approve/reject actions

2. **Approved Tab** (NEW)
   - Shows all approved cases with details
   - Display: Claim reference, asset type, approved date, auction status
   - Filter by date range
   - View full case details (read-only)

3. **Rejected Tab** (NEW)
   - Shows all rejected cases
   - Display rejection reason/comment
   - Option to re-review if needed

4. **All Cases Tab** (NEW)
   - Combined view with status filters
   - Search by claim reference
   - Export to Excel/PDF

**Implementation Priority:** HIGH
**Estimated Effort:** 2-3 days

---

## 2. Manager Vendors Page (Tier 2 KYC) - Fix API Error

### Current Issue
- "Failed to fetch applications" error
- Empty state shows even when there might be data

### Root Cause Analysis
The API endpoint `/api/vendors?status=pending&tier=tier2` may be:
1. Not handling the query parameters correctly
2. Missing proper error handling
3. Database query issue with tier filtering

### Fix Required
1. **API Route Fix** (`src/app/api/vendors/route.ts`)
   - Verify query parameter parsing
   - Add proper error logging
   - Handle empty results gracefully

2. **Better Error Messaging**
   - Show specific error (not generic "Failed to fetch")
   - Add retry button
   - Show loading skeleton

**Implementation Priority:** CRITICAL
**Estimated Effort:** 1 day

---

## 3. Salvage Manager Role Clarification

### Current Confusion
User asked: "What is the salvage manager's job?"

### Role Definition (from PRD)

**Salvage Manager Primary Responsibilities:**

1. **Case Approval/Rejection**
   - Review cases submitted by Claims Adjusters
   - Approve cases to create auctions
   - Reject cases with feedback to adjusters
   - Target: <12 hours approval time

2. **Vendor Management**
   - Approve/reject Tier 2 vendor applications
   - Review vendor documents (CAC, bank statements, NIN)
   - Suspend vendors for fraud/non-payment
   - Monitor vendor performance metrics

3. **Auction Oversight**
   - Monitor active auctions in real-time
   - Intervene in suspicious bidding patterns
   - Extend auction deadlines if needed
   - Review fraud alerts

4. **Recovery Optimization**
   - Maximize salvage recovery rates
   - Analyze vendor performance
   - Adjust reserve prices based on market trends
   - Generate recovery reports

### Recommendation
Add a "Help" or "Role Guide" section in the Manager dashboard explaining these responsibilities with quick links to each function.

**Implementation Priority:** MEDIUM
**Estimated Effort:** 1 day

---

## 4. Reports Page - Add Preview Functionality

### Current State
- User selects report type and date range
- Clicks "Generate Report"
- Can only download PDF or share
- No preview before download

### Proposed Enhancement: Report Preview

**New Flow:**
```
1. Select Report Type → 2. Set Date Range → 3. Generate Report
   ↓
4. Show Preview (NEW) → 5. Download PDF / Share
```

**Preview Features:**

1. **Recovery Summary Preview**
   ```
   ┌─────────────────────────────────────┐
   │ Recovery Summary Report             │
   │ Period: Jan 15 - Feb 14, 2026       │
   ├─────────────────────────────────────┤
   │ Total Cases: 45                     │
   │ Recovery Rate: 38.5%                │
   │ Market Value: ₦12,500,000           │
   │ Recovery Value: ₦4,812,500          │
   │                                     │
   │ Asset Type Breakdown:               │
   │ • Vehicles: 25 (55%)                │
   │ • Electronics: 15 (33%)             │
   │ • Property: 5 (12%)                 │
   │                                     │
   │ [View Full Report] [Download PDF]   │
   └─────────────────────────────────────┘
   ```

2. **Vendor Rankings Preview**
   ```
   ┌─────────────────────────────────────┐
   │ Vendor Rankings Report              │
   │ Period: Jan 15 - Feb 14, 2026       │
   ├─────────────────────────────────────┤
   │ Top 5 Vendors:                      │
   │                                     │
   │ 1. 🥇 ABC Motors                    │
   │    Wins: 12 | Spent: ₦2,500,000    │
   │                                     │
   │ 2. 🥈 Tech Salvage Ltd              │
   │    Wins: 8 | Spent: ₦1,800,000     │
   │                                     │
   │ 3. 🥉 Property Buyers Inc           │
   │    Wins: 6 | Spent: ₦1,200,000     │
   │                                     │
   │ [View Full Report] [Download PDF]   │
   └─────────────────────────────────────┘
   ```

3. **Payment Aging Preview**
   ```
   ┌─────────────────────────────────────┐
   │ Payment Aging Report                │
   │ Period: Jan 15 - Feb 14, 2026       │
   ├─────────────────────────────────────┤
   │ Total Payments: 38                  │
   │ Pending: 5 (13%)                    │
   │ Verified: 30 (79%)                  │
   │ Overdue: 3 (8%)                     │
   │                                     │
   │ Auto-Verification Rate: 92.5%       │
   │                                     │
   │ Aging Buckets:                      │
   │ • 0-24 hours: 25 payments           │
   │ • 24-48 hours: 8 payments           │
   │ • 48+ hours: 5 payments             │
   │                                     │
   │ [View Full Report] [Download PDF]   │
   └─────────────────────────────────────┘
   ```

**Implementation Details:**

1. **Expand Current Preview Section**
   - The page already has a basic preview
   - Enhance it with charts and visualizations
   - Add expandable sections for detailed data

2. **Add Interactive Charts**
   - Use Recharts (already in stack)
   - Pie charts for asset type breakdown
   - Bar charts for vendor rankings
   - Line charts for payment trends

3. **Full Report Modal**
   - Click "View Full Report" opens modal
   - Scrollable detailed view
   - Print-friendly layout
   - Download/Share buttons at bottom

**Implementation Priority:** HIGH
**Estimated Effort:** 3-4 days

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix Tier 2 KYC API error
- [ ] Add better error handling and logging
- [ ] Test with real vendor data

### Phase 2: Approvals Enhancement (Week 2)
- [ ] Add tabs to Manager Approvals page
- [ ] Implement Approved/Rejected case views
- [ ] Add filtering and search
- [ ] Test with historical data

### Phase 3: Reports Preview (Week 3)
- [ ] Enhance report preview section
- [ ] Add interactive charts
- [ ] Implement full report modal
- [ ] Test on mobile devices

### Phase 4: Documentation (Week 4)
- [ ] Add role guide for Salvage Manager
- [ ] Create help tooltips
- [ ] Update user documentation

---

## Success Metrics

1. **Manager Approvals**
   - 100% visibility into case history
   - <5 seconds to find approved case
   - Reduced support tickets about "where's my approved case?"

2. **Vendor Management**
   - 0 API errors on Tier 2 KYC page
   - <3 seconds page load time
   - Clear error messages when issues occur

3. **Reports**
   - 80%+ users preview before downloading
   - <10 seconds to generate preview
   - Reduced "wrong report downloaded" incidents

---

## Technical Notes

### Files to Modify

1. **Manager Approvals Enhancement**
   - `src/app/(dashboard)/manager/approvals/page.tsx`
   - `src/app/api/cases/route.ts` (add status filter)

2. **Vendor API Fix**
   - `src/app/api/vendors/route.ts`
   - Add proper error handling and logging

3. **Reports Preview**
   - `src/app/(dashboard)/manager/reports/page.tsx`
   - Enhance existing preview section
   - Add chart components

### API Endpoints to Add/Modify

1. `GET /api/cases?status=approved&managerId={id}` - Get approved cases
2. `GET /api/cases?status=rejected&managerId={id}` - Get rejected cases
3. `GET /api/vendors?status=pending&tier=tier2` - Fix existing endpoint

---

## Questions for User

1. **Approvals History**: How far back should we show approved/rejected cases? (30 days, 90 days, all time?)

2. **Reports Preview**: Should the preview be interactive (clickable charts) or static?

3. **Vendor Management**: Should we add bulk approval for Tier 2 vendors?

4. **Priority**: Which enhancement should we implement first?

---

## Next Steps

1. Get user confirmation on priorities
2. Create detailed technical specs for each enhancement
3. Estimate development time
4. Begin implementation in priority order

