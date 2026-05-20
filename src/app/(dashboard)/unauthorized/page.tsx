import { Suspense } from 'react';
import { AppErrorPage } from '@/components/errors/app-error-page';

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={null}>
      <AppErrorPage variant="unauthorized" />
    </Suspense>
  );
}
