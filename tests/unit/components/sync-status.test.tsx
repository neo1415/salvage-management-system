import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncStatus, SyncStatusBadge, SyncStatusExtended } from '@/components/ui/sync-status';
import * as offlineSyncService from '@/features/cases/services/offline-sync.service';
import * as indexeddb from '@/lib/db/indexeddb';

// Mock the offline sync service
vi.mock('@/features/cases/services/offline-sync.service');
vi.mock('@/lib/db/indexeddb');

describe('SyncStatus Component', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    // Mock sync status
    vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
      isSyncing: false,
      pendingCount: 0,
      errorCount: 0,
      syncedCount: 5,
    });
    
    // Mock storage stats
    vi.mocked(indexeddb.getStorageStats).mockResolvedValue({
      totalCases: 5,
      pendingSync: 0,
      syncing: 0,
      synced: 5,
      errors: 0,
      queueSize: 0,
    });
  });

  describe('Online Status', () => {
    it('should display online indicator when online', async () => {
      render(<SyncStatus />);
      
      await waitFor(() => {
        const onlineIcon = screen.getByLabelText('Online');
        expect(onlineIcon).toBeInTheDocument();
      });
    });

    it('should display offline indicator when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        const offlineIcon = screen.getByLabelText('Offline');
        expect(offlineIcon).toBeInTheDocument();
      });
    });

    it('should update status when going offline', async () => {
      render(<SyncStatus />);
      
      // Initially online
      await waitFor(() => {
        expect(screen.getByLabelText('Online')).toBeInTheDocument();
      });
      
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      fireEvent(window, new Event('offline'));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Offline')).toBeInTheDocument();
      });
    });

    it('should update status when going online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(<SyncStatus />);
      
      // Initially offline
      await waitFor(() => {
        expect(screen.getByLabelText('Offline')).toBeInTheDocument();
      });
      
      // Simulate going online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      fireEvent(window, new Event('online'));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Online')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Status Display', () => {
    it('should display synced status when no pending changes', async () => {
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('Synced')).toBeInTheDocument();
        expect(screen.getByLabelText('Synced')).toBeInTheDocument();
      });
    });

    it('should display pending count when cases are pending', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: false,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('3 pending')).toBeInTheDocument();
      });
    });

    it('should display syncing status during sync', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: true,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
        expect(screen.getByLabelText('Syncing')).toBeInTheDocument();
      });
    });

    it('should display error indicator when sync errors exist', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: false,
        pendingCount: 0,
        errorCount: 2,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Sync errors')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Progress', () => {
    it('should display sync progress bar during sync', async () => {
      render(<SyncStatus />);
      
      // Simulate sync progress
      const progressCallback = vi.mocked(offlineSyncService.onSyncProgress).mock.calls[0][0];
      progressCallback({
        total: 10,
        completed: 5,
        failed: 0,
        current: 'Case #12345',
        status: 'syncing',
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Syncing Case #12345/)).toBeInTheDocument();
        expect(screen.getByText('5/10')).toBeInTheDocument();
        expect(screen.getByText('50% complete')).toBeInTheDocument();
      });
    });

    it('should hide progress bar after sync completes', async () => {
      vi.useFakeTimers();
      
      render(<SyncStatus />);
      
      // Simulate sync completion
      const progressCallback = vi.mocked(offlineSyncService.onSyncProgress).mock.calls[0][0];
      progressCallback({
        total: 10,
        completed: 10,
        failed: 0,
        status: 'completed',
      });
      
      await waitFor(() => {
        expect(screen.getByText('10/10')).toBeInTheDocument();
      });
      
      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000);
      
      await waitFor(() => {
        expect(screen.queryByText('10/10')).not.toBeInTheDocument();
      });
      
      vi.useRealTimers();
    });
  });

  describe('Manual Sync', () => {
    it('should trigger sync when clicked', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: false,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      vi.mocked(offlineSyncService.syncOfflineCases).mockResolvedValue({
        success: true,
        synced: 3,
        failed: 0,
        conflicts: [],
        errors: [],
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('3 pending')).toBeInTheDocument();
      });
      
      // Click to trigger sync
      const syncButton = screen.getByText('3 pending').closest('div');
      fireEvent.click(syncButton!);
      
      await waitFor(() => {
        expect(offlineSyncService.syncOfflineCases).toHaveBeenCalled();
      });
    });

    it('should not trigger sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: false,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
      
      // Click should not trigger sync
      const syncButton = screen.getByText('Offline').closest('div');
      fireEvent.click(syncButton!);
      
      expect(offlineSyncService.syncOfflineCases).not.toHaveBeenCalled();
    });

    it('should not trigger sync when already syncing', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: true,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });
      
      // Click should not trigger another sync
      const syncButton = screen.getByText('Syncing...').closest('div');
      fireEvent.click(syncButton!);
      
      expect(offlineSyncService.syncOfflineCases).not.toHaveBeenCalled();
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip on hover', async () => {
      render(<SyncStatus />);
      
      const component = screen.getByText('Synced').closest('div');
      fireEvent.mouseEnter(component!);
      
      await waitFor(() => {
        expect(screen.getByText('Connection:')).toBeInTheDocument();
        expect(screen.getByText('Last sync:')).toBeInTheDocument();
        expect(screen.getByText('Pending:')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(<SyncStatus />);
      
      const component = screen.getByText('Synced').closest('div');
      fireEvent.mouseEnter(component!);
      
      await waitFor(() => {
        expect(screen.getByText('Connection:')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(component!);
      
      await waitFor(() => {
        expect(screen.queryByText('Connection:')).not.toBeInTheDocument();
      });
    });

    it('should display sync now button when pending changes exist', async () => {
      vi.mocked(offlineSyncService.getSyncStatus).mockResolvedValue({
        isSyncing: false,
        pendingCount: 3,
        errorCount: 0,
        syncedCount: 5,
      });
      
      render(<SyncStatus />);
      
      const component = screen.getByText('3 pending').closest('div');
      fireEvent.mouseEnter(component!);
      
      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });
    });

    it('should display offline message when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      render(<SyncStatus />);
      
      const component = screen.getByText('Offline').closest('div');
      fireEvent.mouseEnter(component!);
      
      await waitFor(() => {
        expect(screen.getByText(/Changes will sync automatically/)).toBeInTheDocument();
      });
    });
  });

  describe('SyncStatusBadge', () => {
    it('should render without status text', async () => {
      render(<SyncStatusBadge />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Online')).toBeInTheDocument();
        expect(screen.queryByText('Synced')).not.toBeInTheDocument();
      });
    });
  });

  describe('SyncStatusExtended', () => {
    it('should display storage statistics', async () => {
      render(<SyncStatusExtended />);
      
      await waitFor(() => {
        expect(screen.getByText('Storage')).toBeInTheDocument();
        expect(screen.getByText('Total cases:')).toBeInTheDocument();
        expect(screen.getByText('Queue size:')).toBeInTheDocument();
      });
    });

    it('should refresh storage stats periodically', async () => {
      vi.useFakeTimers();
      
      render(<SyncStatusExtended />);
      
      await waitFor(() => {
        expect(indexeddb.getStorageStats).toHaveBeenCalledTimes(1);
      });
      
      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(indexeddb.getStorageStats).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on icons', async () => {
      render(<SyncStatus />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Online')).toBeInTheDocument();
        expect(screen.getByLabelText('Synced')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes on progress bar', async () => {
      render(<SyncStatus />);
      
      // Simulate sync progress
      const progressCallback = vi.mocked(offlineSyncService.onSyncProgress).mock.calls[0][0];
      progressCallback({
        total: 10,
        completed: 5,
        failed: 0,
        status: 'syncing',
      });
      
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });
});
