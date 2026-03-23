import { ReactNode } from 'react';

/**
 * Manager Dashboard Layout
 * Wraps all manager pages with common layout
 */

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
