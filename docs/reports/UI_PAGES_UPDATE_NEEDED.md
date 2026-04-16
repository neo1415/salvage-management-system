# Report Pages UI Update Required

## Issue
The API routes have been created and are working, but the UI pages are still showing placeholder messages. The pages need to be updated to fetch data from the APIs and display it.

## What Was Done
✅ Created 9 new API routes with proper services and centralized data
✅ Fixed TypeScript errors
✅ Verified all APIs compile successfully

## What Still Needs To Be Done
❌ Update UI page components to fetch and display data

## Pages That Need Updating

### 1. Operational Reports
- `/reports/operational/auction-performance/page.tsx` - ✅ UPDATED
- `/reports/operational/vendor-performance/page.tsx` - ✅ UPDATED

### 2. User Performance Reports  
- `/reports/user-performance/adjusters/page.tsx` - ✅ UPDATED
- `/reports/user-performance/finance/page.tsx` - ⏳ NEEDS UPDATE
- `/reports/user-performance/managers/page.tsx` - ⏳ NEEDS UPDATE

### 3. Financial Reports
- `/reports/financial/profitability/page.tsx` - ⏳ NEEDS UPDATE
- `/reports/financial/vendor-spending/page.tsx` - ⏳ NEEDS UPDATE
- `/reports/financial/payment-analytics/page.tsx` - ⏳ NEEDS UPDATE

## Pattern To Follow

Each page should follow this pattern (see updated pages for examples):

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function ReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());

      const response = await fetch(`/api/reports/[category]/[report-type]?${params}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with back button and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Report Title</h1>
            <p className="text-muted-foreground">Report description</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && <ExportButton reportType="report-type" reportData={reportData} filters={filters} />}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={fetchReport}
            onReset={() => setFilters({ startDate: subDays(new Date(), 30), endDate: new Date() })}
            showAssetTypes={false}
            showRegions={false}
          />
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading data...</div>
          </CardContent>
        </Card>
      )}

      {/* Data display */}
      {!loading && reportData && (
        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              {/* Display summary metrics */}
            </CardContent>
          </Card>
          {/* Additional cards for detailed data */}
        </div>
      )}
    </div>
  );
}
```

## API Endpoints Available

All these endpoints are working and return data:

1. `/api/reports/operational/auction-performance`
2. `/api/reports/operational/vendor-performance`
3. `/api/reports/user-performance/my-performance`
4. `/api/reports/user-performance/adjusters`
5. `/api/reports/user-performance/finance`
6. `/api/reports/user-performance/managers`
7. `/api/reports/financial/profitability`
8. `/api/reports/financial/vendor-spending`
9. `/api/reports/financial/payment-analytics`

## Data Structures

Each API returns data in this format:

```typescript
{
  status: 'success',
  data: {
    summary: { /* key metrics */ },
    // Additional data specific to report type
  },
  metadata: {
    generatedAt: string,
    recordCount: number,
    executionTimeMs: number,
    cached: boolean
  }
}
```

## Next Steps

1. Update remaining 5 placeholder pages following the pattern above
2. Test each page to ensure data displays correctly
3. Verify export functionality works
4. Add error handling for failed API calls
5. Add empty state messages when no data is available

## Files Already Updated
- ✅ `src/app/(dashboard)/reports/operational/auction-performance/page.tsx`
- ✅ `src/app/(dashboard)/reports/operational/vendor-performance/page.tsx`
- ✅ `src/app/(dashboard)/reports/user-performance/adjusters/page.tsx`
- ✅ `src/app/(dashboard)/reports/user-performance/my-performance/page.tsx` (was already working)

## Files Still Needing Update
- ⏳ `src/app/(dashboard)/reports/user-performance/finance/page.tsx`
- ⏳ `src/app/(dashboard)/reports/user-performance/managers/page.tsx`
- ⏳ `src/app/(dashboard)/reports/financial/profitability/page.tsx`
- ⏳ `src/app/(dashboard)/reports/financial/vendor-spending/page.tsx`
- ⏳ `src/app/(dashboard)/reports/financial/payment-analytics/page.tsx`
