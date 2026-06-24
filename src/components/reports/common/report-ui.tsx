'use client';

import { cn } from '@/lib/utils';
import type React from 'react';
import {
  DataLoadingState,
  DataRefreshingHint,
} from '@/components/ui/loading-states';
import {
  MetricValue,
  StatGrid,
  StatCard,
  StatTile,
  ReportKPICard as ReportKPICardBase,
} from '@/components/ui/stat-card';

export {
  DataLoadingState,
  DataRefreshingHint,
  PageLoadingSkeleton,
  AppSpinner,
  AppSpinnerWithLabel,
  NavigationProgressBar,
} from '@/components/ui/loading-states';

export {
  MetricValue,
  StatGrid,
  StatCard,
  StatTile,
} from '@/components/ui/stat-card';

/** @deprecated Prefer `DataLoadingState` */
export function ReportLoadingState({ label = 'Loading report' }: { label?: string }) {
  return <DataLoadingState label={label} variant="report" />;
}

/** @deprecated Prefer `DataRefreshingHint` */
export function ReportRefreshingHint({ className }: { className?: string }) {
  return <DataRefreshingHint className={className} />;
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

export function ReportSummaryGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <StatGrid minCol={160} className={className}>
      {children}
    </StatGrid>
  );
}

export function ReportSummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 overflow-hidden', className)}>
      <p className="text-sm text-muted-foreground truncate">{label}</p>
      <MetricValue className="mt-1">{value}</MetricValue>
    </div>
  );
}

export function ReportKPICard(props: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  trend?: number;
  className?: string;
}) {
  return <ReportKPICardBase {...props} />;
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
