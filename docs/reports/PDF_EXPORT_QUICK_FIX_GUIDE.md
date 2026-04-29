# PDF Export - Quick Fix Guide

## Problem

PDFs were downloading but had:
- ❌ No styling (everything in columns)
- ❌ No charts
- ❌ Broken layout

## Root Cause

The old implementation used **jsPDF** which:
- Cannot render HTML/CSS
- Cannot capture charts
- Requires manual recreation of all styling

## Solution

Switched to **Puppeteer** which:
- ✅ Renders actual HTML pages
- ✅ Captures all CSS styling
- ✅ Includes charts perfectly
- ✅ Professional quality PDFs

## What Changed

### 1. New PDF Generator (`src/lib/pdf/puppeteer-pdf-generator.ts`)
- Uses headless Chrome to render pages
- Captures the page exactly as it appears in browser

### 2. Updated API Route (`src/app/api/reports/export/pdf/route.ts`)
- Now receives `reportUrl` instead of `data`
- Navigates to the actual report page
- Generates PDF from rendered page

### 3. Updated Hook (`src/hooks/use-pdf-export.ts`)
- Sends current page URL to API
- No longer needs to send report data

## Quick Implementation

### For Each Report Page

Add this attribute to the main container **after data loads**:

```tsx
<div 
  className="container mx-auto py-6"
  data-report-ready={!loading && reportData ? "true" : "false"}
>
  {/* Your report content */}
</div>
```

### Example: KPI Dashboard

**Before:**
```tsx
export default function KPIDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  return (
    <div className="container mx-auto py-6">
      {/* content */}
    </div>
  );
}
```

**After:**
```tsx
export default function KPIDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  return (
    <div 
      className="container mx-auto py-6"
      data-report-ready={!loading && reportData ? "true" : "false"}
    >
      {/* content */}
    </div>
  );
}
```

## Testing

1. Navigate to a report page
2. Wait for data to load
3. Click "Export PDF"
4. Verify:
   - ✅ PDF downloads
   - ✅ All styling is preserved
   - ✅ Charts render correctly
   - ✅ Layout matches web page

## Report Pages Checklist

Update these pages (add `data-report-ready` attribute):

### Executive Reports
- [ ] `/reports/executive/kpi-dashboard`
- [ ] `/reports/executive/master-report`

### Financial Reports
- [ ] `/reports/financial/revenue-analysis`
- [ ] `/reports/financial/profitability`
- [ ] `/reports/financial/payment-analytics`
- [ ] `/reports/financial/vendor-spending`

### Operational Reports
- [ ] `/reports/operational/auction-performance`
- [ ] `/reports/operational/case-processing`
- [ ] `/reports/operational/vendor-performance`
- [ ] `/reports/operational/document-management`

### User Performance Reports
- [ ] `/reports/user-performance/my-performance`
- [ ] `/reports/user-performance/adjusters`
- [ ] `/reports/user-performance/finance`
- [ ] `/reports/user-performance/managers`
- [ ] `/reports/user-performance/team-performance`

## Common Issues

### Issue: Charts not showing
**Fix**: Increase wait time in API route:
```typescript
waitForTimeout: 5000, // Increase from 3000
```

### Issue: Styling missing
**Fix**: Ensure `data-report-ready` is only set to "true" after ALL data loads

### Issue: PDF shows login page
**Fix**: Session authentication issue - check server logs

## Files Modified

1. ✅ `src/lib/pdf/puppeteer-pdf-generator.ts` - New generator
2. ✅ `src/app/api/reports/export/pdf/route.ts` - Updated API
3. ✅ `src/hooks/use-pdf-export.ts` - Updated hook
4. ⏳ Report pages - Need `data-report-ready` attribute

## Next Steps

1. Add `data-report-ready` to all report pages (see checklist above)
2. Test each report type
3. Verify charts render
4. Check different date ranges work

## Dependencies

Puppeteer is already installed:
```json
"puppeteer": "^24.42.0"
```

No additional packages needed!
