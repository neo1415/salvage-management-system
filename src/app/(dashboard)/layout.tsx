import { ReactNode } from 'react';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { SyncProgressIndicator } from '@/components/ui/sync-progress-indicator';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Dashboard Layout
 * 
 * Layout for all dashboard pages (vendor, manager, adjuster, finance, admin)
 * Includes sidebar navigation, offline indicator, sync progress, and toast notifications
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardSidebar />
        
        {/* Offline Indicator */}
        <OfflineIndicator />
        
        {/* Main Content */}
        <main className="lg:ml-64 pt-16 lg:pt-0">
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
