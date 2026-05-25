import { Suspense } from 'react';
import { AppErrorPage } from '@/components/errors/app-error-page';

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <AppErrorPage variant="not-found" />
    </Suspense>
  );
}
