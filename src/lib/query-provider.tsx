/**
 * TanStack Query Provider Component
 * 
 * Client-side wrapper for QueryClientProvider.
 * Must be a separate client component to work with Next.js 14 App Router.
 * 
 * Requirements: 5.1, 5.2
 */

'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
