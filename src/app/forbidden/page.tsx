import { Suspense } from 'react';
import { AppErrorPage } from '@/components/errors/app-error-page';

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <AppErrorPage variant="forbidden" />
    </Suspense>
  );
}
