'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginatedReportRowsProps<T> {
  rows: T[];
  children: (rows: T[], startIndex: number) => React.ReactNode;
  pageSize?: number;
  label?: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function PaginatedReportRows<T>({
  rows,
  children,
  pageSize = DEFAULT_PAGE_SIZE,
  label = 'rows',
  className,
}: PaginatedReportRowsProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, rows.length);
  const pageRows = useMemo(() => rows.slice(start, end), [rows, start, end]);

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <style jsx global>{`
        body[data-report-exporting="true"] .report-paginated-page {
          display: none !important;
        }

        body[data-report-exporting="true"] .report-export-all {
          display: block !important;
        }

        body[data-report-exporting="true"] .report-pagination-controls {
          display: none !important;
        }
      `}</style>
      <div className="report-paginated-page transition-opacity duration-150 ease-out">
        {children(pageRows, start)}
      </div>
      <div className="report-export-all hidden">
        {children(rows, 0)}
      </div>
      {rows.length > pageSize && (
        <div className="report-pagination-controls flex flex-col gap-3 border-t border-gray-100 pt-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing <span className="font-semibold text-gray-900">{start + 1}</span> to{' '}
            <span className="font-semibold text-gray-900">{end}</span> of{' '}
            <span className="font-semibold text-gray-900">{rows.length}</span> {label}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="min-w-24 text-center font-medium text-gray-900">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
