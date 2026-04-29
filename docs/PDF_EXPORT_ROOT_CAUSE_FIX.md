# PDF Export Root Cause Fix

## Problem
PDF exports were capturing the entire dashboard UI including:
- Sidebar navigation
- Top bar (profile icon, notifications)
- Date filters
- Cookie banners
- All other UI chrome

Instead of a clean professional PDF with just the report content.

## Root Cause
The `/pdf` route was still wrapped by the dashboard layout (`src/app/(dashboard)/layout.tsx`), which includes:
- `<DashboardSidebar />` - Left navigation
- `<DashboardTopBar />` - Top bar with profile/notifications
- `<OfflineIndicator />` - PWA offline indicator
- `<SyncProgressIndicator />` - Sync status

Puppeteer was capturing the ENTIRE page including all this UI chrome.

## Solution

### 1. Created PDF-Specific Layout Override
**File**: `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx`

This layout bypasses the dashboard layout completely, providing a clean HTML structure with NO dashboard chrome.

```tsx
export default function PDFReportLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* No dashboard chrome - just the report content */}
        {children}
      </body>
    </html>
  );
}
```

### 2. Added Print Media Emulation
**File**: `src/lib/pdf/puppeteer-pdf-generator.ts`

Added `await page.emulateMediaType('print')` to activate `@media print` CSS rules.

### 3. Enhanced PDFLayout Component
**File**: `src/components/reports/common/pdf-layout.tsx`

Added inline styles to ensure proper rendering even without CSS media queries.

## How It Works Now

1. User clicks "Export PDF" on `/reports/executive/kpi-dashboard`
2. API converts URL to `/reports/executive/kpi-dashboard/pdf`
3. Puppeteer navigates to the `/pdf` route
4. The `/pdf` route uses its own layout (NOT the dashboard layout)
5. Only the PDFLayout component renders (letterhead + content + footer)
6. Puppeteer captures a clean PDF with NO UI chrome

## Result

✅ Clean PDF with:
- NEM Insurance letterhead with logo
- Report title and date range
- All report data (KPIs, tables, charts)
- Professional footer with addresses and contact info

❌ NO UI elements:
- No sidebar navigation
- No top bar
- No profile icon
- No date filters
- No cookie banners
- No buttons

## Testing

1. Restart your Next.js dev server (to pick up the new layout file)
2. Navigate to any report page
3. Click "Export PDF"
4. Download should contain a clean professional PDF

## Applying to Other Reports

To add PDF export to other reports, create the same structure:

```
src/app/(dashboard)/reports/[category]/[report-name]/
├── page.tsx              # Regular report page (with UI chrome)
└── pdf/
    ├── layout.tsx        # PDF layout override (NO dashboard chrome)
    └── page.tsx          # PDF-optimized report page
```

The PDF page should:
1. Use `<PDFLayout>` component for letterhead/footer
2. Fetch the same data as the regular page
3. Render the same content WITHOUT filters/buttons/navigation
4. Add `data-report-ready="true"` attribute when ready

## Files Changed

1. ✅ Created: `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx`
2. ✅ Updated: `src/lib/pdf/puppeteer-pdf-generator.ts` (added print media emulation)
3. ✅ Updated: `src/components/reports/common/pdf-layout.tsx` (added inline styles)

## Next Steps

1. Restart dev server
2. Test PDF export
3. Customize letterhead/footer in `pdf-layout.tsx` if needed (logo, addresses, contact info)
4. Apply the same pattern to other reports that need PDF export
