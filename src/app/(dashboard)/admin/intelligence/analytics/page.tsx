import { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalyticsDashboardContent } from '@/components/intelligence/admin/analytics/analytics-dashboard-content';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Admin Intelligence Analytics Dashboard Page
 * 
 * Comprehensive analytics dashboard with asset performance, temporal patterns,
 * geographic distribution, vendor segments, and conversion funnel analysis.
 * 
 * Task: 11.3.1 - Create admin analytics page
 */

export const metadata: Metadata = {
  title: 'Analytics Dashboard | Intelligence',
  description: 'Comprehensive marketplace intelligence analytics and insights',
};

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive marketplace intelligence and performance metrics
          </p>
        </div>
      </div>

      <Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <AnalyticsDashboardContent />
      </Suspense>
    </div>
  );
}
