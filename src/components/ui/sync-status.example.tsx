/**
 * Sync Status Component - Usage Examples
 * 
 * This file demonstrates various ways to use the sync status components
 * in different parts of the application.
 */

import { SyncStatus, SyncStatusBadge, SyncStatusExtended } from './sync-status';

/**
 * Example 1: Dashboard Header
 * Full sync status with details in the main navigation
 */
export function DashboardHeaderExample() {
  return (
    <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Full sync status with details */}
        <SyncStatus />
        
        {/* Other header items */}
        <button className="px-4 py-2 text-sm">
          Settings
        </button>
      </div>
    </header>
  );
}

/**
 * Example 2: Mobile Navigation
 * Compact badge version for mobile headers
 */
export function MobileNavigationExample() {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
      <div className="flex items-center justify-between p-3">
        <button className="p-2">
          {/* Menu icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <h1 className="text-lg font-semibold">NEM Salvage</h1>
        
        {/* Compact sync status badge */}
        <SyncStatusBadge />
      </div>
    </nav>
  );
}

/**
 * Example 3: Settings Page
 * Extended version with storage statistics
 */
export function SettingsPageExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      
      <div className="space-y-8">
        {/* Offline Sync Section */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Offline Sync
          </h2>
          
          <p className="text-gray-600 mb-6">
            Manage offline case storage and synchronization settings.
          </p>
          
          {/* Extended sync status with storage info */}
          <SyncStatusExtended />
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Cases created while offline will automatically 
              sync when your connection is restored. You can also manually trigger 
              sync by clicking the sync status indicator.
            </p>
          </div>
        </section>
        
        {/* Other settings sections */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Notifications
          </h2>
          {/* Notification settings */}
        </section>
      </div>
    </div>
  );
}

/**
 * Example 4: Footer with Sync Status
 * Minimal footer with sync indicator
 */
export function FooterExample() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="text-sm text-gray-600">
          © 2024 NEM Insurance
        </div>
        
        {/* Sync status badge in footer */}
        <SyncStatusBadge />
        
        <div className="text-sm text-gray-600">
          <a href="/privacy" className="hover:text-gray-900">Privacy</a>
          {' · '}
          <a href="/terms" className="hover:text-gray-900">Terms</a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Example 5: Sidebar with Sync Status
 * Sync status in a sidebar navigation
 */
export function SidebarExample() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      {/* Navigation items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <a href="/dashboard" className="block px-4 py-2 rounded hover:bg-gray-100">
              Dashboard
            </a>
          </li>
          <li>
            <a href="/cases" className="block px-4 py-2 rounded hover:bg-gray-100">
              Cases
            </a>
          </li>
          <li>
            <a href="/auctions" className="block px-4 py-2 rounded hover:bg-gray-100">
              Auctions
            </a>
          </li>
        </ul>
      </nav>
      
      {/* Sync status at bottom of sidebar */}
      <div className="p-4 border-t border-gray-200">
        <SyncStatus className="w-full" />
      </div>
    </aside>
  );
}

/**
 * Example 6: Inline Sync Status in Form
 * Show sync status when creating offline cases
 */
export function CaseFormExample() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Create New Case
          </h2>
          
          {/* Show sync status in form header */}
          <SyncStatusBadge />
        </div>
        
        {/* Form fields */}
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Claim Reference
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Enter claim reference"
            />
          </div>
          
          {/* More form fields */}
          
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="px-6 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018]"
            >
              Create Case
            </button>
          </div>
        </form>
        
        {/* Offline notice */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <SyncStatusBadge />
            <p className="text-sm text-amber-800">
              You're currently offline. This case will be saved locally and 
              synced automatically when your connection is restored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Example 7: Admin Dashboard with Extended Status
 * Show detailed sync information for administrators
 */
export function AdminDashboardExample() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Admin Dashboard
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dashboard cards */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">System Overview</h2>
            {/* Content */}
          </div>
        </div>
        
        {/* Sidebar with sync status */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Sync Status</h3>
            <SyncStatusExtended />
          </div>
          
          {/* Other sidebar widgets */}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 8: Toast Notification with Sync Status
 * Show sync status in toast notifications
 */
export function ToastNotificationExample() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <SyncStatusBadge />
          
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">
              Sync Complete
            </h4>
            <p className="text-sm text-gray-600">
              3 cases have been successfully synced to the server.
            </p>
          </div>
          
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Example 9: Responsive Layout
 * Adapt sync status display based on screen size
 */
export function ResponsiveLayoutExample() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold">Dashboard</h1>
            
            {/* Show full status on desktop, badge on mobile */}
            <div className="hidden md:block">
              <SyncStatus />
            </div>
            <div className="md:hidden">
              <SyncStatusBadge />
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Content */}
      </main>
    </div>
  );
}

/**
 * Example 10: Custom Styled Sync Status
 * Override default styles for custom branding
 */
export function CustomStyledExample() {
  return (
    <div className="p-6">
      {/* Custom container with brand colors */}
      <div className="bg-gradient-to-r from-[#800020] to-[#600018] rounded-lg p-1">
        <div className="bg-white rounded-lg p-4">
          <SyncStatus className="[&_.text-gray-700]:text-[#800020]" />
        </div>
      </div>
    </div>
  );
}
