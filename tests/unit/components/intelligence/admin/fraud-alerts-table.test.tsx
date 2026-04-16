/**
 * Fraud Alerts Table Component Tests
 * 
 * Tests for fraud alerts table with action buttons
 * Task: 11.2.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FraudAlertsTable } from '@/components/intelligence/admin/fraud-alerts-table';
import { ToastProvider } from '@/components/ui/toast';

// Mock fetch
global.fetch = vi.fn();

const mockAlerts = [
  {
    id: 'alert-1',
    entityType: 'vendor',
    entityId: 'vendor-123',
    riskScore: 85,
    flagReasons: ['Multiple consecutive bids', 'Suspicious timing pattern'],
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'alert-2',
    entityType: 'case',
    entityId: 'case-456',
    riskScore: 65,
    flagReasons: ['Duplicate photos detected'],
    status: 'pending',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

describe('FraudAlertsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );
    expect(screen.getByText(/loading alerts/i)).toBeInTheDocument();
  });

  it('should fetch and display fraud alerts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    // Check first alert
    expect(screen.getByText('vendor')).toBeInTheDocument();
    expect(screen.getByText('vendor-1...')).toBeInTheDocument();
    expect(screen.getByText('Multiple consecutive bids')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();

    // Check second alert
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('case')).toBeInTheDocument();
    expect(screen.getByText('Duplicate photos detected')).toBeInTheDocument();
  });

  it('should display empty state when no alerts', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: [] }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no pending fraud alerts/i)).toBeInTheDocument();
    });
  });

  it('should apply correct risk badge variant', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      const highRiskBadge = screen.getByText('85');
      expect(highRiskBadge.className).toContain('bg-red-600');

      const mediumRiskBadge = screen.getByText('65');
      expect(mediumRiskBadge.className).not.toContain('bg-red-600');
    });
  });

  it('should open detail modal when View button clicked', async () => {
    const user = userEvent.setup();

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    await user.click(viewButtons[0]);

    // Modal should open (tested separately in fraud-alert-detail-modal.test.tsx)
  });

  it('should handle quick confirm action', async () => {
    const user = userEvent.setup();
    const onAlertUpdated = vi.fn();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [] }),
      });

    render(
      <ToastProvider>
        <FraudAlertsTable onAlertUpdated={onAlertUpdated} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByRole('button', { name: /confirm/i });
    await user.click(confirmButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/fraud/alerts/alert-1/review'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'confirm' }),
        })
      );
    });

    expect(onAlertUpdated).toHaveBeenCalled();
  });

  it('should handle quick dismiss action', async () => {
    const user = userEvent.setup();
    const onAlertUpdated = vi.fn();

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: mockAlerts }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ alerts: [] }),
      });

    render(
      <ToastProvider>
        <FraudAlertsTable onAlertUpdated={onAlertUpdated} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
    await user.click(dismissButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/intelligence/fraud/alerts/alert-1/review'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'dismiss' }),
        })
      );
    });

    expect(onAlertUpdated).toHaveBeenCalled();
  });

  it('should format dates correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      const dates = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(dates.length).toBeGreaterThan(0);
    });
  });

  it('should truncate entity IDs correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ alerts: mockAlerts }),
    });

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('vendor-1...')).toBeInTheDocument();
      expect(screen.getByText('case-456...')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

    render(
      <ToastProvider>
        <FraudAlertsTable />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching fraud alerts:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });
});
