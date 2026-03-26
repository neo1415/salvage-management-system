import { ReactNode } from 'react';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { DashboardTopBar } from '@/components/layout/dashboard-top-bar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Dashboard Layout
 * 
 * Layout for all dashboard pages (vendor, manager, adjuster, finance, admin)
 * Includes sidebar navigation, top bar with notifications/profile, offline indicator, sync progress, and toast notifications
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardSidebar />
        
        {/* Desktop Top Bar - Only visible on desktop */}
        <div className="hidden lg:block">
          <DashboardTopBar />
        </div>
        
        {/* Offline Indicator */}
        <OfflineIndicator />
        
        {/* Main Content - Adjusted for top bar on desktop */}
        <main className="fixed inset-0 lg:left-64 top-16 lg:top-16 overflow-y-auto">
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>
        
        {/* Sync Progress Indicator */}
        <SyncProgressIndicator />
      </div>
    </ToastProvider>
  );
}
