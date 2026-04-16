import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        {
          'border-transparent bg-[#800020] text-white': variant === 'default',
          'border-transparent bg-gray-200 text-gray-900': variant === 'secondary',
          'border-transparent bg-red-600 text-white': variant === 'destructive',
          'text-gray-900': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
