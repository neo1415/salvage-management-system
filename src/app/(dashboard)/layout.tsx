import { ReactNode } from 'react';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';

/**
 * Dashboard Layout
 * 
 * Layout for all dashboard pages (vendor, manager, adjuster, finance, admin)
 * Includes sidebar navigation and responsive mobile menu
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar />
      
      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
