# PDF Export - Simple Solution

## Problem
The Puppeteer-based PDF generation is complex and causing issues:
- Cookie banners appearing in PDF
- Content cutting off
- Slow generation time
- Complex server-side rendering

## Recommended Solution: Browser Print

Use the browser's native print functionality with print-optimized CSS. This is:
- **Simpler** - No server-side PDF generation
- **Faster** - Instant preview
- **More reliable** - Uses browser's PDF engine
- **Better UX** - User can preview before saving

## Implementation

### Option 1: Add Print Styles to Existing Page

Add this to your report page component:

```tsx
<style jsx global>{`
  @media print {
    /* Hide UI elements */
    nav, header, button, .sidebar, .filters {
      display: none !important;
    }
    
    /* Add letterhead */
    @page {
      margin: 20mm;
    }
    
    body::before {
      content: "NEM Insurance - Salvage Management Platform";
      display: block;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #800020;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #800020;
    }
    
    /* Ensure charts print */
    canvas {
      max-width: 100% !important;
      height: auto !important;
    }
    
    /* Page breaks */
    .chart-container, table {
      page-break-inside: avoid;
    }
    
    /* Print all content */
    .report-content {
      display: block !important;
      height: auto !important;
      overflow: visible !important;
    }
  }
`}</style>
```

### Option 2: Use jsPDF (Client-Side)

If you need programmatic PDF generation, use jsPDF which is already installed:

```typescript
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const handleExportPDF = () => {
  const doc = new jsPDF();
  
  // Add letterhead
  doc.setFontSize(20);
  doc.setTextColor(128, 0, 32); // #800020
  doc.text('NEM Insurance', 20, 20);
  doc.setFontSize(12);
  doc.text('Salvage Management Platform', 20, 28);
  
  // Add report title
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Revenue Analysis Report', 20, 45);
  
  // Add summary data
  doc.setFontSize(10);
  doc.text(`Total Revenue: ₦${data.totalRevenue.toLocaleString()}`, 20, 60);
  doc.text(`Salvage Recovered: ₦${data.salvageRecovered.toLocaleString()}`, 20, 68);
  
  // Add table
  doc.autoTable({
    startY: 80,
    head: [['Asset Type', 'Cases', 'Claims Paid', 'Salvage Recovered']],
    body: data.byAssetType.map(item => [
      item.assetType,
      item.count,
      `₦${item.claimsPaid.toLocaleString()}`,
      `₦${item.salvageRecovered.toLocaleString()}`
    ]),
  });
  
  // Save
  doc.save(`revenue-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
};
```

## Recommended Approach

**Use Browser Print (Option 1)** because:
1. It's already working in the export button ("Print to PDF" option)
2. Users can preview before saving
3. No server load
4. Charts render perfectly
5. No cookie banner issues

Just improve the print CSS to:
- Hide unwanted elements
- Add letterhead/footer
- Ensure all content is visible
- Control page breaks

## Quick Fix

Update the export button to make "Print to PDF" the primary option:

```typescript
<button
  onClick={() => window.print()}
  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
>
  <FileText className="h-4 w-4 text-[#800020]" />
  <div>
    <div className="font-medium">Export as PDF</div>
    <div className="text-xs text-gray-500">Use browser print (Ctrl+P)</div>
  </div>
</button>
```

Then add proper print CSS to each report page.

## Why This Works

- **No server-side complexity** - Browser handles everything
- **No cookie banners** - Print CSS hides them
- **Full content** - Browser captures everything
- **Charts work** - Canvas elements print correctly
- **Fast** - Instant preview
- **User control** - Can adjust settings before saving

---

**Bottom Line**: Don't fight the browser. Use its built-in PDF generation with good print CSS.
