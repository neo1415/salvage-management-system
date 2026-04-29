# PDF Export Implementation Guide

## Overview

This system generates professional, print-ready PDFs from web reports using a **dedicated PDF view** approach. This is simpler and more reliable than trying to hide UI elements or manipulate the DOM.

## How It Works

### 1. **Two Views Per Report**

Each report has TWO pages:

- **Regular View** (`/reports/executive/kpi-dashboard/page.tsx`)
  - Full UI with navigation, filters, buttons, profile picture
  - Interactive elements
  - For viewing in the browser

- **PDF View** (`/reports/executive/kpi-dashboard/pdf/page.tsx`)
  - Clean, print-optimized layout
  - NO navigation, filters, or UI chrome
  - Professional letterhead and footer
  - For PDF export only

### 2. **PDF Layout Component**

The `PDFLayout` component (`src/components/reports/common/pdf-layout.tsx`) provides:

- ✅ NEM Insurance letterhead with logo
- ✅ Report title and date range
- ✅ Professional footer with addresses and contact info
- ✅ Proper page breaks and spacing
- ✅ Print-optimized CSS

### 3. **Export Flow**

```
User clicks "Export PDF" 
  ↓
ExportButton sends request to /api/reports/export/pdf
  ↓
API converts URL: /reports/executive/kpi-dashboard → /reports/executive/kpi-dashboard/pdf
  ↓
API adds filters as query params (startDate, endDate, etc.)
  ↓
Puppeteer opens the /pdf page with authentication
  ↓
Waits for [data-report-ready="true"] signal
  ↓
Captures full page as PDF
  ↓
Returns PDF file to user
```

## Implementation Checklist

### For Each Report Type

- [ ] Create `/pdf/page.tsx` in the report directory
- [ ] Wrap content in `<PDFLayout>` component
- [ ] Add `data-report-ready="true"` attribute when data is loaded
- [ ] Remove all interactive elements (buttons, filters, navigation)
- [ ] Use `pdf-no-break` class for elements that shouldn't split across pages
- [ ] Use `pdf-page-break` class to force page breaks before sections
- [ ] Test with different date ranges and filters

### Example Structure

```tsx
// src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/page.tsx
'use client';

import { PDFLayout } from '@/components/reports/common/pdf-layout';

export default function KPIDashboardPDFPage() {
  const [reportData, setReportData] = useState(null);
  
  // Fetch data using query params from URL
  useEffect(() => {
    fetchReport();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <PDFLayout 
      reportTitle="KPI Dashboard" 
      reportSubtitle="Performance Period: Jan 1 - Jan 31, 2026"
    >
      <div data-report-ready="true">
        {/* Report content here - NO buttons, filters, or navigation */}
      </div>
    </PDFLayout>
  );
}
```

## CSS Classes for PDF Control

### `pdf-no-break`
Prevents page breaks inside an element (keeps it together on one page)

```tsx
<div className="pdf-no-break">
  <h2>Financial KPIs</h2>
  <div className="grid grid-cols-4 gap-4">
    {/* KPI cards */}
  </div>
</div>
```

### `pdf-page-break`
Forces a page break before an element (starts a new page)

```tsx
<div className="pdf-page-break">
  <h2>Detailed Breakdown</h2>
  {/* This will start on a new page */}
</div>
```

## Customizing Letterhead/Footer

Edit `src/components/reports/common/pdf-layout.tsx`:

- **Logo**: Change the Image src to your logo path
- **Company Name**: Update "NEM Insurance"
- **Addresses**: Update the footer grid with your office locations
- **Contact Info**: Update phone, email, website
- **Legal Text**: Update RC number, licensing info

## Testing

### Local Testing

1. Start the dev server: `npm run dev`
2. Navigate to a report page
3. Click "Export PDF"
4. Check the generated PDF for:
   - ✅ Full page captured (not cut off)
   - ✅ No UI chrome (filters, buttons, navigation)
   - ✅ Letterhead appears on first page
   - ✅ Footer appears on last page
   - ✅ All data is visible and formatted correctly
   - ✅ Charts render properly
   - ✅ Tables don't break awkwardly across pages

### Direct PDF View Testing

You can also test the PDF view directly in your browser:

```
http://localhost:3000/reports/executive/kpi-dashboard/pdf?startDate=2026-01-01&endDate=2026-01-31
```

This shows exactly what will be captured in the PDF.

## Common Issues & Solutions

### Issue: PDF is cut off / doesn't show full page

**Solution**: The PDF view uses A4 dimensions (794x1123px at 96 DPI). Make sure your content fits within these dimensions or uses proper page breaks.

### Issue: Charts don't render

**Solution**: Increase the `waitForTimeout` in the PDF export API (currently 3000ms). Some charts need more time to render.

### Issue: Styling looks different in PDF

**Solution**: The PDF view uses the same Tailwind CSS as the regular view. Check that you're not using any browser-specific CSS that doesn't work in Puppeteer.

### Issue: Authentication fails

**Solution**: The PDF export API passes the session cookie to Puppeteer. Make sure the cookie domain matches your deployment domain.

## Performance Optimization

### 1. **Reuse Browser Instance**

The `PuppeteerPDFGenerator` class reuses the same browser instance across requests, which is much faster than launching a new browser each time.

### 2. **Parallel PDF Generation**

If you need to generate multiple PDFs, you can do it in parallel:

```typescript
const [pdf1, pdf2, pdf3] = await Promise.all([
  generator.generateFromURL({ url: url1, ... }),
  generator.generateFromURL({ url: url2, ... }),
  generator.generateFromURL({ url: url3, ... }),
]);
```

### 3. **Caching**

For reports that don't change frequently, consider caching the generated PDFs:

```typescript
const cacheKey = `pdf:${reportType}:${startDate}:${endDate}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const pdf = await generatePDF(...);
await redis.setex(cacheKey, 3600, pdf); // Cache for 1 hour
return pdf;
```

## Deployment Considerations

### Vercel / Serverless

Puppeteer requires Chrome/Chromium to be installed. On serverless platforms:

1. Use `@sparticuz/chromium` package (optimized for Lambda)
2. Or use a service like Browserless.io
3. Or deploy PDF generation to a separate server with Chrome installed

### Docker

Include Chrome in your Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver
```

### Environment Variables

Set these in production:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser  # Path to Chrome
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true  # Don't download Chrome during npm install
```

## Next Steps

1. ✅ Create PDF views for all report types
2. ✅ Test with real data
3. ✅ Customize letterhead/footer for your company
4. ✅ Deploy and test in production
5. ✅ Add caching if needed
6. ✅ Monitor PDF generation performance

## Support

For issues or questions, check:
- Puppeteer docs: https://pptr.dev/
- This implementation: `src/lib/pdf/puppeteer-pdf-generator.ts`
- Example PDF view: `src/app/(dashboard)/reports/executive/kpi-dashboard/pdf/page.tsx`
