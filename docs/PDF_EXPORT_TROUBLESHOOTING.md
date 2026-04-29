# PDF Export Troubleshooting Guide

## Problem: PDF Still Shows UI Elements (Cookie Banner, Filters, Profile Icon)

You're experiencing this issue because the PDF export is capturing the regular dashboard page instead of the clean PDF-optimized view.

## Root Cause

Next.js uses file-system based routing. When you create a new route (like `/pdf`), Next.js needs to:
1. Detect the new files
2. Rebuild the route table
3. Register the new route handlers

**If the dev server was already running when the files were created, it won't pick up the new route automatically.**

## Solution: Restart Your Dev Server

### Step 1: Stop the Current Server

Press `Ctrl+C` in your terminal where the dev server is running.

### Step 2: Clear Next.js Cache (Optional but Recommended)

```powershell
# Delete the .next directory to clear all cached builds
Remove-Item -Recurse -Force .next
```

### Step 3: Restart the Dev Server

```powershell
npm run dev
```

### Step 4: Verify the PDF Route Works

#### Option A: Test in Browser

Open your browser and navigate to:
```
http://localhost:3000/reports/executive/kpi-dashboard/pdf
```

**What you should see:**
- ✅ NEM Insurance letterhead with logo
- ✅ Report title and date
- ✅ Clean report data (KPIs, tables, charts)
- ✅ Company footer with addresses and contact info
- ❌ NO navigation sidebar
- ❌ NO date filters
- ❌ NO profile icon
- ❌ NO cookie banner

#### Option B: Run Test Script

```powershell
npx tsx scripts/test-pdf-route.ts
```

This script will:
- Check if the route is accessible
- Verify no UI elements are present
- Confirm PDF components are loaded
- Show you exactly what's wrong if there's an issue

### Step 5: Test PDF Export

Once the `/pdf` route is working in your browser:

1. Go to the regular KPI Dashboard: `http://localhost:3000/reports/executive/kpi-dashboard`
2. Click the "Export PDF" button
3. The downloaded PDF should now be clean with:
   - Professional letterhead
   - Full report content
   - Company footer
   - NO UI chrome

## Common Issues and Fixes

### Issue 1: "404 Not Found" on /pdf Route

**Cause:** Next.js hasn't registered the new route yet.

**Fix:**
1. Verify files exist:
   ```powershell
   Test-Path "src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/page.tsx"
   Test-Path "src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx"
   ```
   Both should return `True`

2. Restart dev server (see steps above)

### Issue 2: PDF Shows Unstyled Content

**Cause:** Tailwind CSS not loading in the PDF layout.

**Fix:** The layout file should import globals.css:
```typescript
import '../../../../../app/globals.css';
```

Verify this line exists in `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx`

### Issue 3: PDF Still Shows Dashboard UI

**Cause:** The layout override isn't working, or the wrong URL is being used.

**Fix:**
1. Check the API route logs to see what URL Puppeteer is navigating to:
   ```
   Look for: "Generating PDF for URL: ..."
   Should be: http://localhost:3000/reports/executive/kpi-dashboard/pdf
   ```

2. Verify the layout override exists and is correct:
   ```powershell
   Get-Content "src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx"
   ```

### Issue 4: Charts Not Rendering in PDF

**Cause:** Puppeteer capturing before charts finish rendering.

**Fix:** The PDF page should have `data-report-ready="true"` attribute on the main container. This signals Puppeteer to wait for the report to be fully loaded.

Verify this exists in `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/page.tsx`:
```typescript
<div data-report-ready="true" className="space-y-6">
```

### Issue 5: Authentication Errors

**Cause:** Session cookie not being passed to Puppeteer.

**Fix:** The API route should be passing the session token. Check the logs for:
```
Session token not found
```

If you see this, make sure you're logged in when testing.

## Verification Checklist

Before testing PDF export, verify:

- [ ] Dev server has been restarted after creating /pdf files
- [ ] `/pdf` route is accessible in browser (no 404)
- [ ] `/pdf` route shows clean content (no navigation/filters)
- [ ] Letterhead and footer are visible
- [ ] Report data loads correctly
- [ ] No TypeScript errors in the console

## File Structure

Your PDF export should have this structure:

```
src/app/(dashboard)/reports/executive/kpi-dashboard/
├── page.tsx                    # Regular dashboard page (with UI)
├── pdf/
│   ├── layout.tsx             # Layout override (bypasses dashboard layout)
│   └── page.tsx               # PDF-optimized page (no UI chrome)
```

The `pdf/layout.tsx` file is **critical** - it prevents the dashboard layout from wrapping the PDF page.

## Still Not Working?

If you've followed all steps and it's still not working:

1. **Check the browser console** when visiting the `/pdf` route directly
2. **Check the server logs** when generating a PDF
3. **Run the test script** to see detailed diagnostics:
   ```powershell
   npx tsx scripts/test-pdf-route.ts
   ```

4. **Verify the API is using the correct URL:**
   - Open `src/app/api/reports/export/pdf/route.ts`
   - Add a console.log to see what URL is being generated:
     ```typescript
     console.log('Full PDF URL:', fullReportUrl);
     ```
   - Check the server logs when you click "Export PDF"

## Next Steps

Once the PDF export is working for the KPI Dashboard, you can create PDF views for other reports by:

1. Creating a `/pdf` subdirectory in the report folder
2. Copying the `layout.tsx` and `page.tsx` files
3. Adapting the `page.tsx` to fetch and display that report's data

The pattern is the same for all reports!
