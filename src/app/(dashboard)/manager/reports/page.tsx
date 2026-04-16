'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Manager Reports Page - REDIRECT
 * 
 * This page now redirects to the new Comprehensive Reporting System at /reports
 * The old basic reporting system has been replaced with a full-featured
 * enterprise reporting platform with 17+ report types.
 */
export default function ManagerReportsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new comprehensive reporting system
    router.replace('/reports');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Reports...</p>
      </div>
    </div>
  );
}
