'use client';

import type React from 'react';
import { AppLink } from '@/components/navigation/app-link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Responsive metric text — prevents overflow in grid cards */
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
        'max-w-full break-words font-bold leading-tight text-gray-950 text-[clamp(1rem,1.4vw,1.75rem)]',
        className
      )}
    >
      {children}
    </p>
  );
}

export function StatGrid({
  children,
  className,
  minCol = 160,
}: {
  children: React.ReactNode;
  className?: string;
  /** Minimum column width in px for auto-fit grid */
  minCol?: number;
}) {
  return (
    <div
      className={cn('grid min-w-0 gap-4', className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function StatTile({
  title,
  value,
  subtitle,
  className,
  valueClassName,
  href,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  className?: string;
  valueClassName?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">{title}</p>
      <MetricValue className={cn('mt-2', valueClassName)}>{value}</MetricValue>
      {subtitle ? (
        <p className="mt-1 text-xs text-gray-500 line-clamp-2 break-words">{subtitle}</p>
      ) : null}
    </>
  );

  const base = cn('rounded-lg border border-gray-200 p-4 min-w-0 overflow-hidden', className);

  if (href) {
    return (
      <AppLink href={href} className={cn(base, 'hover:border-[var(--brand-primary)] transition-colors block')}>
        {inner}
      </AppLink>
    );
  }

  return <div className={base}>{inner}</div>;
}

/** White shadow card with optional icon (finance / role dashboards) */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  className,
  valueClassName,
  href,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-600 truncate">{title}</p>
        <MetricValue className={cn('mt-2 text-gray-900', valueClassName)}>{value}</MetricValue>
        {subtitle ? (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">{subtitle}</p>
        ) : null}
      </div>
      {icon ? <div className="shrink-0">{icon}</div> : null}
    </div>
  );

  const base = cn('bg-white rounded-lg shadow p-6 min-w-0 overflow-hidden', className);

  if (href) {
    return (
      <AppLink href={href} className={cn(base, 'hover:shadow-md transition-shadow block')}>
        {content}
      </AppLink>
    );
  }

  return <div className={base}>{content}</div>;
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

export function ReportKPICard({
  title,
  value,
  subtitle,
  trend,
  className,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  trend?: number;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 overflow-hidden', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <MetricValue className="mt-2">{value}</MetricValue>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">{subtitle}</p>
            )}
          </div>
          {trend !== undefined && trend !== 0 && (
            <div
              className={cn(
                'flex shrink-0 items-center text-sm font-medium',
                trend > 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
