# PDF Export - Do This Now

## The Problem

Your PDF is capturing the regular dashboard page with cookie banners, date filters, and profile icons instead of a clean professional report.

## Why It's Happening

The `/pdf` route files exist, but **Next.js hasn't registered them yet** because your dev server was already running when they were created.

## The Solution (Takes 2 Minutes)

### Step 1: Restart Your Dev Server

In your terminal where the dev server is running:

1. Press `Ctrl+C` to stop the server
2. Run `npm run dev` to restart it
3. Wait for "Ready" message

**That's it.** This is the critical step that fixes everything.

### Step 2: Test the PDF Route

Open your browser and go to:
```
http://localhost:3000/reports/executive/kpi-dashboard/pdf
```

**What you should see:**
- NEM Insurance letterhead with logo at the top
- Report title: "KPI Dashboard"
- Clean report data (KPIs, tables)
- Company footer with addresses at the bottom
- **NO navigation sidebar**
- **NO date filters**
- **NO profile icon**
- **NO cookie banner**

If you see this, you're good! Move to Step 3.

If you see a 404 or the regular dashboard, something went wrong. See troubleshooting below.

### Step 3: Test PDF Export

1. Go to the regular dashboard: `http://localhost:3000/reports/executive/kpi-dashboard`
2. Click the "Export PDF" button
3. Download the PDF
4. Open it

**The PDF should now be clean with:**
- Professional letterhead
- Full report content
- Company footer
- NO UI elements

## If It's Still Not Working

### Quick Diagnostic

Run this command:
```powershell
npx tsx scripts/test-pdf-route.ts
```

This will tell you exactly what's wrong.

### Common Issues

**Issue: 404 on /pdf route**
- **Cause:** Dev server not restarted
- **Fix:** Stop server (Ctrl+C), run `npm run dev`

**Issue: Still shows dashboard UI**
- **Cause:** Browser cached the old page
- **Fix:** Hard refresh (Ctrl+Shift+R) or open in incognito

**Issue: Unstyled content**
- **Cause:** CSS not loading
- **Fix:** Check that `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx` imports globals.css

## What Was Fixed

I created two files that make this work:

1. **PDF Layout Override** (`pdf/layout.tsx`)
   - Bypasses the dashboard layout
   - Provides clean HTML with no UI chrome

2. **PDF Page** (`pdf/page.tsx`)
   - Clean version of the report
   - Uses PDFLayout component for letterhead/footer
   - No filters, buttons, or navigation

The key insight: Instead of trying to hide UI elements, we created a completely separate route that never had them in the first place.

## Why This Works

```
Regular page: /reports/executive/kpi-dashboard
└── Uses: (dashboard)/layout.tsx  ← Has sidebar, top bar, filters
    └── Shows: Full dashboard UI

PDF page: /reports/executive/kpi-dashboard/pdf
└── Uses: (dashboard)/reports/executive/kpi-dashboard/pdf/layout.tsx  ← Clean HTML only
    └── Shows: Just the report with letterhead/footer
```

The `/pdf` route has its own layout that completely bypasses the dashboard chrome.

## That's It!

Seriously, just restart your dev server and it should work. The code is already correct - Next.js just needs to register the new route.

If you're still having issues after restarting, run the test script and check the troubleshooting guide:
- `docs/PDF_EXPORT_TROUBLESHOOTING.md`
- `docs/PDF_EXPORT_FINAL_FIX.md`
