'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { DataLoadingState } from '@/components/ui/loading-states';

/**
 * Manager Reports Page - REDIRECT
 * 
 * This page now redirects to the new Comprehensive Reporting System at /reports
 * The old basic reporting system has been replaced with a full-featured
 * enterprise reporting platform with 17+ report types.
 */
export default function ManagerReportsPage() {
  const router = useAppRouter();

  useEffect(() => {
    // Redirect to new comprehensive reporting system
    router.replace('/reports');
  }, [router]);

  return <DataLoadingState label="Opening reports" variant="minimal" className="min-h-[50vh] justify-center" />;
}
