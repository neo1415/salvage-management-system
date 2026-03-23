/**
 * Dashboard Skeleton Loader
 * 
 * Displays skeleton loading state for dashboard pages.
 * Matches the layout of actual dashboard content.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.7
 */

import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Large Card Skeleton */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>

        {/* Grid Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="bg-white rounded-lg shadow p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
