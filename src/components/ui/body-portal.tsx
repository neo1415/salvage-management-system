'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';

interface BodyPortalProps {
  open: boolean;
  children: ReactNode;
}

/**
 * Renders into document.body only while mounted and open.
 * Closes automatically on route change to avoid portal/DOM races during navigation.
 */
export function BodyPortal({ open, children }: BodyPortalProps) {
  const pathname = usePathname();
  const [portalReady, setPortalReady] = useState(false);
  const [routeOpen, setRouteOpen] = useState(open);

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    setRouteOpen(open);
  }, [open]);

  useEffect(() => {
    setRouteOpen(false);
  }, [pathname]);

  if (!portalReady || !routeOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
}
