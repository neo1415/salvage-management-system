/**
 * Base Skeleton Component
 * 
 * Provides a shimmer animation effect for loading states.
 * Used as building block for more complex skeleton loaders.
 * 
 * Requirements: 14.1, 14.2, 14.3
 */

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
    />
  );
}
