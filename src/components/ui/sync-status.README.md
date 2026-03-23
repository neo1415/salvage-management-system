# Sync Status Component

## Overview

The Sync Status component provides real-time visibility into offline sync operations, displaying connection status, sync progress, pending changes, and last sync timestamp.

## Components

### 1. `SyncStatus` (Main Component)

Full-featured sync status indicator with detailed tooltip.

**Props:**
- `className?: string` - Additional CSS classes
- `showDetails?: boolean` - Show status text (default: true)

**Features:**
- Online/offline indicator with color-coded icons
- Real-time sync progress with percentage
- Pending changes count badge
- Last sync timestamp
- Manual sync trigger (click to sync)
- Detailed tooltip on hover
- Error notifications

**Usage:**
```tsx
import { SyncStatus } from '@/components/ui/sync-status';

export function Header() {
  return (
    <header>
      <SyncStatus className="ml-auto" />
    </header>
  );
}
```

### 2. `SyncStatusBadge` (Compact Version)

Minimal version for headers/footers without status text.

**Usage:**
```tsx
import { SyncStatusBadge } from '@/components/ui/sync-status';

export function Footer() {
  return (
    <footer>
      <SyncStatusBadge />
    </footer>
  );
}
```

### 3. `SyncStatusExtended` (Extended Version)

Full version with storage statistics.

**Usage:**
```tsx
import { SyncStatusExtended } from '@/components/ui/sync-status';

export function SettingsPage() {
  return (
    <div>
      <h2>Offline Sync</h2>
      <SyncStatusExtended />
    </div>
  );
}
```

## Visual States

### 1. Online & Synced
- Green wifi icon
- Green checkmark icon
- "Synced" text
- No badge

### 2. Online & Pending
- Green wifi icon
- Gray clock icon
- Pending count badge (burgundy)
- "X pending" text

### 3. Offline
- Red wifi-off icon
- Gray clock icon
- Pending count badge
- "Offline" text

### 4. Syncing
- Green wifi icon
- Blue spinning refresh icon
- Progress bar overlay
- "Syncing..." text

### 5. Sync Errors
- Green wifi icon
- Amber alert icon
- Error count badge
- "X errors" text

## Tooltip Information

Hover over the component to see:
- Connection status (Online/Offline)
- Last sync timestamp (e.g., "5m ago")
- Pending changes count
- Synced cases count
- Error count (if any)
- Manual "Sync Now" button (when online with pending changes)
- Offline message (when offline)

## Sync Progress Overlay

During sync operations, displays:
- Current case being synced
- Progress count (e.g., "3/10")
- Progress bar with percentage
- Percentage text

## Manual Sync

Click the component to trigger manual sync when:
- Online
- Not currently syncing
- Has pending changes

## Auto-Refresh

- Sync status refreshes every 10 seconds
- Storage stats refresh every 30 seconds
- Progress updates in real-time via callbacks

## Integration with Offline Sync Service

The component integrates with:
- `getSyncStatus()` - Get current sync status
- `syncOfflineCases()` - Trigger manual sync
- `onSyncProgress()` - Listen for sync progress
- `getStorageStats()` - Get storage statistics

## Accessibility

- All icons have `aria-label` attributes
- Progress bar has proper ARIA attributes
- Keyboard accessible (click to sync)
- Screen reader friendly status updates

## Styling

Uses Tailwind CSS with:
- Burgundy brand color (#800020) for badges and buttons
- Green for online/success states
- Red for offline states
- Amber for warnings/errors
- Gray for neutral states

## Best Practices

1. **Placement:**
   - Use `SyncStatus` in main navigation header
   - Use `SyncStatusBadge` in compact headers/footers
   - Use `SyncStatusExtended` in settings/admin pages

2. **User Experience:**
   - Always visible to users
   - Non-intrusive but informative
   - Clear visual feedback
   - Easy manual sync access

3. **Performance:**
   - Efficient polling (10s intervals)
   - Minimal re-renders
   - Cleanup on unmount

## Example Implementations

### Dashboard Header
```tsx
import { SyncStatus } from '@/components/ui/sync-status';

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between p-4 bg-white border-b">
      <h1>Dashboard</h1>
      <SyncStatus />
    </header>
  );
}
```

### Mobile Footer
```tsx
import { SyncStatusBadge } from '@/components/ui/sync-status';

export function MobileFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 p-2 bg-white border-t">
      <div className="flex justify-center">
        <SyncStatusBadge />
      </div>
    </footer>
  );
}
```

### Settings Page
```tsx
import { SyncStatusExtended } from '@/components/ui/sync-status';

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Offline Sync</h2>
        <SyncStatusExtended />
      </section>
    </div>
  );
}
```

## Testing

### Manual Testing Scenarios

1. **Online → Offline:**
   - Start online
   - Disconnect network
   - Verify offline indicator appears
   - Create offline case
   - Verify pending count increases

2. **Offline → Online:**
   - Start offline with pending cases
   - Reconnect network
   - Verify auto-sync triggers
   - Verify progress bar appears
   - Verify pending count decreases

3. **Manual Sync:**
   - Have pending cases
   - Click sync status
   - Verify sync starts
   - Verify progress updates
   - Verify completion

4. **Sync Errors:**
   - Create case with invalid data
   - Trigger sync
   - Verify error indicator
   - Verify error count in tooltip

## Dependencies

- `lucide-react` - Icons
- `@/features/cases/services/offline-sync.service` - Sync logic
- `@/lib/db/indexeddb` - Storage stats
- Tailwind CSS - Styling

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires:
- IndexedDB support
- Service Worker support
- Online/offline event support
