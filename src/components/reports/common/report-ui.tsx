'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type React from 'react';
import {
  DataLoadingState,
  DataRefreshingHint,
} from '@/components/ui/loading-states';

export {
  DataLoadingState,
  DataRefreshingHint,
  PageLoadingSkeleton,
  AppSpinner,
  AppSpinnerWithLabel,
  NavigationProgressBar,
} from '@/components/ui/loading-states';

/** @deprecated Prefer `DataLoadingState` */
export function ReportLoadingState({ label = 'Loading report' }: { label?: string }) {
  return <DataLoadingState label={label} variant="report" />;
}

/** @deprecated Prefer `DataRefreshingHint` */
export function ReportRefreshingHint({ className }: { className?: string }) {
  return <DataRefreshingHint className={className} />;
}

export function MetricValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'max-w-full break-words font-bold leading-tight text-gray-950 text-[clamp(1.15rem,1.55vw,1.6rem)]',
        className
      )}
    >
      {children}
    </p>
  );
}

export function MetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function ChartFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative h-72 min-w-0 overflow-hidden sm:h-80', className)}>
      {children}
    </div>
  );
}

export const REPORT_CHART_COLORS = [
  'var(--brand-primary)',
  '#0F766E',
  '#2563EB',
  '#D97706',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#0891B2',
  '#4F46E5',
  '#A16207',
];
