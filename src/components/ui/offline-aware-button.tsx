/**
 * Offline-Aware Button Component
 * 
 * Extends the base button element to automatically disable when offline.
 * Shows tooltip explaining why the button is disabled.
 */

'use client';

import { useOffline } from '@/hooks/use-offline';
import { ButtonHTMLAttributes, ReactNode } from 'react';

export interface OfflineAwareButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  requiresOnline?: boolean; // Default: true
  offlineTooltip?: string; // Default: "This action requires internet connection"
  onlineOnly?: boolean; // Alias for requiresOnline
  children?: ReactNode;
}

export function OfflineAwareButton({
  requiresOnline = true,
  offlineTooltip = 'This action requires internet connection',
  onlineOnly,
  disabled,
  className,
  title,
  children,
  ...props
}: OfflineAwareButtonProps) {
  const isOffline = useOffline();
  const shouldRequireOnline = requiresOnline || onlineOnly;
  const isDisabled = disabled || (shouldRequireOnline && isOffline);

  // Determine tooltip text
  const tooltipText = isOffline && shouldRequireOnline ? offlineTooltip : title;

  return (
    <button
      disabled={isDisabled}
      title={tooltipText}
      className={`${className || ''} ${isOffline && shouldRequireOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
