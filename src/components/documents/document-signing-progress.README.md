# DocumentSigningProgress Component

## Overview

The `DocumentSigningProgress` component displays document signing progress with a visual progress bar, document list with status badges, and a success banner when all documents are signed. This component is part of the Escrow Wallet Payment Completion feature (Requirement 2).

## Features

- **Progress Bar**: Visual indicator showing X/3 documents signed with percentage
- **Document List**: List of all documents with status badges (Pending/Signed/Voided)
- **Success Banner**: Green banner displayed when all documents are signed
- **Responsive Design**: Mobile-first design with responsive text and spacing
- **Accessibility**: Full WCAG 2.1 Level AA compliance with ARIA labels and keyboard navigation
- **Color-Coded Status**: Visual indicators for different document statuses

## Props

```typescript
interface Document {
  id: string;
  type: 'bill_of_sale' | 'liability_waiver' | 'pickup_authorization';
  status: 'pending' | 'signed' | 'voided';
  title: string;
  signedAt?: string | null;
}

interface DocumentSigningProgressProps {
  progress: {
    totalDocuments: number;      // Total number of documents (always 3)
    signedDocuments: number;      // Number of signed documents (0-3)
    progress: number;             // Progress percentage (0-100)
    allSigned: boolean;           // Whether all documents are signed
  };
  documents: Document[];          // Array of document objects
}
```

## Usage

### Basic Usage

```tsx
import { DocumentSigningProgress } from '@/components/documents/document-signing-progress';

function DocumentsPage() {
  const progress = {
    totalDocuments: 3,
    signedDocuments: 1,
    progress: 33,
    allSigned: false,
  };

  const documents = [
    {
      id: 'doc-1',
      type: 'bill_of_sale',
      status: 'signed',
      title: 'Bill of Sale',
      signedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'doc-2',
      type: 'liability_waiver',
      status: 'pending',
      title: 'Liability Waiver',
      signedAt: null,
    },
    {
      id: 'doc-3',
      type: 'pickup_authorization',
      status: 'pending',
      title: 'Pickup Authorization',
      signedAt: null,
    },
  ];

  return (
    <DocumentSigningProgress
      progress={progress}
      documents={documents}
    />
  );
}
```

### Integration with API

```tsx
import { DocumentSigningProgress } from '@/components/documents/document-signing-progress';
import { useEffect, useState } from 'react';

function DocumentsPage({ auctionId }: { auctionId: string }) {
  const [progress, setProgress] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    async function fetchProgress() {
      const response = await fetch(`/api/auctions/${auctionId}/documents/progress`);
      const data = await response.json();
      
      setProgress({
        totalDocuments: data.totalDocuments,
        signedDocuments: data.signedDocuments,
        progress: data.progress,
        allSigned: data.allSigned,
      });
      
      setDocuments(data.documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        title: getDocumentTitle(doc.type),
        signedAt: doc.signedAt,
      })));
    }

    fetchProgress();
  }, [auctionId]);

  if (!progress || !documents.length) {
    return <div>Loading...</div>;
  }

  return (
    <DocumentSigningProgress
      progress={progress}
      documents={documents}
    />
  );
}
```

## API Integration

### Endpoint

```
GET /api/auctions/[id]/documents/progress
```

### Response Format

```json
{
  "totalDocuments": 3,
  "signedDocuments": 1,
  "progress": 33,
  "allSigned": false,
  "documents": [
    {
      "id": "doc-1",
      "type": "bill_of_sale",
      "status": "signed",
      "signedAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "doc-2",
      "type": "liability_waiver",
      "status": "pending",
      "signedAt": null
    },
    {
      "id": "doc-3",
      "type": "pickup_authorization",
      "status": "pending",
      "signedAt": null
    }
  ]
}
```

## Document Types

- `bill_of_sale`: Bill of Sale document
- `liability_waiver`: Liability Waiver document
- `pickup_authorization`: Pickup Authorization document

## Document Statuses

- `pending`: Document has not been signed yet (yellow badge)
- `signed`: Document has been signed (green badge)
- `voided`: Document has been voided (red badge)

## Progress States

The component handles all progress states:

- **0/3 (0%)**: No documents signed
- **1/3 (33%)**: One document signed
- **2/3 (67%)**: Two documents signed
- **3/3 (100%)**: All documents signed (shows success banner)

## Styling

The component uses Tailwind CSS classes and follows the application's design system:

- **Primary Color**: Burgundy-900 for progress bar (when not complete)
- **Success Color**: Green-500 for progress bar (when complete), green badges
- **Warning Color**: Yellow-100/800 for pending badges
- **Error Color**: Red-100/800 for voided badges
- **Responsive**: Mobile-first with `sm:` breakpoints

## Accessibility

The component is fully accessible and compliant with WCAG 2.1 Level AA:

- **ARIA Labels**: Proper labels for all interactive elements
- **Roles**: Correct semantic roles (region, progressbar, list, listitem, status, alert)
- **Live Regions**: Success banner uses `aria-live="assertive"` for screen reader announcements
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Color Contrast**: All text meets WCAG AA contrast requirements

## Testing

The component has comprehensive unit tests covering:

- Component rendering with various progress states
- Progress bar display and calculations
- Status badge rendering and styling
- Success banner display
- Accessibility features
- Responsive design
- Edge cases (empty list, long titles, mixed statuses)

Run tests:

```bash
npm run test:unit -- tests/unit/components/document-signing-progress.test.tsx
```

## Example

See `document-signing-progress.example.tsx` for a complete interactive example with:

- State selector to switch between progress states (0/3, 1/3, 2/3, 3/3)
- Mobile preview
- Voided document example

## Related Components

- `WalletPaymentConfirmation`: Wallet payment confirmation component
- `DigitalSignaturePad`: Component for signing documents
- `DocumentViewer`: Component for viewing documents

## Requirements

This component implements **Requirement 2: Document Signing Progress Tracking** from the Escrow Wallet Payment Completion feature specification.

## Notes

- The component expects exactly 3 documents (Bill of Sale, Liability Waiver, Pickup Authorization)
- Progress percentage is calculated as `(signedDocuments / totalDocuments) * 100`
- The progress bar changes from burgundy to green when all documents are signed
- The success banner only appears when `allSigned` is `true`
- Helper text is hidden when all documents are signed
