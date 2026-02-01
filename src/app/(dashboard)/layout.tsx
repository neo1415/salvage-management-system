import { ReactNode } from 'react';

/**
 * Dashboard Layout
 * 
 * Layout for all dashboard pages (vendor, manager, adjuster, finance, admin)
 * This is a simple pass-through layout for now
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
