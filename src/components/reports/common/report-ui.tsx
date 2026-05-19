'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type React from 'react';

export function ReportLoadingState({ label = 'Loading report' }: { label?: string }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-center rounded-lg border bg-white py-10 text-[#800020]">
        <RefreshCw className="mr-3 h-6 w-6 animate-spin" />
        <span className="text-sm font-medium text-gray-700">{label}...</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="min-w-0 overflow-hidden">
            <CardHeader className="space-y-2 pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-36 max-w-full animate-pulse rounded bg-gray-200" />
              <div className="mt-3 h-3 w-24 animate-pulse rounded bg-gray-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
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
  '#800020',
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
