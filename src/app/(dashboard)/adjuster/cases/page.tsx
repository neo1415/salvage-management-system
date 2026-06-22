'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataLoadingState } from '@/components/ui/loading-states';

export default function CasesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/adjuster/cases/new');
  }, [router]);

  return <DataLoadingState label="Opening case submission" variant="page" />;
}
