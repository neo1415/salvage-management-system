'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { DataLoadingState } from '@/components/ui/loading-states';

export default function CasesPage() {
  const router = useAppRouter();

  useEffect(() => {
    router.replace('/adjuster/cases/new');
  }, [router]);

  return <DataLoadingState label="Opening case submission" variant="page" />;
}
