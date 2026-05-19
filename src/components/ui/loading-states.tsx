'use client';

/**
 * Unified loading UI for Salvage (burgundy brand).
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const BRAND_SPINNER =
  'border-burgundy-800 border-t-transparent animate-spin rounded-full border-2';

export type DataLoadingVariant = 'report' | 'page' | 'table' | 'minimal';

export function AppSpinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClass =
    size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-12 w-12 border-[3px]' : 'h-8 w-8';
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(BRAND_SPINNER, sizeClass, className)}
    />
  );
}

export function AppSpinnerWithLabel({
  label = 'Loading',
  description,
  className,
}: {
  label?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 text-center',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <AppSpinner size="lg" />
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {description ? (
        <p className="text-sm text-gray-500 max-w-sm">{description}</p>
      ) : null}
    </div>
  );
}

export function DataLoadingState({
  label = 'Loading',
  description,
  variant = 'report',
  className,
}: {
  label?: string;
  description?: string;
  variant?: DataLoadingVariant;
  className?: string;
}) {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2 text-burgundy-800', className)}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        <span className="text-sm font-medium text-gray-700">{label}…</span>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={cn('flex min-h-[40vh] items-center justify-center', className)}>
        <AppSpinnerWithLabel label={label} description={description} />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', className)}>
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 bg-burgundy-50/40">
          <Loader2 className="h-5 w-5 animate-spin text-burgundy-800 shrink-0" />
          <span className="text-sm font-medium text-gray-800">{label}…</span>
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-burgundy-100/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4', className)} role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-3 rounded-lg border border-burgundy-100 bg-white py-8 shadow-sm">
        <Loader2 className="h-6 w-6 animate-spin text-burgundy-800 shrink-0" />
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {description ? (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">This may take a few moments</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="min-w-0 overflow-hidden border-burgundy-50">
            <CardHeader className="space-y-2 pb-2">
              <Skeleton className="h-4 w-28 bg-burgundy-100/40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-36 max-w-full bg-burgundy-100/50" />
              <Skeleton className="mt-3 h-3 w-24 bg-gray-100" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-burgundy-50">
        <CardHeader>
          <Skeleton className="h-5 w-40 bg-burgundy-100/40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg bg-gray-100" />
        </CardContent>
      </Card>
    </div>
  );
}

export function DataRefreshingHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'text-sm text-burgundy-800 mb-3 flex items-center gap-2 font-medium',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      Updating…
    </div>
  );
}

export function PageLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto max-w-7xl space-y-6 animate-in fade-in duration-200', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 bg-burgundy-100/50" />
        <Skeleton className="h-4 w-80 max-w-full bg-gray-100" />
      </div>
      <DataLoadingState label="Loading page" variant="report" />
    </div>
  );
}

export function NavigationProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 450);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 top-16 z-[100] h-0.5 overflow-hidden lg:left-64"
      aria-hidden
    >
      <div className="navigation-progress-bar h-full w-1/3 bg-burgundy-800 shadow-[0_0_8px_rgba(128,0,32,0.45)]" />
      <style jsx global>{`
        @keyframes navigation-progress-slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(350%);
          }
        }
        .navigation-progress-bar {
          animation: navigation-progress-slide 0.45s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
