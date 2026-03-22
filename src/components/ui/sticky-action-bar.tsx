/**
 * Sticky Action Bar Component
 * 
 * Positions primary actions in the thumb zone (lower third of screen)
 * Follows mobile-first design principles for easy one-handed use
 */

'use client';

import { ReactNode } from 'react';

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  position?: 'bottom' | 'top';
  transparent?: boolean;
}

export function StickyActionBar({
  children,
  className = '',
  position = 'bottom',
  transparent = false,
}: StickyActionBarProps) {
  const positionStyles = position === 'bottom' 
    ? 'bottom-0 border-t' 
    : 'top-0 border-b';

  const backgroundStyles = transparent
    ? 'bg-white/95 backdrop-blur-sm'
    : 'bg-white';

  return (
    <div
      className={`
        sticky ${positionStyles} left-0 right-0 z-20
        ${backgroundStyles} border-gray-200
        px-4 py-3 shadow-lg
        ${className}
      `}
    >
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}
