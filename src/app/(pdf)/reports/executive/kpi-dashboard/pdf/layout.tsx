/**
 * PDF Page Layout
 * Adds Suspense boundary for useSearchParams()
 */

import { ReactNode, Suspense } from 'react';

export default function PDFReportLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    }>
      {children}
    </Suspense>
  );
}
