/**
 * Card Skeleton Loader
 * 
 * Displays skeleton loading state for card components.
 * Used in list views and grid layouts.
 * 
 * Requirements: 14.1, 14.2, 14.4, 14.7
 */

import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Image */}
      <Skeleton className="h-32 w-full rounded-lg mb-3" />

      {/* Content */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
