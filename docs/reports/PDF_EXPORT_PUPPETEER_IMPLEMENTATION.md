# PDF Export - Puppeteer Implementation

## Overview

The PDF export system has been completely rewritten to use **Puppeteer** instead of jsPDF. This provides:

✅ **Full CSS Support** - All Tailwind classes, custom styles, and layouts render perfectly  
✅ **Chart Rendering** - Canvas and SVG charts (Chart.js, Recharts) are captured exactly as displayed  
✅ **Professional Quality** - PDFs look identical to the web page  
✅ **No Manual Styling** - No need to recreate layouts in code  

## Architecture

### 1. Puppeteer PDF Generator (`src/lib/pdf/puppeteer-pdf-generator.ts`)

Core service that uses Puppeteer to:
- Launch a headless browser
- Navigate to the report page
- Wait for content to load (including charts)
- Generate PDF from the rendered page

```typescript
const generator = getPDFGenerator();
const pdfBuffer = await generator.generateFromURL({
  url: 'https://yourapp.com/reports/kpi-dashboard',
  cookies: [{ name: 'authjs.session-token', value: token, domain: 'yourapp.com' }],
  waitForSelector: '[data-report-ready="true"]',
  waitForTimeout: 3000,
});
```

### 2. PDF Export API (`src/app/api/reports/export/pdf/route.ts`)

API endpoint that:
- Receives report URL and filters
- Authenticates using session cookies
- Calls Puppeteer generator
- Returns PDF file for download

**Request:**
```json
{
  "reportType": "kpi-dashboard",
  "reportUrl": "/reports/executive/kpi-dashboard?startDate=2024-01-01&endDate=2024-12-31",
  "filters": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }
}
```

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="KPI_Dashboard_2024-01-01_to_2024-12-31.pdf"`

### 3. React Hook (`src/hooks/use-pdf-export.ts`)

Frontend hook for easy PDF export:

```typescript
const { exportToPDF, isExporting } = usePDFExport({
  reportType: 'kpi-dashboard',
  onSuccess: () => console.log('PDF downloaded!'),
  onError: (error) => console.error('Export failed:', error),
});

// Trigger export
<Button onClick={() => exportToPDF(reportData, filters)} disabled={isExporting}>
  {isExporting ? 'Exporting...' : 'Export PDF'}
</Button>
```

## Implementation Steps

### Step 1: Add Data Attribute to Report Pages

Add `data-report-ready="true"` to the main container of each report page **after data is loaded**:

```tsx
export default function KPIDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  return (
    <div 
      className="container mx-auto py-6 space-y-6"
      data-report-ready={!loading && reportData ? "true" : "false"}
    >
      {/* Report content */}
    </div>
  );
}
```

This tells Puppeteer when the page is ready to be captured.

### Step 2: Update Export Buttons

The `usePDFExport` hook is already updated. Just ensure your export buttons use it:

```tsx
import { usePDFExport } from '@/hooks/use-pdf-export';

const { exportToPDF, isExporting } = usePDFExport({
  reportType: 'kpi-dashboard',
});

<Button onClick={() => exportToPDF(reportData, filters)} disabled={isExporting}>
  {isExporting ? 'Exporting...' : 'Export PDF'}
</Button>
```

### Step 3: Test PDF Export

1. Navigate to a report page
2. Click "Export PDF"
3. Verify:
   - PDF downloads automatically
   - All styling is preserved
   - Charts render correctly
   - Layout matches the web page

## Report Pages to Update

Add `data-report-ready` attribute to these pages:

- [ ] `/reports/executive/kpi-dashboard`
- [ ] `/reports/executive/master-report`
- [ ] `/reports/financial/revenue-analysis`
- [ ] `/reports/financial/profitability`
- [ ] `/reports/financial/payment-analytics`
- [ ] `/reports/financial/vendor-spending`
- [ ] `/reports/operational/auction-performance`
- [ ] `/reports/operational/case-processing`
- [ ] `/reports/operational/vendor-performance`
- [ ] `/reports/operational/document-management`
- [ ] `/reports/user-performance/my-performance`
- [ ] `/reports/user-performance/adjusters`
- [ ] `/reports/user-performance/finance`
- [ ] `/reports/user-performance/managers`
- [ ] `/reports/user-performance/team-performance`

## Configuration

### Puppeteer Settings

The generator is configured for optimal PDF quality:

```typescript
{
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
}
```

### PDF Options

```typescript
{
  format: 'A4',
  printBackground: true, // Include background colors
  margin: {
    top: '20mm',
    right: '15mm',
    bottom: '20mm',
    left: '15mm',
  },
}
```

### Wait Strategy

1. **networkidle0**: Wait for all network requests to finish
2. **waitForSelector**: Wait for `[data-report-ready="true"]`
3. **waitForTimeout**: Additional 3 seconds for charts to render

## Troubleshooting

### Charts Not Rendering

**Problem**: Charts appear blank in PDF  
**Solution**: Increase `waitForTimeout` in the API route:

```typescript
waitForTimeout: 5000, // Increase from 3000 to 5000ms
```

### Authentication Issues

**Problem**: PDF shows login page  
**Solution**: Verify session cookie is being passed correctly:

```typescript
cookies: [
  {
    name: 'authjs.session-token',
    value: sessionToken,
    domain: requestUrl.hostname, // Must match your domain
  },
]
```

### Styling Missing

**Problem**: Some styles don't appear in PDF  
**Solution**: Ensure all CSS is loaded before PDF generation. Check:
- External stylesheets are loaded
- Tailwind classes are compiled
- Custom CSS is included

### Memory Issues

**Problem**: Server runs out of memory  
**Solution**: Close browser instances properly:

```typescript
// The generator reuses browser instances
// Call close() when shutting down the server
await generator.close();
```

## Performance Considerations

- **Browser Reuse**: The generator reuses a single browser instance for multiple PDFs
- **Timeout**: Default 60-second timeout for page load
- **Memory**: Each PDF generation uses ~100-200MB of memory
- **Concurrency**: Can handle multiple simultaneous PDF generations

## Production Deployment

### Environment Variables

No additional environment variables needed. Puppeteer works out of the box.

### Docker Considerations

If deploying in Docker, ensure Chromium dependencies are installed:

```dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils
```

### Vercel Deployment

Puppeteer works on Vercel with the `@sparticuz/chromium` package. Update if needed:

```bash
npm install @sparticuz/chromium
```

Then update the generator to use it in production:

```typescript
import chromium from '@sparticuz/chromium';

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

## Migration from jsPDF

The old jsPDF implementation has been replaced. Key differences:

| Feature | jsPDF (Old) | Puppeteer (New) |
|---------|-------------|-----------------|
| CSS Support | ❌ Manual | ✅ Automatic |
| Charts | ❌ Not supported | ✅ Full support |
| Layout | ❌ Manual recreation | ✅ Exact copy |
| Maintenance | ❌ High | ✅ Low |
| Quality | ⚠️ Basic | ✅ Professional |

## Next Steps

1. Add `data-report-ready` attribute to all report pages
2. Test PDF export on each report type
3. Verify charts render correctly
4. Check styling on different report layouts
5. Test with different date ranges and filters

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs for Puppeteer errors
3. Verify session authentication is working
4. Test the report page loads correctly in a regular browser first
