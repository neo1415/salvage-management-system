/**
 * Cases List Page
 * 
 * Display all cases created by the adjuster with filtering and status badges
 */

'use client';

import dynamic from 'next/dynamic';
import { CardSkeleton } from '@/components/skeletons/card-skeleton';

// Dynamic import for cases page content with skeleton loader
// This reduces initial bundle size and improves page load performance
const AdjusterCasesContent = dynamic(
  () => import('@/components/adjuster/adjuster-cases-content'),
  {
    loading: () => (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
          <h1 className="text-xl font-bold">My Cases</h1>
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    ),
    ssr: false, // Client-only component with TanStack Query
  }
);

export default function CasesPage() {
  return <AdjusterCasesContent />;
}
