# Export Service

Provides CSV and PDF export functionality with RFC 4180 compliance and standardized NEM Insurance branding.

## Features

- **CSV Export**: RFC 4180 compliant CSV generation with proper field escaping
- **PDF Export**: Standardized PDF generation with NEM letterhead and footer
- **Custom Formatters**: Support for custom value formatting per column
- **Filename Generation**: Automatic filename generation with date suffix

## Usage

### CSV Export

```typescript
import { ExportService } from '@/features/export/services/export.service';

const csv = ExportService.generateCSV({
  filename: 'payments-export.csv',
  columns: [
    { key: 'id', header: 'Payment ID' },
    { key: 'amount', header: 'Amount', format: (v) => `₦${v.toLocaleString()}` },
    { key: 'status', header: 'Status' },
  ],
  data: payments,
});

// Download CSV
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = ExportService.generateFilename('payments', 'csv');
a.click();
```

### PDF Export

```typescript
import { ExportService } from '@/features/export/services/export.service';

const pdfBuffer = await ExportService.generatePDF({
  filename: 'payments-export.pdf',
  title: 'Payment Report',
  columns: [
    { key: 'id', header: 'Payment ID' },
    { key: 'amount', header: 'Amount', format: (v) => `₦${v.toLocaleString()}` },
    { key: 'status', header: 'Status' },
  ],
  data: payments,
});

// Download PDF
const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = ExportService.generateFilename('payments', 'pdf');
a.click();
```

## CSV Field Escaping

The service automatically handles RFC 4180 escaping:

- Fields containing commas are wrapped in quotes
- Fields containing quotes have internal quotes doubled
- Fields containing newlines are wrapped in quotes
- Null/undefined values are converted to empty strings

## Requirements

- Requirements: 12.2, 12.3, 23.1, 23.2, 23.3
- Related Services: PDFTemplateService
